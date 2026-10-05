import ExcelJS from 'exceljs'
import { nombreClave } from './calendario'

/**
 * Lectura de la base de vacaciones de Gente y Cultura
 * (`BASE DE VACACIONES CREDIFLEXI 210926.xlsx`). Corre en el servidor.
 *
 * Forma del archivo (2026-10-04):
 *   · Una hoja por año de servicio: "CICLO 1" (visible), "CICLO 2" (oculta).
 *     El ciclo N es el derecho del N-ésimo aniversario (12, 14… días).
 *   · Encabezado en la fila 7: Empleados · puesto (columna oculta) ·
 *     Pendientes · Fecha Ingreso · hoy · … · Dias tomados · Dias restantes ·
 *     fecha de vacaciones · Dias flotantes (cuántos) · Dias flotantes (fechas).
 *   · Dos columnas se llaman igual ("Dias flotantes"): la primera es el número,
 *     la segunda las fechas.
 *
 * De cada hoja solo se toma lo que no es fórmula: nombre, puesto, ingreso, días
 * tomados y sus fechas, y flotantes. Antigüedad, derecho y restantes salen de
 * la fecha de ingreso y la ley (RPC vac_saldos), no del archivo: su TODAY() está
 * congelado.
 */

export interface MovimientoImportado {
  tipo: 'vacaciones' | 'flotante'
  periodo: number | null
  dias: number
  fecha_inicio: string | null
  fechas_texto: string | null
}

export interface EmpleadoImportado {
  nombre: string
  nombre_clave: string
  puesto: string | null
  fecha_ingreso: string
  en_ciclo1: boolean
  en_ciclo2: boolean
  movimientos: MovimientoImportado[]
}

export type LecturaBase =
  | { ok: true; empleados: EmpleadoImportado[]; hojas: string[]; avisos: string[] }
  | { ok: false; errores: string[] }

