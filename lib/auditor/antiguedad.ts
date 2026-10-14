/**
 * Lectura del reporte de antigüedad grupal de Yunius
 * ("AntigüedadGrupal_DDMMAA.xlsm") para el Auditor (AUD-004): de quién es
 * cada grupo, para que cada promotor vea solo lo suyo.
 *
 * Corre en el NAVEGADOR, como el de depósitos; `exceljs` se carga solo cuando
 * se usa. Sin 'use client': también corre en Node, que es como se prueba
 * contra el archivo real. Las macros del .xlsm no se ejecutan: solo se leen
 * los valores.
 *
 * Forma del archivo (2026-10-12): tres hojas; la que sirve es CARTERA, con el
 * título "Reporte de Antigüedad Grupal al 12 de octubre del 2026" en la fila 3
 * y el encabezado en la fila 6. Una fila por grupo, con su ciclo actual. Las
 * columnas se buscan por nombre normalizado, nunca por letra:
 *   Nombre del gerente · Nombre promotor · ID de grupo · Nombre de grupo ·
 *   Ciclo · Estatus
 * Abajo vienen filas de totales (COUNTA…) sin promotor ni nombre: se saltan.
 */

export interface GrupoAntiguedad {
  grupo_id: string
  nombre_grupo: string | null
  ciclo: string | null
  estatus: string | null
  promotor: string | null
  gerente: string | null
}

export type LecturaAntiguedad =
  | {
      ok: true
      grupos: GrupoAntiguedad[]
      /** Del título de la hoja; null si no se pudo leer. */
      fechaCorte: string | null
      promotores: number
      gerentes: number
      avisos: string[]
    }
  | { ok: false; errores: string[] }

const COLUMNAS = {
  gerente: 'nombre del gerente',
  promotor: 'nombre promotor',
  grupo: 'id de grupo',
  nombre: 'nombre de grupo',
  ciclo: 'ciclo',
  estatus: 'estatus',
} as const

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

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

/** "…Grupal al 12 de octubre del 2026" → "2026-10-12". */
function fechaDelTitulo(s: string): string | null {
  const m = /al (\d{1,2}) de ([a-z]+) del? (\d{4})/.exec(norm(s))
  const mes = m ? MESES.indexOf(m[2]) + 1 : 0
  if (!m || mes === 0) return null
  return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

export async function leerReporteAntiguedad(bytes: ArrayBuffer): Promise<LecturaAntiguedad> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(bytes)
  } catch (e) {
    return { ok: false, errores: ['El archivo no se pudo abrir como .xlsx o .xlsm.', e instanceof Error ? e.message : String(e)] }
  }

  // La hoja y la fila de encabezado se reconocen por traer "ID de grupo" y
  // "Nombre promotor" en la misma fila.
  let hoja: (typeof wb.worksheets)[number] | undefined
  let filaEnc = 0
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !filaEnc; r++) {
      const enc = new Set<string>()
      ws.getRow(r).eachCell(c => { enc.add(norm(texto(valor(c.value)))) })
      if (enc.has(COLUMNAS.grupo) && enc.has(COLUMNAS.promotor)) filaEnc = r
    }
    if (filaEnc) { hoja = ws; break }
  }
  if (!hoja) {
    return { ok: false, errores: ['No se encontraron las columnas "ID de grupo" y "Nombre promotor". ¿Es el reporte de antigüedad grupal?'] }
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

  let fechaCorte: string | null = null
  for (let r = 1; r < filaEnc && !fechaCorte; r++) {
    hoja.getRow(r).eachCell(c => { fechaCorte ??= fechaDelTitulo(texto(valor(c.value))) })
  }

  const grupos: GrupoAntiguedad[] = []
  const vistos = new Map<string, number>()
  const motivos: string[] = []
  const duplicados: string[] = []
  let rechazadas = 0

  hoja.eachRow((row, r) => {
    if (r <= filaEnc) return
    const at = (k: keyof typeof COLUMNAS) => texto(valor(row.getCell(col[COLUMNAS[k]]).value))
    const codigo = at('grupo')
    const nombre = at('nombre')
    const promotor = at('promotor')
    const gerente = at('gerente')
    if (!codigo || (!nombre && !promotor && !gerente)) return // vacía o de totales

    if (!/^\d{1,6}$/.test(codigo)) {
      rechazadas++
      if (motivos.length < 5) motivos.push(`fila ${r}: ID de grupo "${codigo}" no es un número`)
      return
    }
    const grupo_id = codigo.padStart(6, '0')
    if (vistos.has(grupo_id)) {
      if (duplicados.length < 5) duplicados.push(`${Number(codigo)} (filas ${vistos.get(grupo_id)} y ${r})`)
      return
    }
    vistos.set(grupo_id, r)

    const ciclo = at('ciclo')
    grupos.push({
      grupo_id,
      nombre_grupo: nombre || null,
      ciclo: /^\d{1,3}$/.test(ciclo) ? ciclo.padStart(2, '0') : ciclo || null,
      estatus: at('estatus') || null,
      promotor: promotor || null,
      gerente: gerente || null,
    })
  })

  if (grupos.length === 0) return { ok: false, errores: ['Ninguna fila se pudo leer.', ...motivos] }

  const sinPromotor = grupos.filter(g => !g.promotor)
  const avisos: string[] = []
  if (rechazadas > 0) avisos.push(`${rechazadas} filas no se cargan porque no se pudieron leer. ${motivos.join(' · ')}`)
  if (duplicados.length > 0) avisos.push(`Grupos repetidos; se toma la primera fila: ${duplicados.join(', ')}.`)
  if (sinPromotor.length > 0) {
    const ej = sinPromotor.slice(0, 5).map(g => Number(g.grupo_id)).join(', ')
    avisos.push(`${sinPromotor.length} grupos no traen promotor (${ej}${sinPromotor.length > 5 ? '…' : ''}): solo los verá quien ve toda la cartera.`)
  }
  if (!fechaCorte) avisos.push('No se encontró la fecha de corte en el título de la hoja.')

  return {
    ok: true,
    grupos,
    fechaCorte,
    promotores: new Set(grupos.map(g => g.promotor).filter(Boolean)).size,
    gerentes: new Set(grupos.map(g => g.gerente).filter(Boolean)).size,
    avisos,
  }
}
