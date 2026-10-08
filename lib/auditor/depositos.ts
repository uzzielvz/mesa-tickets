/**
 * Lectura del reporte de depósitos de Yunius ("Grup_Depósito_Garantía …xlsx")
 * para el Auditor (AUD-003).
 *
 * Corre en el NAVEGADOR: el reporte pesa ~4.7 MB y una función de Vercel no
 * acepta más de 4.5 MB. `exceljs` se carga solo cuando se usa (import dinámico)
 * para no inflar el resto de las páginas. Sin 'use client': también corre en
 * Node, que es como se prueba contra el archivo real.
 *
 * Forma del archivo (2026-10-05): una hoja; encabezado en la fila 3 (arriba
 * vienen "REPORTE DE PAGOS" y la moneda); 70 columnas. Se buscan por nombre
 * normalizado (sin acentos ni espacios de más), nunca por letra:
 *   Fecha del depósito · Código · Grupo solidario · Ciclo · Periodo ·
 *   Cantidad · Conciliado ("Distribuido" | "No Conciliado") ·
 *   Cód. Recuperador · Recuperador
 * Los montos viajan como texto hasta `numeric`.
 */

export interface DepositoFila {
  fila: number
  fecha_deposito: string
  grupo_id: string
  nombre_grupo: string | null
  ciclo: string
  periodo: number | null
  monto: string
  /** false solo cuando Conciliado dice "No Conciliado". */
  conciliado: boolean
  estatus: string
  cod_recuperador: string | null
  recuperador: string | null
}

export type LecturaDepositos =
  | {
      ok: true
      filas: DepositoFila[]
      rechazadas: number
      noConciliados: number
      montoNoConciliado: number
      fechaMin: string | null
      fechaMax: string | null
      avisos: string[]
    }
  | { ok: false; errores: string[] }

const COLUMNAS = {
  fecha: 'fecha del deposito',
  codigo: 'codigo',
  nombre: 'grupo solidario',
  ciclo: 'ciclo',
  periodo: 'periodo',
  cantidad: 'cantidad',
  conciliado: 'conciliado',
  codRecuperador: 'cod. recuperador',
  recuperador: 'recuperador',
} as const

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** El valor visible de una celda de exceljs: resuelve fórmulas y texto enriquecido. */
function valor(v: unknown): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return (v as { result: unknown }).result
    if ('richText' in v) return (v as { richText: { text: string }[] }).richText.map(t => t.text).join('')
    if ('text' in v) return (v as { text: unknown }).text
  }
  return v
}

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim())

function fecha(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = texto(v)
  const dma = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (dma) return `${dma[3]}-${dma[2].padStart(2, '0')}-${dma[1].padStart(2, '0')}`
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null
}

export async function leerReporteDepositos(bytes: ArrayBuffer): Promise<LecturaDepositos> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(bytes)
  } catch (e) {
    return { ok: false, errores: ['El archivo no se pudo abrir como .xlsx.', e instanceof Error ? e.message : String(e)] }
  }

  // La hoja y la fila de encabezado se reconocen por "Fecha del depósito".
  let hoja: (typeof wb.worksheets)[number] | undefined
  let filaEnc = 0
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !filaEnc; r++) {
      ws.getRow(r).eachCell(c => { if (norm(texto(valor(c.value))) === COLUMNAS.fecha) filaEnc = r })
    }
    if (filaEnc) { hoja = ws; break }
  }
  if (!hoja) {
    return { ok: false, errores: ['No se encontró la columna "Fecha del depósito". ¿Es el reporte de depósitos de Yunius?'] }
  }

  const col: Record<string, number> = {}
  hoja.getRow(filaEnc).eachCell((c, n) => {
    const k = norm(texto(valor(c.value)))
    if (k && !(k in col)) col[k] = n
  })
  const faltan = Object.values(COLUMNAS).filter(k => !(k in col))
  if (faltan.length > 0) {
    return { ok: false, errores: [`Le faltan columnas: ${faltan.join(', ')}.`] }
  }

  const filas: DepositoFila[] = []
  const motivos: string[] = []
  let rechazadas = 0
  const estatusRaros = new Map<string, number>()

  hoja.eachRow((row, r) => {
    if (r <= filaEnc) return
    const at = (k: keyof typeof COLUMNAS) => valor(row.getCell(col[COLUMNAS[k]]).value)
    const codigo = texto(at('codigo'))
    const f = fecha(at('fecha'))
    if (!codigo && !f) return // fila vacía o de totales

    const rechazar = (m: string) => {
      rechazadas++
      if (motivos.length < 5) motivos.push(`fila ${r}: ${m}`)
    }
    if (!f) return rechazar(`fecha "${texto(at('fecha'))}" ilegible`)
    if (!/^\d{1,6}$/.test(codigo)) return rechazar(`código de grupo "${codigo}" no es un número`)
    const ciclo = texto(at('ciclo'))
    if (!/^\d{1,3}$/.test(ciclo)) return rechazar(`ciclo "${ciclo}" no es un número`)
    const cantidad = at('cantidad')
    const monto = typeof cantidad === 'number' ? String(cantidad) : texto(cantidad)
    if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(monto)) return rechazar(`cantidad "${monto}" ilegible`)

    const estatus = texto(at('conciliado'))
    const e = norm(estatus)
    if (e !== 'no conciliado' && e !== 'distribuido') estatusRaros.set(estatus, (estatusRaros.get(estatus) ?? 0) + 1)
    const per = texto(at('periodo'))

    filas.push({
      fila: r,
      fecha_deposito: f,
      grupo_id: codigo.padStart(6, '0'),
      nombre_grupo: texto(at('nombre')) || null,
      ciclo: ciclo.padStart(2, '0'),
      periodo: /^\d+$/.test(per) ? Number(per) : null,
      monto,
      conciliado: e !== 'no conciliado',
      estatus,
      cod_recuperador: texto(at('codRecuperador')) || null,
      recuperador: texto(at('recuperador')) || null,
    })
  })

  if (filas.length === 0) return { ok: false, errores: ['Ninguna fila se pudo leer.', ...motivos] }

  const pendientes = filas.filter(x => !x.conciliado)
  const fechas = filas.map(x => x.fecha_deposito).sort()
  const avisos: string[] = []
  if (rechazadas > 0) avisos.push(`${rechazadas} filas no se cargan porque no se pudieron leer. ${motivos.join(' · ')}`)
  if (estatusRaros.size > 0) {
    const detalle = Array.from(estatusRaros.entries()).map(([k, n]) => `"${k || 'vacío'}" ×${n}`).join(', ')
    avisos.push(`"Conciliado" trae valores que no son "Distribuido" ni "No Conciliado": ${detalle}. Se toman como conciliados.`)
  }

  return {
    ok: true,
    filas,
    rechazadas,
    noConciliados: pendientes.length,
    montoNoConciliado: pendientes.reduce((a, x) => a + Number(x.monto), 0),
    fechaMin: fechas[0] ?? null,
    fechaMax: fechas[fechas.length - 1] ?? null,
    avisos,
  }
}
