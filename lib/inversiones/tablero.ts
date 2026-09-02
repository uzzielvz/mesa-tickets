/**
 * Parseo del Tablero Ejecutivo de Cartera de Inversiones (I4).
 *
 * Módulo PURO: recibe un libro ya abierto y devuelve filas o errores.
 *
 * ── Por qué este es el sprint difícil ───────────────────────────────────────
 *
 * Trece hojas de dos naturalezas distintas:
 *
 *   · **Planas** (9): un encabezado y datos debajo. Mecánicas.
 *   · **Apiladas** (4): `Tablero`, `Tablero_Estructura`, `Ranking_Comercial` y
 *     `Ranking_Con_Meta` NO son una tabla — son VARIAS tablas puestas una debajo
 *     de otra en la misma hoja, cada una con su propio título y su propio
 *     encabezado, y con distinto número de columnas entre ellas. El ranking trae
 *     tres bloques (por gerente ejecutivo, por gerente de inversión, por
 *     ejecutivo) de 27, 28 y 29 columnas.
 *
 * Y la forma **no es estable entre cortes**: en el corte del 02/09 los dos
 * rankings llegan con la leyenda `SIN_DATOS` en lugar de sus tablas, porque el
 * periodo llevaba dos días y no hubo con qué rankear. Eso es parte del contrato
 * del archivo, no una anomalía (RESEARCH §14.3, hallazgo 1): se registra como
 * degradación y la carga sigue.
 */

import type ExcelJS from 'exceljs'
import { texto } from '@/lib/inversiones/excel'

// ── Lectura de celdas ────────────────────────────────────────────────────────

type Tipo = 'texto' | 'num' | 'int' | 'fecha' | 'bool' | 'clabe'

interface Col {
  /** Nombre exacto del encabezado en el archivo. */
  xls: string
  /** Columna en la base. */
  campo: string
  t: Tipo
}

/**
 * `nan` es NaN de pandas escrito como texto: llega en `TIPO_PARCHE` y en
 * cualquier columna donde el generador no tuvo valor. Es ausencia, no dato.
 */
function limpio(s: string): string | null {
  const v = s.trim()
  if (v === '' || v.toLowerCase() === 'nan' || v.toLowerCase() === 'none') return null
  return v
}

