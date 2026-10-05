import ExcelJS from 'exceljs'

/**
 * Lectura del archivo de pagos registrados que manda Felix desde Yunius
 * (`pagos_registrados_082026.xlsx`). Corre en el servidor.
 *
 * Forma (2026-10-04): una hoja, encabezado en la fila 1, una primera columna
 * sin nombre (el índice de pandas, se ignora) y después:
 *   CONCILIADO (C/N) · CICLO · CDGCLNS (grupo) · PERIODO (semana) ·
 *   NOMBRENS (nombre del grupo) · FREALDEP (dd/mm/aaaa, como texto) · MONTODEP
 * Opcional, para la versión de promotores: PROMOTOR (correo de la plataforma).
 */

export interface RegistroAuditor {
  fila: number
  conciliado: boolean
  ciclo: string
  grupo_id: string
  periodo: number | null
  nombre_grupo: string | null
  fecha_deposito: string
  /** Como texto: viaja hasta `numeric` sin pasar por redondeos de JS. */
  monto: string
  promotor: string | null
}

export type LecturaAuditor =
  | { ok: true; filas: RegistroAuditor[]; avisos: string[]; conPromotor: boolean }
  | { ok: false; errores: string[] }

const REQUERIDAS = ['CONCILIADO', 'CICLO', 'CDGCLNS', 'PERIODO', 'NOMBRENS', 'FREALDEP', 'MONTODEP'] as const

function valor(c: ExcelJS.Cell): unknown {
  const v = c.value as unknown
  if (v && typeof v === 'object' && 'result' in (v as object)) return (v as { result: unknown }).result
  if (v && typeof v === 'object' && 'richText' in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map(t => t.text).join('')
  }
  return v
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

/** FREALDEP llega como texto "02/09/2026"; si alguien lo re-guarda, como fecha. */
function fecha(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto(v))
  if (!m) return null
  const [, d, me, a] = m
  const f = new Date(Date.UTC(+a, +me - 1, +d))
  if (f.getUTCMonth() !== +me - 1 || f.getUTCDate() !== +d) return null
  return `${a}-${me.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export async function leerPagosRegistrados(bytes: ArrayBuffer): Promise<LecturaAuditor> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(bytes)
  } catch (e) {
    return { ok: false, errores: ['El archivo no se pudo abrir como .xlsx.', e instanceof Error ? e.message : String(e)] }
  }

  // La hoja que tenga el encabezado CONCILIADO, sin importar cómo se llame.
  let ws: ExcelJS.Worksheet | undefined
  let filaEnc = 0
  for (const hoja of wb.worksheets) {
    for (let r = 1; r <= Math.min(hoja.rowCount, 10) && !filaEnc; r++) {
      hoja.getRow(r).eachCell(c => { if (texto(valor(c)).toUpperCase() === 'CONCILIADO') filaEnc = r })
    }
    if (filaEnc) { ws = hoja; break }
  }
  if (!ws) {
    return { ok: false, errores: ['No se encontró la columna CONCILIADO. ¿Es el archivo de pagos registrados?'] }
  }

  const col: Record<string, number> = {}
  ws.getRow(filaEnc).eachCell((c, n) => {
    const k = texto(valor(c)).toUpperCase()
    if (k && !(k in col)) col[k] = n
  })
  const faltan = REQUERIDAS.filter(k => !(k in col))
  if (faltan.length > 0) {
    return { ok: false, errores: [`Le faltan columnas: ${faltan.join(', ')}.`] }
  }
  const conPromotor = 'PROMOTOR' in col

  const filas: RegistroAuditor[] = []
  const motivos: string[] = []
  let rechazadas = 0
  const rechazar = (r: number, m: string) => {
    rechazadas++
    if (motivos.length < 5) motivos.push(`fila ${r}: ${m}`)
  }

  for (let r = filaEnc + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const at = (k: string) => valor(row.getCell(col[k]))
    const conc = texto(at('CONCILIADO')).toUpperCase()
    const grupo = texto(at('CDGCLNS'))
    if (!conc && !grupo) continue // fila vacía

    if (conc !== 'C' && conc !== 'N') { rechazar(r, `CONCILIADO = "${conc}" (se espera C o N)`); continue }
    if (!/^\d{1,6}$/.test(grupo)) { rechazar(r, `grupo "${grupo}" no es un número`); continue }
    const ciclo = texto(at('CICLO'))
    if (!/^\d{1,3}$/.test(ciclo)) { rechazar(r, `ciclo "${ciclo}" no es un número`); continue }
    const f = fecha(at('FREALDEP'))
    if (!f) { rechazar(r, `fecha "${texto(at('FREALDEP'))}" ilegible`); continue }
    const montoV = at('MONTODEP')
    const monto = typeof montoV === 'number' ? String(montoV) : texto(montoV)
    if (!/^-?\d+(\.\d+)?$/.test(monto)) { rechazar(r, `monto "${monto}" ilegible`); continue }
    const per = texto(at('PERIODO'))

    filas.push({
      fila: r,
      conciliado: conc === 'C',
      ciclo: ciclo.padStart(2, '0'),
      grupo_id: grupo.padStart(6, '0'),
      periodo: /^\d+$/.test(per) ? Number(per) : null,
      nombre_grupo: texto(at('NOMBRENS')) || null,
      fecha_deposito: f,
      monto,
      promotor: conPromotor ? texto(at('PROMOTOR')).toLowerCase() || null : null,
    })
  }

  if (filas.length === 0) return { ok: false, errores: ['Ninguna fila se pudo leer.', ...motivos] }

  const avisos: string[] = []
  if (rechazadas > 0) avisos.push(`${rechazadas} filas no se cargaron. ${motivos.join(' · ')}`)
  if (!conPromotor) {
    avisos.push('El archivo no trae la columna PROMOTOR: la vista es de toda la cartera, todavía no por promotor.')
  }
  return { ok: true, filas, avisos, conPromotor }
}