interface FilaHoja {
  ciclo: number
  nombre: string
  clave: string
  puesto: string | null
  ingreso: string
  tomados: number | null
  fechas: string | null
  flotN: number | null
  flotFechas: string | null
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const ddmmaaaa = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`

/** El valor visible de una celda: resuelve fórmulas a su resultado y fechas a Date. */
function valor(c: ExcelJS.Cell): unknown {
  const v = c.value as unknown
  if (v && typeof v === 'object' && 'result' in (v as object)) return (v as { result: unknown }).result
  if (v && typeof v === 'object' && 'richText' in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map(t => t.text).join('')
  }
  return v
}

const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return ddmmaaaa(v)
  const s = String(v).trim()
  return s === '' ? null : s
}

const numero = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return null
}

/** Distancia de edición, para reconocer "FELIX" y "FELIZ" como la misma persona. */
function distancia(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[m][n]
}

const normalizarEncabezado = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export async function leerBaseVacaciones(bytes: ArrayBuffer): Promise<LecturaBase> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(bytes)
  } catch (e) {
    return { ok: false, errores: ['El archivo no se pudo abrir como .xlsx.', e instanceof Error ? e.message : String(e)] }
  }

  const hojas = wb.worksheets
    .map(ws => ({ ws, m: /^ciclo\s*(\d+)$/i.exec(ws.name.trim()) }))
    .filter((x): x is { ws: ExcelJS.Worksheet; m: RegExpExecArray } => !!x.m)
    .map(x => ({ ws: x.ws, ciclo: Number(x.m[1]) }))
    .sort((a, b) => a.ciclo - b.ciclo)

  if (hojas.length === 0) {
    return {
      ok: false,
      errores: [
        'No se encontró ninguna hoja "CICLO 1", "CICLO 2"…',
        `Hojas del archivo: ${wb.worksheets.map(w => w.name).join(', ')}.`,
      ],
    }
  }

  const avisos: string[] = []
  const filas: FilaHoja[] = []

  for (const { ws, ciclo } of hojas) {
    // El encabezado es la fila que dice "Empleados"; en la base actual es la 7.
    let filaEnc = 0
    ws.eachRow((row, r) => {
      if (filaEnc) return
      row.eachCell(c => { if (normalizarEncabezado(String(valor(c) ?? '')) === 'empleados') filaEnc = r })
    })
    if (!filaEnc) {
      avisos.push(`La hoja "${ws.name}" no tiene la columna "Empleados"; se ignoró.`)
      continue
    }

    const col: Record<string, number[]> = {}
    ws.getRow(filaEnc).eachCell((c, n) => {
      const k = normalizarEncabezado(String(valor(c) ?? ''))
      if (k) (col[k] ??= []).push(n)
    })
    const c = (k: string, i = 0) => col[k]?.[i]
    const cNombre = c('empleados')
    const cIngreso = c('fecha ingreso')
    if (!cNombre || !cIngreso) {
      avisos.push(`La hoja "${ws.name}" no tiene "Empleados" y "Fecha Ingreso"; se ignoró.`)
      continue
    }

    for (let r = filaEnc + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const nombre = texto(valor(row.getCell(cNombre)))
      if (!nombre) continue
      const ingreso = valor(row.getCell(cIngreso))
      if (!(ingreso instanceof Date)) {
        avisos.push(`"${nombre}" (${ws.name}, fila ${r}) no tiene una fecha de ingreso legible; se omitió.`)
        continue
      }
      const at = (k: string, i = 0) => {
        const n = c(k, i)
        return n ? valor(row.getCell(n)) : null
      }
      filas.push({
        ciclo,
        nombre: nombre.replace(/\s+/g, ' ').trim(),
        clave: nombreClave(nombre),
        puesto: texto(at('puesto')),
        ingreso: iso(ingreso),
        tomados: numero(at('dias tomados')),
        fechas: texto(at('fecha de vacaciones')),
        flotN: numero(at('dias flotantes', 0)),
        flotFechas: texto(at('dias flotantes', 1)),
      })
    }
  }

  if (filas.length === 0) return { ok: false, errores: ['Ninguna hoja trae empleados legibles.', ...avisos] }

  // ── Unir a la misma persona entre hojas ──
  // Primero por nombre normalizado. Después, lo que quedó suelto en una sola
  // hoja se une con alguien de otra hoja que tenga la MISMA fecha de ingreso y
  // un nombre casi igual ("GUTIERREZ MATUS FELIZ ROBERTO" en CICLO 2).
  const porClave = new Map<string, FilaHoja[]>()
  for (const f of filas) porClave.set(f.clave, [...(porClave.get(f.clave) ?? []), f])

  const claves = Array.from(porClave.keys())
  for (const k of claves) {
    const grupo = porClave.get(k)
    if (!grupo || new Set(grupo.map(g => g.ciclo)).size === hojas.length) continue
    const ciclos = new Set(grupo.map(g => g.ciclo))
    const gemelo = claves.find(o =>
      o !== k && porClave.has(o) &&
      porClave.get(o)!.every(g => !ciclos.has(g.ciclo)) &&
      porClave.get(o)![0].ingreso === grupo[0].ingreso &&
      distancia(o, k) <= 2,
    )
    if (gemelo) {
      const otro = porClave.get(gemelo)!
      // Se queda el nombre de la hoja de menor ciclo (la visible).
      const [base, extra] = grupo[0].ciclo < otro[0].ciclo ? [k, gemelo] : [gemelo, k]
      porClave.set(base, [...porClave.get(base)!, ...porClave.get(extra)!.map(f => ({ ...f, clave: base }))])
      porClave.delete(extra)
      avisos.push(`"${extra}" y "${base}" se tomaron como la misma persona (mismo ingreso, nombre casi igual).`)
    }
  }

  const empleados: EmpleadoImportado[] = []
  for (const [clave, grupo] of Array.from(porClave.entries())) {
    grupo.sort((a, b) => a.ciclo - b.ciclo)
    const principal = grupo[0]
    if (new Set(grupo.map(g => g.ingreso)).size > 1) {
      avisos.push(`"${principal.nombre}" tiene fechas de ingreso distintas entre hojas; se usó la de ${principal.ciclo === 1 ? 'CICLO 1' : `CICLO ${principal.ciclo}`}.`)
    }

    const movimientos: MovimientoImportado[] = []
    for (const g of grupo) {
      if (g.tomados && g.tomados > 0) {
        movimientos.push({ tipo: 'vacaciones', periodo: g.ciclo, dias: g.tomados, fecha_inicio: null, fechas_texto: g.fechas })
      } else if (g.fechas) {
        avisos.push(`"${g.nombre}" (CICLO ${g.ciclo}) tiene fechas de vacaciones pero no días tomados; no se cargó ese saldo.`)
      }
    }

    // Flotantes: van por año calendario, no por ciclo. Si dos hojas los traen
    // para la misma persona, se toma la primera y se avisa.
    const conFlot = grupo.filter(g => (g.flotN && g.flotN > 0) || g.flotFechas)
    if (conFlot.length > 0) {
      const g = conFlot[0]
      const fechasN = g.flotFechas ? g.flotFechas.split(/\s*[\n,]\s*/).filter(Boolean).length : 0
      const dias = g.flotN && g.flotN > 0 ? g.flotN : fechasN
      if (!(g.flotN && g.flotN > 0)) {
        avisos.push(`"${g.nombre}" tiene fecha de día flotante pero no el número; se contó ${dias}.`)
      }
      const unaFecha = g.flotFechas && /^\d{2}\/\d{2}\/\d{4}$/.test(g.flotFechas)
        ? `${g.flotFechas.slice(6, 10)}-${g.flotFechas.slice(3, 5)}-${g.flotFechas.slice(0, 2)}`
        : null
      if (dias > 0) {
        movimientos.push({ tipo: 'flotante', periodo: null, dias, fecha_inicio: unaFecha, fechas_texto: g.flotFechas })
      }
      if (conFlot.length > 1) avisos.push(`"${g.nombre}" trae días flotantes en dos hojas; se tomó CICLO ${g.ciclo}.`)
    }

    empleados.push({
      nombre: principal.nombre,
      nombre_clave: clave,
      puesto: grupo.map(g => g.puesto).find(Boolean) ?? null,
      fecha_ingreso: principal.ingreso,
      en_ciclo1: grupo.some(g => g.ciclo === 1),
      en_ciclo2: grupo.some(g => g.ciclo === 2),
      movimientos,
    })
  }

  empleados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { ok: true, empleados, hojas: hojas.map(h => h.ws.name), avisos }
}