function num(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor === 'object') {
    const v = valor as { result?: unknown }
    if (v.result !== undefined) return num(v.result)
  }
  const s = limpio(String(valor).replace(/[$,%\s]/g, ''))
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function fecha(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  const s = limpio(texto(valor))
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

/** `SI` / `NO` como los escribe el generador. Cualquier otra cosa es ausencia. */
function bool(valor: unknown): boolean | null {
  const s = limpio(texto(valor))?.toUpperCase()
  if (s === 'SI' || s === 'SÍ' || s === 'TRUE') return true
  if (s === 'NO' || s === 'FALSE') return false
  return null
}

/**
 * Una CLABE válida es **texto de 18 dígitos**. Si llega como número, Excel ya le
 * comió los ceros de la izquierda y float64 le alteró los últimos dígitos: se
 * descarta en vez de guardar una cuenta bancaria casi correcta, que es peor que
 * ninguna. La guarda queda puesta para el día que se corrija aguas arriba.
 */
function clabe(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const s = valor.trim()
  return /^\d{18}$/.test(s) ? s : null
}

function leerCelda(valor: unknown, t: Tipo): unknown {
  switch (t) {
    case 'num':   return num(valor)
    case 'int':   { const n = num(valor); return n === null ? null : Math.trunc(n) }
    case 'fecha': return fecha(valor)
    case 'bool':  return bool(valor)
    case 'clabe': return clabe(valor)
    default:      return limpio(texto(valor))
  }
}

// ── Hojas planas ─────────────────────────────────────────────────────────────

/** Encabezado → índice de columna (1-based) de una fila concreta. */
function mapaColumnas(ws: ExcelJS.Worksheet, filaEncabezado: number): Record<string, number> {
  const mapa: Record<string, number> = {}
  ws.getRow(filaEncabezado).eachCell({ includeEmpty: false }, (celda, col) => {
    const nombre = texto(celda.value)
    if (nombre) mapa[nombre] = col
  })
  return mapa
}

/**
 * Localiza el encabezado de una hoja plana: la primera fila que contenga la
 * columna `ancla`. Se busca en vez de fijarse porque el número de filas de
 * preámbulo cambia entre hojas (0 en `CREDIFLEXI_Vigente`, 3 en
 * `Historial_Movimientos`, 4 en `Cumplimiento_Metas`) y podría cambiar con una
 * versión nueva del generador.
 */
function buscarEncabezado(ws: ExcelJS.Worksheet, ancla: string, limite = 12): number | null {
  for (let i = 1; i <= Math.min(limite, ws.rowCount); i++) {
    const fila = ws.getRow(i)
    let hay = false
    fila.eachCell({ includeEmpty: false }, c => {
      if (texto(c.value) === ancla) hay = true
    })
    if (hay) return i
  }
  return null
}

function leerPlana(
  ws: ExcelJS.Worksheet,
  ancla: string,
  cols: Col[],
): { filas: Record<string, unknown>[]; error?: string } {
  const filaEnc = buscarEncabezado(ws, ancla)
  if (filaEnc === null) {
    return { filas: [], error: `En la hoja ${ws.name} no se encontró la columna ${ancla}.` }
  }

  const mapa = mapaColumnas(ws, filaEnc)
  const filas: Record<string, unknown>[] = []

  for (let i = filaEnc + 1; i <= ws.rowCount; i++) {
    const fila = ws.getRow(i)
    const registro: Record<string, unknown> = { fila: i }
    let algo = false

    for (const c of cols) {
      const col = mapa[c.xls]
      const valor = col ? leerCelda(fila.getCell(col).value, c.t) : null
      registro[c.campo] = valor
      if (valor !== null && valor !== undefined && valor !== '') algo = true
    }

    if (algo) filas.push(registro)
  }

  return { filas }
}

// ── Hojas apiladas ───────────────────────────────────────────────────────────

export interface Bloque {
  /** Título que precede a la tabla, p. ej. "Ranking por gerente ejecutivo". */
  titulo: string
  encabezado: string[]
  /** Índice de columna (1-based) por nombre de encabezado. */
  mapa: Record<string, number>
  /** Números de fila de la hoja, no los datos: se leen con el tipo correcto. */
  filas: number[]
  /** El bloque existe pero el generador lo dejó vacío con la marca SIN_DATOS. */
  sinDatos: boolean
}

const MARCA_SIN_DATOS = 'SIN_DATOS'

/**
 * Parte una hoja apilada en sus bloques.
 *
 * La estructura que produce el generador es siempre la misma: una fila de título
 * (una sola celda con texto), luego el encabezado (varias celdas, todas texto),
 * luego los datos, y una o dos filas vacías antes del siguiente bloque.
 *
 * Dos cosas que no son obvias y sin las cuales esto no funciona:
 *
 * **1. Se cuentan valores DISTINTOS, no celdas.** Los títulos van en celdas
 * combinadas y exceljs repite el mismo texto en todas las columnas del rango:
 * contando celdas, un título en una hoja de 30 columnas parece una tabla de 30
 * columnas.
 *
 * **2. Un título puede traer VARIAS tablas.** En la hoja `Tablero`, bajo el
 * título "CREDIFLEXI" vienen dos: el total del universo (4 columnas, una fila) y
 * el desglose por gerente (5 columnas, una por gerente). Un segundo encabezado
 * dentro del mismo título abre un bloque nuevo en vez de leerse como dato — que
 * es justo el error que hacía que las nueve filas de gerentes se contaran como
 * "total".
 *
 * Encabezado y dato se distinguen porque **un encabezado no trae números**: las
 * filas de datos siempre llevan al menos una cifra.
 */
export function detectarBloques(ws: ExcelJS.Worksheet): Bloque[] {
  const bloques: Bloque[] = []
  let actual: Bloque | null = null

  // Crea y registra, pero NO asigna a `actual`: si lo hiciera desde dentro del
  // closure, TypeScript pierde el estrechamiento y trata `actual` como `never`
  // en el resto del bucle.
  const nuevo = (titulo: string): Bloque => {
    const b: Bloque = { titulo, encabezado: [], mapa: {}, filas: [], sinDatos: false }
    bloques.push(b)
    return b
  }

  for (let i = 1; i <= ws.rowCount; i++) {
    const fila = ws.getRow(i)
    const celdas: { col: number; v: string }[] = []
    fila.eachCell({ includeEmpty: false }, (c, col) => {
      const v = texto(c.value)
      if (v) celdas.push({ col, v })
    })

    if (celdas.length === 0) continue

    const distintos = Array.from(new Set(celdas.map(c => c.v)))

    // Un solo valor distinto = título (o la marca de degradación).
    if (distintos.length === 1) {
      if (distintos[0].toUpperCase().includes(MARCA_SIN_DATOS)) {
        if (actual) actual.sinDatos = true
        continue
      }
      actual = nuevo(distintos[0])
      continue
    }

    const sinNumeros = celdas.every(c => !/^-?[\d.,]+$/.test(c.v))

    if (actual && sinNumeros && celdas.length >= 3) {
      // Si el bloque en curso ya tiene datos, este encabezado abre otra tabla
      // bajo el mismo título.
      if (actual.filas.length > 0 || actual.encabezado.length > 0) {
        actual = nuevo(actual.titulo)
      }
      const destino = actual
      destino.encabezado = celdas.map(c => c.v)
      for (const c of celdas) destino.mapa[c.v] = c.col
      continue
    }

    if (actual && actual.encabezado.length > 0) actual.filas.push(i)
  }

  return bloques
}

/**
 * Valor de una celda, ignorando las continuaciones de una combinación vertical.
 *
 * exceljs replica el valor del maestro en todas las celdas del rango combinado.
 * En la hoja `Tablero`, los totales de cada universo van en celdas combinadas de
 * dos filas de alto, así que el renglón de abajo —visualmente vacío— devolvía
 * las mismas cifras y cada total se contaba **dos veces**.
 *
 * Se resuelve preguntando por la combinación en vez de adivinar por el
 * contenido: descartar duplicados consecutivos también habría funcionado aquí,
 * pero borraría dos filas legítimamente iguales el día que existan.
 */
function valorCelda(fila: ExcelJS.Row, col: number): unknown {
  const celda = fila.getCell(col)
  const maestro = celda.isMerged ? celda.master : null
  if (maestro && maestro.row !== celda.row) return null
  return celda.value
}

/**
 * Lee las filas de un bloque con el mapa de columnas ya resuelto. Descarta las
 * que salen completamente nulas: son los renglones en blanco que quedan dentro
 * del rango combinado.
 */
function filasDeBloque(
  ws: ExcelJS.Worksheet,
  bloque: Bloque,
  cols: Col[],
): Record<string, unknown>[] {
  const filas: Record<string, unknown>[] = []
  let orden = 0

  for (const n of bloque.filas) {
    const fila = ws.getRow(n)
    const registro: Record<string, unknown> = { fila: n, orden }
    let algo = false

    for (const c of cols) {
      const col = bloque.mapa[c.xls]
      const valor = col ? leerCelda(valorCelda(fila, col), c.t) : null
      registro[c.campo] = valor
      if (valor !== null && valor !== undefined && valor !== '') algo = true
    }

    if (!algo) continue
    orden++
    filas.push(registro)
  }

  return filas
}

// ── Definición de columnas, hoja por hoja ────────────────────────────────────

const MOVIMIENTOS: Col[] = [
  { xls: 'FUENTE_UNIVERSO', campo: 'fuente_universo', t: 'texto' },
  { xls: 'SITUACION_TEMPORAL', campo: 'situacion_temporal', t: 'texto' },
  { xls: 'EN_PERIODO_ANALIZADO', campo: 'en_periodo_analizado', t: 'bool' },
  { xls: 'ESTADO_MOVIMIENTO', campo: 'estado_movimiento', t: 'texto' },
  { xls: 'MOTIVO_VALIDACION', campo: 'motivo_validacion', t: 'texto' },
  { xls: 'AFECTA_SALDO_AL_CORTE', campo: 'afecta_saldo_al_corte', t: 'bool' },
  { xls: 'CUENTA_EN_RANKING_PERIODO', campo: 'cuenta_en_ranking_periodo', t: 'bool' },
  { xls: 'CUENTA_PARA_META', campo: 'cuenta_para_meta', t: 'bool' },
  { xls: 'CUENTA_PARA_META_EN_PERIODO', campo: 'cuenta_para_meta_en_periodo', t: 'bool' },
  { xls: 'TIPO_MOVIMIENTO', campo: 'tipo_movimiento', t: 'texto' },
  { xls: 'FECHA_MOVIMIENTO', campo: 'fecha_movimiento', t: 'fecha' },
  { xls: 'CLAVE', campo: 'clave', t: 'texto' },
  { xls: 'TIPO_INVERSION_BASE', campo: 'tipo_inversion_base', t: 'texto' },
  { xls: 'CODIGO_CLIENTE', campo: 'codigo_cliente', t: 'texto' },
  { xls: 'CODIGO_INVERSION', campo: 'codigo_inversion', t: 'texto' },
  { xls: 'CODIGO_EJECUTIVO', campo: 'codigo_ejecutivo', t: 'texto' },
  { xls: 'SITUACION_INVERSION', campo: 'situacion_inversion', t: 'texto' },
  { xls: 'TIPO_RELACION', campo: 'tipo_relacion', t: 'texto' },
  { xls: 'GERENTE_EJECUTIVO', campo: 'gerente_ejecutivo', t: 'texto' },
  { xls: 'GERENTE_INVERSION', campo: 'gerente_inversion', t: 'texto' },
  { xls: 'EJECUTIVO', campo: 'ejecutivo', t: 'texto' },
  { xls: 'INVERSIONISTA', campo: 'inversionista', t: 'texto' },
  { xls: 'GENERACION', campo: 'generacion', t: 'texto' },
  { xls: 'TIPO_COLABORADOR', campo: 'tipo_colaborador', t: 'texto' },
  { xls: 'BANCO_INVERSION', campo: 'banco_inversion', t: 'texto' },
  { xls: 'CLABE_INVERSION', campo: 'clabe_inversion', t: 'clabe' },
  { xls: 'TIENE_DATOS_BANCARIOS', campo: 'tiene_datos_bancarios', t: 'bool' },
  { xls: 'MEDIO_SUGERIDO_POR_DATOS_BANCARIOS', campo: 'medio_sugerido_por_datos_bancarios', t: 'texto' },
  { xls: 'MEDIO_MOVIMIENTO', campo: 'medio_movimiento', t: 'texto' },
  { xls: 'NIVEL_CONFIANZA_MEDIO', campo: 'nivel_confianza_medio', t: 'texto' },
  { xls: 'FUENTE_MEDIO_MOVIMIENTO', campo: 'fuente_medio_movimiento', t: 'texto' },
  { xls: 'VALIDACION_MEDIO_MOVIMIENTO', campo: 'validacion_medio_movimiento', t: 'texto' },
  { xls: 'OBSERVACION_MEDIO_MOVIMIENTO', campo: 'observacion_medio_movimiento', t: 'texto' },
  { xls: 'MONTO_MOVIMIENTO', campo: 'monto_movimiento', t: 'num' },
  { xls: 'MONTO_PARA_META', campo: 'monto_para_meta', t: 'num' },
  { xls: 'MONTO_EFECTIVO_MOVIMIENTO', campo: 'monto_efectivo_movimiento', t: 'num' },
  { xls: 'MONTO_TRANSFERENCIA_MOVIMIENTO', campo: 'monto_transferencia_movimiento', t: 'num' },
  { xls: 'TRANSFERENCIA_INFORMADA_EN_TEXTO', campo: 'transferencia_informada_en_texto', t: 'bool' },
  { xls: 'MONTO_TRANSFERENCIA', campo: 'monto_transferencia', t: 'num' },
  { xls: 'TOTAL_INCREMENTOS_EFECTIVO_FUENTE', campo: 'total_incrementos_efectivo_fuente', t: 'num' },
  { xls: 'TOTAL_INCREMENTOS_TRANSFERENCIA_FUENTE', campo: 'total_incrementos_transferencia_fuente', t: 'num' },
  { xls: 'DIFERENCIA_EFECTIVO_VS_FUENTE', campo: 'diferencia_efectivo_vs_fuente', t: 'num' },
  { xls: 'DIFERENCIA_TRANSFERENCIA_VS_FUENTE', campo: 'diferencia_transferencia_vs_fuente', t: 'num' },
  { xls: 'SALDO_ANTES_MOVIMIENTO', campo: 'saldo_antes_movimiento', t: 'num' },
  { xls: 'SALDO_DESPUES_MOVIMIENTO', campo: 'saldo_despues_movimiento', t: 'num' },
  { xls: 'PORCENTAJE_SOBRE_SALDO_ANTES', campo: 'porcentaje_sobre_saldo_antes', t: 'num' },
  { xls: 'SALDO_VIGENTE_AL_CORTE', campo: 'saldo_vigente_al_corte', t: 'num' },
  { xls: 'MONTO_ORIGINAL', campo: 'monto_original', t: 'num' },
  { xls: 'MONTO_TOTAL_REGISTRADO', campo: 'monto_total_registrado', t: 'num' },
  { xls: 'APERTURA', campo: 'apertura', t: 'fecha' },
  { xls: 'FECHA_FIN', campo: 'fecha_fin', t: 'fecha' },
  { xls: 'PLAZO_CONTRACTUAL_MESES', campo: 'plazo_contractual_meses', t: 'int' },
  { xls: 'MESES_EFECTIVOS_MOVIMIENTO', campo: 'meses_efectivos_movimiento', t: 'num' },
  { xls: 'FACTOR_TIEMPO', campo: 'factor_tiempo', t: 'num' },
  { xls: 'FACTOR_TIPO', campo: 'factor_tipo', t: 'num' },
  { xls: 'VALOR_PONDERADO_RANKING', campo: 'valor_ponderado_ranking', t: 'num' },
  { xls: 'TIPO_PAGO', campo: 'tipo_pago', t: 'texto' },
  { xls: 'TIPO_RENDIMIENTO', campo: 'tipo_rendimiento', t: 'texto' },
  { xls: 'SOBRETASA_ACTUAL', campo: 'sobretasa_actual', t: 'num' },
  { xls: 'SOBRETASA_MOVIMIENTO', campo: 'sobretasa_movimiento', t: 'num' },
  { xls: 'PERIODOS_GRACIA', campo: 'periodos_gracia', t: 'int' },
  { xls: 'ORIGEN_MOVIMIENTO', campo: 'origen_movimiento', t: 'texto' },
  { xls: 'TIPO_PARCHE', campo: 'tipo_parche', t: 'texto' },
  { xls: 'SECUENCIA_MOVIMIENTO', campo: 'secuencia_movimiento', t: 'int' },
  { xls: 'DETALLE_MOVIMIENTO', campo: 'detalle_movimiento', t: 'texto' },
  { xls: 'ARCHIVOS_ORIGEN', campo: 'archivos_origen', t: 'texto' },
]

const CUMPLIMIENTO: Col[] = [
  { xls: 'Mes', campo: 'mes', t: 'fecha' },
  { xls: 'Gerente ejecutivo', campo: 'gerente_ejecutivo', t: 'texto' },
  { xls: 'Gerente inversión', campo: 'gerente_inversion', t: 'texto' },
  { xls: 'Ejecutivo', campo: 'ejecutivo', t: 'texto' },
  { xls: 'Meta mensual $', campo: 'meta_mensual', t: 'num' },
  { xls: 'Nueva $', campo: 'nueva', t: 'num' },
  { xls: 'Renovación $', campo: 'renovacion', t: 'num' },
  { xls: 'Incremento $', campo: 'incremento', t: 'num' },
  { xls: 'Colocación total $', campo: 'colocacion_total', t: 'num' },
  { xls: 'Cumplimiento %', campo: 'cumplimiento_pct', t: 'num' },
  { xls: 'Cumplió', campo: 'cumplio', t: 'bool' },
]

const POSICIONES: Col[] = [
  { xls: 'CLAVE', campo: 'clave', t: 'texto' },
  { xls: 'GERENTE_EJECUTIVO', campo: 'gerente_ejecutivo', t: 'texto' },
  { xls: 'GERENTE_INVERSION', campo: 'gerente_inversion', t: 'texto' },
  { xls: 'nombre', campo: 'ejecutivo', t: 'texto' },
  { xls: 'INVERSIONISTA', campo: 'inversionista', t: 'texto' },
  { xls: 'APERTURA', campo: 'apertura', t: 'fecha' },
  { xls: 'FECHA_FIN', campo: 'fecha_fin', t: 'fecha' },
  { xls: 'MONTO_ORIGINAL', campo: 'monto_original', t: 'num' },
  { xls: 'SALDO_VIGENTE_CORTE', campo: 'saldo_vigente_corte', t: 'num' },
  { xls: 'TOTAL_ABIERTO_HASTA_CORTE', campo: 'total_abierto_hasta_corte', t: 'num' },
  { xls: 'TOTAL_SALIDO_HASTA_CORTE', campo: 'total_salido_hasta_corte', t: 'num' },
  { xls: 'PLAZO', campo: 'plazo', t: 'int' },
  { xls: 'TIPOPAGO', campo: 'tipo_pago', t: 'texto' },
  { xls: 'TIPOREN', campo: 'tipo_rendimiento', t: 'texto' },
  { xls: 'SOBRETASA_ACTUAL', campo: 'sobretasa_actual', t: 'num' },
  { xls: 'ARCHIVOS_ORIGEN', campo: 'archivos_origen', t: 'texto' },
]

const EVENTOS: Col[] = [
  { xls: 'TIPO_EVENTO', campo: 'tipo_evento', t: 'texto' },
  { xls: 'FECHA_EVENTO', campo: 'fecha_evento', t: 'fecha' },
  { xls: 'CLAVE', campo: 'clave', t: 'texto' },
  { xls: 'GERENTE_EJECUTIVO', campo: 'gerente_ejecutivo', t: 'texto' },
  { xls: 'GERENTE_INVERSION', campo: 'gerente_inversion', t: 'texto' },
  { xls: 'nombre', campo: 'ejecutivo', t: 'texto' },
  { xls: 'INVERSIONISTA', campo: 'inversionista', t: 'texto' },
  { xls: 'MONTO_EVENTO', campo: 'monto_evento', t: 'num' },
  { xls: 'MONTO_ORIGINAL', campo: 'monto_original', t: 'num' },
  { xls: 'APERTURA', campo: 'apertura', t: 'fecha' },
  { xls: 'FECHA_FIN', campo: 'fecha_fin', t: 'fecha' },
  { xls: 'SALDO_ANTES_EVENTO', campo: 'saldo_antes_evento', t: 'num' },
  { xls: 'SALDO_DESPUES_EVENTO', campo: 'saldo_despues_evento', t: 'num' },
  { xls: 'PLAZO', campo: 'plazo', t: 'int' },
  { xls: 'TIPOPAGO', campo: 'tipo_pago', t: 'texto' },
  { xls: 'TIPOREN', campo: 'tipo_rendimiento', t: 'texto' },
  { xls: 'SOBRETASA_ACTUAL', campo: 'sobretasa_actual', t: 'num' },
  { xls: 'DETALLE_EVENTO', campo: 'detalle_evento', t: 'texto' },
]

const VALIDACIONES: Col[] = [
  { xls: 'FUENTE_UNIVERSO', campo: 'universo', t: 'texto' },
  { xls: 'tipo_validacion', campo: 'tipo_validacion', t: 'texto' },
  { xls: 'CLAVE', campo: 'clave', t: 'texto' },
  { xls: 'detalle', campo: 'detalle', t: 'texto' },
]

/** Medidas comunes a los tres niveles del ranking, en las dos hojas. */
const RANKING: Col[] = [
  { xls: 'Ranking', campo: 'posicion', t: 'int' },
  { xls: 'Gerente ejecutivo', campo: 'gerente_ejecutivo', t: 'texto' },
  { xls: 'Gerente inversión', campo: 'gerente_inversion', t: 'texto' },
  { xls: 'Ejecutivo', campo: 'ejecutivo', t: 'texto' },
  { xls: 'Nuevas $', campo: 'nuevas', t: 'num' },
  { xls: 'Renovaciones $', campo: 'renovaciones', t: 'num' },
  { xls: 'Incrementos $', campo: 'incrementos', t: 'num' },
  { xls: 'Decrementos $', campo: 'decrementos', t: 'num' },
  { xls: 'Vencimiento natural $', campo: 'vencimiento_natural', t: 'num' },
  { xls: 'Valor nuevas ponderado', campo: 'valor_nuevas_ponderado', t: 'num' },
  { xls: 'Valor renovaciones ponderado', campo: 'valor_renovaciones_ponderado', t: 'num' },
  { xls: 'Valor incrementos ponderado', campo: 'valor_incrementos_ponderado', t: 'num' },
  { xls: 'Producción ponderada $', campo: 'produccion_ponderada', t: 'num' },
  { xls: 'Clientes nuevos', campo: 'clientes_nuevos', t: 'int' },
  { xls: 'Concentración mayor cliente nuevo %', campo: 'concentracion_mayor_cliente', t: 'num' },
  { xls: 'Factor diversificación', campo: 'factor_diversificacion', t: 'num' },
  { xls: 'Vencimientos elegibles $', campo: 'vencimientos_elegibles', t: 'num' },
  { xls: 'Renovado sobre vencimientos $', campo: 'renovado_sobre_vencimientos', t: 'num' },
  { xls: 'Retención vencimientos %', campo: 'retencion_vencimientos', t: 'num' },
  { xls: 'Saldo vigente corte $', campo: 'saldo_vigente_corte', t: 'num' },
  { xls: 'Cartera expuesta $', campo: 'cartera_expuesta', t: 'num' },
  { xls: 'Tasa decremento %', campo: 'tasa_decremento', t: 'num' },
  { xls: 'Puntaje producción', campo: 'puntaje_produccion', t: 'num' },
  { xls: 'Puntaje clientes/diversificación', campo: 'puntaje_clientes', t: 'num' },
  { xls: 'Puntaje retención', campo: 'puntaje_retencion', t: 'num' },
  { xls: 'Penalización decrementos', campo: 'penalizacion_decrementos', t: 'num' },
  { xls: 'Crecimiento neto', campo: 'crecimiento_neto', t: 'num' },
  { xls: 'Meta periodo $', campo: 'meta_periodo', t: 'num' },
  { xls: 'Colocación para meta $', campo: 'colocacion_para_meta', t: 'num' },
  { xls: 'Cumplimiento meta %', campo: 'cumplimiento_meta', t: 'num' },
  { xls: 'Meses cumplidos', campo: 'meses_cumplidos', t: 'int' },
  { xls: 'Meses evaluados', campo: 'meses_evaluados', t: 'int' },
  { xls: 'Puntaje sin meta', campo: 'puntaje_sin_meta', t: 'num' },
  { xls: 'Puntaje meta', campo: 'puntaje_meta', t: 'num' },
  { xls: 'Puntaje', campo: 'puntaje', t: 'num' },
  { xls: 'Lectura', campo: 'lectura', t: 'texto' },
]

/** Medidas del Tablero y de Tablero_Estructura. */
const RESUMEN: Col[] = [
  { xls: 'Gerente', campo: 'gerente_ejecutivo', t: 'texto' },
  { xls: 'Gerente ejecutivo', campo: 'gerente_ejecutivo', t: 'texto' },
  { xls: 'Gerente inversión', campo: 'gerente_inversion', t: 'texto' },
  { xls: 'Ejecutivo', campo: 'ejecutivo', t: 'texto' },
  { xls: 'Generación', campo: 'generacion', t: 'texto' },
  { xls: 'Tipo colaborador', campo: 'tipo_colaborador', t: 'texto' },
  { xls: 'Origen', campo: 'origen', t: 'texto' },
  { xls: 'Ejecutivos', campo: 'ejecutivos', t: 'int' },
  { xls: 'Inv. vigentes', campo: 'inv_vigentes', t: 'int' },
  { xls: 'Vigente', campo: 'vigente', t: 'num' },
  { xls: 'Abierto', campo: 'abierto', t: 'num' },
  { xls: 'Vencido', campo: 'vencido', t: 'num' },
  { xls: 'Crecimiento neto', campo: 'crecimiento_neto', t: 'num' },
]

// ── Resultado ────────────────────────────────────────────────────────────────

export interface ResumenTablero {
  movimientos: number
  cumplimiento: number
  ranking: number
  tableroResumen: number
  posiciones: number
  eventos: number
  validaciones: number
}

export interface LecturaTableroOk {
  ok: true
  movimientos: Record<string, unknown>[]
  cumplimiento: Record<string, unknown>[]
  ranking: Record<string, unknown>[]
  tableroResumen: Record<string, unknown>[]
  posiciones: Record<string, unknown>[]
  eventos: Record<string, unknown>[]
  validaciones: Record<string, unknown>[]
  resumen: ResumenTablero
  degradadas: string[]
  avisos: string[]
}

export type LecturaTablero = LecturaTableroOk | { ok: false; errores: string[] }

const UNIVERSOS = ['CREDIFLEXI', 'RAMI'] as const

/** "Ranking por gerente ejecutivo" → nivel. */
function nivelDeTitulo(titulo: string): 'gerente_ejecutivo' | 'gerente_inversion' | 'ejecutivo' | null {
  const t = titulo.toLowerCase()
  if (t.includes('gerente ejecutivo')) return 'gerente_ejecutivo'
  if (t.includes('gerente de inversión') || t.includes('gerente de inversion')) return 'gerente_inversion'
  if (t.includes('ejecutivo')) return 'ejecutivo'
  return null
}

export function leerTablero(wb: ExcelJS.Workbook): LecturaTablero {
  const hoja = (n: string) => wb.worksheets.find(w => w.name.trim() === n)

  const wsMov = hoja('Historial_Movimientos')
  if (!wsMov) {
    return { ok: false, errores: ['El archivo no trae la hoja `Historial_Movimientos`.'] }
  }

  const avisos: string[] = []
  const degradadas: string[] = []
  const errores: string[] = []

  // ── Movimientos: la única fuente ──────────────────────────────────────────
  const mov = leerPlana(wsMov, 'CLAVE', MOVIMIENTOS)
  if (mov.error) return { ok: false, errores: [mov.error] }
  if (mov.filas.length === 0) {
    return { ok: false, errores: ['`Historial_Movimientos` no trae ninguna fila.'] }
  }

  // Señal de que el generador sigue escribiendo la CLABE como número.
  const conBanco = mov.filas.filter(f => f.banco_inversion !== null).length
  const conClabe = mov.filas.filter(f => f.clabe_inversion !== null).length
  if (conBanco > 0 && conClabe === 0) {
    avisos.push(
      `Ninguna de las ${conBanco} CLABEs del tablero llegó como texto de 18 dígitos, ` +
      'así que no se guardaron. El script que genera el reporte debe escribir esa ' +
      'columna como texto.',
    )
  }

  // ── Hojas planas restantes ────────────────────────────────────────────────
  const wsCump = hoja('Cumplimiento_Metas')
  const cump = wsCump ? leerPlana(wsCump, 'Mes', CUMPLIMIENTO) : { filas: [], error: undefined }
  if (cump.error) errores.push(cump.error)

  const wsVal = hoja('Validaciones')
  const val = wsVal ? leerPlana(wsVal, 'CLAVE', VALIDACIONES) : { filas: [], error: undefined }
  if (val.error) errores.push(val.error)

  const posiciones: Record<string, unknown>[] = []
  const eventos: Record<string, unknown>[] = []

  for (const u of UNIVERSOS) {
    const wsVig = hoja(`${u}_Vigente`)
    if (wsVig) {
      const r = leerPlana(wsVig, 'CLAVE', POSICIONES)
      if (r.error) errores.push(r.error)
      posiciones.push(...r.filas.map(f => ({ ...f, universo: u })))
    }
    for (const grupo of ['abiertos', 'vencidos'] as const) {
      const nombre = `${u}_${grupo === 'abiertos' ? 'Abiertos' : 'Vencidos'}`
      const ws = hoja(nombre)
      if (!ws) continue
      const r = leerPlana(ws, 'CLAVE', EVENTOS)
      if (r.error) errores.push(r.error)
      eventos.push(...r.filas.map(f => ({ ...f, universo: u, grupo })))
    }
  }

  // ── Hojas apiladas: rankings ──────────────────────────────────────────────
  const ranking: Record<string, unknown>[] = []

  for (const [nombre, conMeta] of [
    ['Ranking_Comercial', false],
    ['Ranking_Con_Meta', true],
  ] as const) {
    const ws = hoja(nombre)
    if (!ws) continue

    const bloques = detectarBloques(ws)
    let leidos = 0

    for (const b of bloques) {
      const nivel = nivelDeTitulo(b.titulo)
      if (!nivel) continue          // título de la hoja o nota metodológica
      if (b.sinDatos || b.filas.length === 0) continue

      leidos++
      for (const f of filasDeBloque(ws, b, RANKING)) {
        // `orden` y `fila` no van a esta tabla: la posición ya viene en el dato.
        const { orden: _orden, ...resto } = f
        void _orden
        ranking.push({ ...resto, con_meta: conMeta, nivel })
      }
    }

    if (leidos === 0) {
      // Es el caso del corte del 02/09: periodo de dos días, nada que rankear.
      degradadas.push(nombre)
    }
  }

  if (degradadas.length > 0) {
    avisos.push(
      `Sin datos para rankear en: ${degradadas.join(', ')}. ` +
      'Es normal cuando el periodo lleva pocos días.',
    )
  }

  // ── Hojas apiladas: Tablero y Tablero_Estructura ──────────────────────────
  const tableroResumen: Record<string, unknown>[] = []

  const wsTab = hoja('Tablero')
  if (wsTab) {
    // Los títulos de esta hoja nombran el universo: CREDIFLEXI, RAMI, Totales.
    let universo: string | null = null
    let orden = 0
    for (const b of detectarBloques(wsTab)) {
      const t = b.titulo.toUpperCase()
      if (t === 'CREDIFLEXI' || t === 'RAMI' || t.startsWith('TOTALES')) {
        universo = t.startsWith('TOTALES') ? 'TOTALES' : t
      }
      if (!universo || b.filas.length === 0) continue

      // Dentro de cada universo hay dos tablas: el total (sin columna Gerente) y
      // el desglose por gerente. Se distinguen por el encabezado, no por el
      // orden, para que agregar una tabla no rompa la lectura.
      const esTotal = !('Gerente' in b.mapa)
      for (const f of filasDeBloque(wsTab, b, RESUMEN)) {
        const { orden: _o, fila: _f, ...resto } = f
        void _o; void _f
        tableroResumen.push({
          ...resto,
          hoja: 'Tablero',
          universo,
          nivel: esTotal ? 'total' : 'gerente',
          orden: orden++,
        })
      }
    }
  }

  const wsEst = hoja('Tablero_Estructura')
  if (wsEst) {
    let orden = 0
    for (const b of detectarBloques(wsEst)) {
      if (b.filas.length === 0) continue
      const t = b.titulo.toLowerCase()
      const nivel = t.startsWith('resumen por gerente')
        ? 'gerente_inversion'
        : t.startsWith('detalle por ejecutivo')
          ? 'ejecutivo'
          : t === 'resumen'
            ? 'total'
            : null
      if (!nivel) continue

      for (const f of filasDeBloque(wsEst, b, RESUMEN)) {
        const { orden: _o, fila: _f, ...resto } = f
        void _o; void _f
        tableroResumen.push({
          ...resto,
          hoja: 'Tablero_Estructura',
          universo: null,
          nivel,
          orden: orden++,
        })
      }
    }
  }

  if (errores.length > 0) return { ok: false, errores }

  return {
    ok: true,
    movimientos: mov.filas,
    cumplimiento: cump.filas,
    ranking,
    tableroResumen,
    posiciones,
    eventos,
    validaciones: val.filas,
    resumen: {
      movimientos: mov.filas.length,
      cumplimiento: cump.filas.length,
      ranking: ranking.length,
      tableroResumen: tableroResumen.length,
      posiciones: posiciones.length,
      eventos: eventos.length,
      validaciones: val.filas.length,
    },
    degradadas,
    avisos,
  }
}
