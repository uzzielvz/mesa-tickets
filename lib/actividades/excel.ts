/**
 * Lectura del Excel de actividades. Módulo puro: recibe un buffer y devuelve
 * filas listas para insertar, o la lista de problemas que impiden hacerlo.
 * No sabe de Supabase ni de React — para que la validación se pueda probar y
 * reusar desde donde sea (hoy la ruta de carga; mañana un job de Drive).
 *
 * El archivo de referencia es `tablas_uziel.xlsx`: tres hojas, encabezados en la
 * primera fila. La hoja de hechos es la única obligatoria; los catálogos son
 * opcionales porque el tablero no depende de ellos.
 */

import ExcelJS from 'exceljs'

export const HOJA_HECHOS = 'Tabla_actividad'
export const HOJA_EMPLEADOS = 'Empleados'
export const HOJA_PUESTOS = 'Puestos'

/** Sin estas columnas no hay tablero posible. */
const COLUMNAS_REQUERIDAS = [
  'ID_REGISTRO', 'FECHA', 'NO_EMPLEADO', 'NOMBRE', 'ACTIVIDAD', 'CATEGORIA', 'MINUTOS',
] as const

export interface RegistroActividad {
  id_registro: string
  fecha: string            // YYYY-MM-DD
  periodo: string          // YYYY-MM
  no_empleado: string
  nombre: string
  id_puesto: string | null
  puesto: string | null
  area: string | null
  gerencia: string | null
  direccion: string | null
  nivel_jerarquico: string | null
  id_actividad: string | null
  actividad: string | null
  id_categoria: string | null
  categoria: string | null
  minutos: number
  hubo_algo_relevante: boolean
  id_motivo: string | null
  motivo: string | null
  tipo_motivo: string | null
  comentario: string | null
}

export interface EmpleadoCatalogo {
  no_empleado: string
  nombre: string
  correo: string | null
  id_puesto: string | null
  activo: boolean
}

export interface PuestoCatalogo {
  id_puesto: string
  puesto: string
  area: string | null
  activo: boolean
}

export interface ResultadoLectura {
  ok: boolean
  errores: string[]
  avisos: string[]
  registros: RegistroActividad[]
  empleados: EmpleadoCatalogo[]
  puestos: PuestoCatalogo[]
  periodos: string[]
}

// ── Normalizadores ───────────────────────────────────────────────────────────

/** Excel devuelve celdas como string, número, fecha, fórmula o texto enriquecido. */
function valorPlano(v: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text
    if ('result' in v) return valorPlano(v.result as ExcelJS.CellValue)
    if ('richText' in v) return v.richText.map(t => t.text).join('')
    if ('hyperlink' in v && 'text' in v) return String(v.text)
    return null
  }
  return v as string | number | boolean
}

function texto(v: ExcelJS.CellValue): string | null {
  const p = valorPlano(v)
  if (p === null) return null
  if (p instanceof Date) return fechaISO(p)
  const s = String(p).trim()
  return s === '' ? null : s
}

function numero(v: ExcelJS.CellValue): number | null {
  const p = valorPlano(v)
  if (p === null) return null
  if (typeof p === 'number') return p
  const n = Number(String(p).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Booleano tolerante. El archivo puede traer TRUE/FALSE, VERDADERO/FALSO, 1/0 o
 * el booleano nativo de Excel según quién lo generó y en qué idioma.
 */
function booleano(v: ExcelJS.CellValue): boolean {
  const p = valorPlano(v)
  if (p === null) return false
  if (typeof p === 'boolean') return p
  if (typeof p === 'number') return p !== 0
  const s = String(p).trim().toUpperCase()
  return s === 'TRUE' || s === 'VERDADERO' || s === 'SI' || s === 'SÍ' || s === '1'
}

/** Fecha en local, no UTC: `toISOString()` recorre un día en husos negativos. */
function fechaISO(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function aFecha(v: ExcelJS.CellValue): string | null {
  const p = valorPlano(v)
  if (p === null) return null
  if (p instanceof Date) return fechaISO(p)
  const s = String(p).trim()
  // Formato ISO o `YYYY-MM-DD HH:MM:SS`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // Formato mexicano DD/MM/YYYY
  const mx = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mx) return `${mx[3]}-${mx[2].padStart(2, '0')}-${mx[1].padStart(2, '0')}`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : fechaISO(d)
}

/**
 * El periodo del archivo puede venir como texto ('2026-07') o como fecha (Power
 * Query lo convierte). Si no viene, se deriva de la fecha del registro: es un
 * dato redundante, y prefiero derivarlo a rechazar el archivo por él.
 */
function aPeriodo(v: ExcelJS.CellValue, fecha: string | null): string | null {
  const p = valorPlano(v)
  if (p instanceof Date) return fechaISO(p).slice(0, 7)
  if (p !== null) {
    const s = String(p).trim()
    const m = s.match(/^(\d{4})[-/](\d{1,2})/)
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
  }
  return fecha ? fecha.slice(0, 7) : null
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/** Mapa encabezado → índice de columna, insensible a mayúsculas y espacios. */
function mapaEncabezados(hoja: ExcelJS.Worksheet): Map<string, number> {
  const mapa = new Map<string, number>()
  const fila = hoja.getRow(1)
  fila.eachCell({ includeEmpty: false }, (celda, col) => {
    const t = texto(celda.value)
    if (t) mapa.set(t.toUpperCase().replace(/\s+/g, '_'), col)
  })
  return mapa
}

export async function leerExcelActividades(buffer: ArrayBuffer): Promise<ResultadoLectura> {
  const errores: string[] = []
  const avisos: string[] = []
  const wb = new ExcelJS.Workbook()

  try {
    await wb.xlsx.load(buffer)
  } catch {
    return {
      ok: false,
      errores: ['El archivo no se pudo abrir. ¿Es un .xlsx válido?'],
      avisos: [], registros: [], empleados: [], puestos: [], periodos: [],
    }
  }

  const hechos = wb.getWorksheet(HOJA_HECHOS)
  if (!hechos) {
    return {
      ok: false,
      errores: [
        `El archivo no tiene la hoja «${HOJA_HECHOS}». Hojas encontradas: ` +
        (wb.worksheets.map(w => w.name).join(', ') || 'ninguna'),
      ],
      avisos: [], registros: [], empleados: [], puestos: [], periodos: [],
    }
  }

  const cols = mapaEncabezados(hechos)
  const faltantes = COLUMNAS_REQUERIDAS.filter(c => !cols.has(c))
  if (faltantes.length > 0) {
    return {
      ok: false,
      errores: [`Faltan columnas obligatorias en «${HOJA_HECHOS}»: ${faltantes.join(', ')}`],
      avisos: [], registros: [], empleados: [], puestos: [], periodos: [],
    }
  }

  const celda = (fila: ExcelJS.Row, nombre: string): ExcelJS.CellValue => {
    const col = cols.get(nombre)
    return col ? fila.getCell(col).value : null
  }

  const registros: RegistroActividad[] = []
  const vistos = new Set<string>()
  let sinArea = 0

  for (let i = 2; i <= hechos.rowCount; i++) {
    const fila = hechos.getRow(i)
    const idRegistro = texto(celda(fila, 'ID_REGISTRO'))
    const noEmpleado = texto(celda(fila, 'NO_EMPLEADO'))

    // Fila vacía al final de la hoja: se ignora en silencio, es lo normal.
    if (!idRegistro && !noEmpleado) continue

    const fecha = aFecha(celda(fila, 'FECHA'))
    const periodo = aPeriodo(celda(fila, 'PERIODO'), fecha)
    const minutos = numero(celda(fila, 'MINUTOS'))

    if (!idRegistro) { errores.push(`Fila ${i}: sin ID_REGISTRO.`); continue }
    if (!noEmpleado) { errores.push(`Fila ${i}: sin NO_EMPLEADO.`); continue }
    if (!fecha)      { errores.push(`Fila ${i}: FECHA vacía o ilegible.`); continue }
    if (!periodo)    { errores.push(`Fila ${i}: no se pudo determinar el periodo.`); continue }
    if (minutos === null || minutos < 0) {
      errores.push(`Fila ${i}: MINUTOS vacío o negativo.`); continue
    }

    const llave = `${periodo}|${idRegistro}`
    if (vistos.has(llave)) {
      errores.push(`Fila ${i}: ID_REGISTRO «${idRegistro}» repetido dentro de ${periodo}.`)
      continue
    }
    vistos.add(llave)

    const area = texto(celda(fila, 'AREA'))
    if (!area) sinArea++

    registros.push({
      id_registro: idRegistro,
      fecha,
      periodo,
      no_empleado: noEmpleado,
      nombre: texto(celda(fila, 'NOMBRE')) ?? noEmpleado,
      id_puesto: texto(celda(fila, 'ID_PUESTO')),
      puesto: texto(celda(fila, 'PUESTO')),
      area,
      gerencia: texto(celda(fila, 'GERENCIA')),
      direccion: texto(celda(fila, 'DIRECCION')),
      nivel_jerarquico: texto(celda(fila, 'NIVEL_JERARQUICO')),
      id_actividad: texto(celda(fila, 'ID_ACTIVIDAD')),
      actividad: texto(celda(fila, 'ACTIVIDAD')),
      id_categoria: texto(celda(fila, 'ID_CATEGORIA')),
      categoria: texto(celda(fila, 'CATEGORIA')),
      minutos: Math.round(minutos),
      hubo_algo_relevante: booleano(celda(fila, 'HUBO_ALGO_RELEVANTE')),
      id_motivo: texto(celda(fila, 'ID_MOTIVO')),
      motivo: texto(celda(fila, 'MOTIVO')),
      tipo_motivo: texto(celda(fila, 'TIPO_MOTIVO'))?.toUpperCase() ?? null,
      comentario: texto(celda(fila, 'COMENTARIO')),
    })
  }

  if (registros.length === 0 && errores.length === 0) {
    errores.push(`La hoja «${HOJA_HECHOS}» no tiene filas de datos.`)
  }
  // No bloquea: el área se puede resolver luego por el catálogo de puestos.
  if (sinArea > 0) avisos.push(`${sinArea} registro(s) sin AREA.`)

  // ── Catálogos (opcionales) ─────────────────────────────────────────────────
  const puestos: PuestoCatalogo[] = []
  const hojaPuestos = wb.getWorksheet(HOJA_PUESTOS)
  if (hojaPuestos) {
    const c = mapaEncabezados(hojaPuestos)
    for (let i = 2; i <= hojaPuestos.rowCount; i++) {
      const fila = hojaPuestos.getRow(i)
      const id = texto(c.has('ID_PUESTO') ? fila.getCell(c.get('ID_PUESTO')!).value : null)
      const nombre = texto(c.has('PUESTO') ? fila.getCell(c.get('PUESTO')!).value : null)
      if (!id || !nombre) continue
      puestos.push({
        id_puesto: id,
        puesto: nombre,
        area: texto(c.has('AREA') ? fila.getCell(c.get('AREA')!).value : null),
        activo: c.has('ACTIVO') ? booleano(fila.getCell(c.get('ACTIVO')!).value) : true,
      })
    }
  } else {
    avisos.push(`Sin hoja «${HOJA_PUESTOS}»: no se actualizó el catálogo de puestos.`)
  }

  const empleados: EmpleadoCatalogo[] = []
  const idsPuesto = new Set(puestos.map(p => p.id_puesto))
  const hojaEmpleados = wb.getWorksheet(HOJA_EMPLEADOS)
  if (hojaEmpleados) {
    const c = mapaEncabezados(hojaEmpleados)
    for (let i = 2; i <= hojaEmpleados.rowCount; i++) {
      const fila = hojaEmpleados.getRow(i)
      const id = texto(c.has('NO_EMPLEADO') ? fila.getCell(c.get('NO_EMPLEADO')!).value : null)
      const nombre = texto(c.has('NOMBRE') ? fila.getCell(c.get('NOMBRE')!).value : null)
      if (!id || !nombre) continue
      const idPuesto = texto(c.has('ID_PUESTO') ? fila.getCell(c.get('ID_PUESTO')!).value : null)
      empleados.push({
        no_empleado: id,
        nombre,
        correo: texto(c.has('CORREO') ? fila.getCell(c.get('CORREO')!).value : null),
        // La FK exige que el puesto exista; si el catálogo no lo trae, se guarda
        // el empleado sin puesto en vez de perder la fila entera.
        id_puesto: idPuesto && idsPuesto.has(idPuesto) ? idPuesto : null,
        activo: c.has('ACTIVO') ? booleano(fila.getCell(c.get('ACTIVO')!).value) : true,
      })
    }
  } else {
    avisos.push(`Sin hoja «${HOJA_EMPLEADOS}»: no se actualizó el catálogo de empleados.`)
  }

  const periodos = Array.from(new Set(registros.map(r => r.periodo))).sort()

  return {
    ok: errores.length === 0 && registros.length > 0,
    errores,
    avisos,
    registros,
    empleados,
    puestos,
    periodos,
  }
}
