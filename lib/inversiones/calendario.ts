/**
 * Parseo del Calendario de Pagos a Fondeadores (I2).
 *
 * Módulo PURO: recibe un libro ya abierto y devuelve filas o errores. No sabe de
 * Supabase ni de React.
 *
 * **Solo se lee la hoja `BASE MM`.** La hoja `CALENDARIO MM` es un pivote exacto
 * de BASE — verificado al centavo en las cinco secciones (RESEARCH §14.1) — así
 * que guardarla sería mantener dos versiones del mismo dato. Se regenera cuando
 * alguien la quiera.
 *
 * ── La regla que hay que entender antes de tocar esto ─────────────────────────
 *
 * El archivo trae DOS columnas que se llaman casi igual y significan cosas
 * distintas. Confundirlas da cifras equivocadas con cara de correctas:
 *
 *   TIPO_PAGO              'C' = devolución de capital · 'R' = rendimiento
 *   TIPOPAGO               'Mensual' | 'Al plazo'  → cada cuándo se paga el
 *                          rendimiento durante la vida de la inversión
 *
 * Aquí se llaman `tipo_pago` y `periodicidad` para que no se puedan confundir.
 *
 * `SECCION` es la clasificación que **el propio archivo** ya hizo, y es la buena:
 *
 *   SECCION = 'RETIRO FONDEADORES'          si TIPO_PAGO = 'C'
 *           = mapa(FORMA_PAGO_CALENDARIO)   si TIPO_PAGO = 'R'
 *
 * Nótese que TIPO_PAGO manda sobre la forma de pago. Eso importa: en agosto hay
 * una devolución de capital de 714,000 cuya `FORMA_PAGO_CALENDARIO` dice
 * "AL PLAZO" pero que **sí sale de caja**, porque es capital que se le regresa al
 * inversionista al vencimiento. Agrupar por forma de pago en vez de por sección
 * la contaría como capitalizada y subestimaría la salida de efectivo del mes en
 * tres cuartos de millón.
 *
 * Por eso: **lo que no sale de caja es la SECCIÓN de capitalizadas, no la forma
 * de pago.**
 */

import type ExcelJS from 'exceljs'
import { RE_HOJA_BASE, texto } from '@/lib/inversiones/excel'

/** Las cinco secciones que el generador produce hoy. */
export const SECCIONES = [
  'RETIRO FONDEADORES',
  'PAGO A FONDEADORES — TRANSFERENCIAS',
  'FONDEADORES CON PAGO EN EFECTIVO',
  'INVERSIONES CAPITALIZADAS AL PLAZO',
  'REVISAR MEDIO DE PAGO',
] as const

/**
 * La única sección que NO sale de caja: el rendimiento se capitaliza en vez de
 * pagarse. Regla 2 de `PLAN.md §9.2`.
 */
export const SECCION_CAPITALIZA = 'INVERSIONES CAPITALIZADAS AL PLAZO'

/** Sección de los casos sin medio de pago determinable. */
export const SECCION_REVISAR = 'REVISAR MEDIO DE PAGO'

export interface PagoCalendario {
  fila: number
  indice_origen: number | null
  clave: string
  monto: number
  inversionista: string | null
  fecha_pago: string | null      // YYYY-MM-DD
  tipo_pago: string | null       // 'C' | 'R'
  universo: string | null        // 'CREDI' | 'RAMI'
  forma_pago: string | null
  nombre_cl: string | null
  periodicidad: string | null    // TIPOPAGO
  tipo_rendimiento: string | null // TIPOREN
  banco: string | null           // IBNOMBRE
  // `CLABE` NO se guarda: llega corrompida. Ver `clabesRotas()` y la migración
  // inv_007.
  gerente_inversion: string | null
  gerente_ejecutivo: string | null
  ejecutivo: string | null
  fuente_catalogo: string | null
  seccion: string
  dia: number | null
}

export interface ValidacionCalendario {
  fila: number
  universo: string | null
  clave: string | null
  inversionista: string | null
  observacion: string | null
}

export interface ResumenCalendario {
  filas: number
  total: number
  capitalizado: number
  salidas: number
  revisar: number
}

export type LecturaCalendario =
  | {
      ok: true
      pagos: PagoCalendario[]
      validaciones: ValidacionCalendario[]
      resumen: ResumenCalendario
      avisos: string[]
    }
  | { ok: false; errores: string[] }

/** Columnas sin las que la fila no significa nada. */
const REQUERIDAS = ['CLAVE', 'MONTO', 'TIPO_PAGO', 'SECCION', 'DIA'] as const

/** Encabezado → índice de columna (1-based, como exceljs). */
function mapaColumnas(ws: ExcelJS.Worksheet): Record<string, number> {
  const mapa: Record<string, number> = {}
  ws.getRow(1).eachCell({ includeEmpty: false }, (celda, col) => {
    const nombre = texto(celda.value)
    if (nombre) mapa[nombre] = col
  })
  return mapa
}

/**
 * Importes al centavo.
 *
 * `Number` es binario y no representa exactamente los decimales; sumar 201
 * importes en punto flotante puede desviarse del total del Excel. Se redondea
 * cada importe a dos decimales al leerlo y las sumas se hacen en centavos
 * enteros (ver `sumar`), que es donde de verdad se juega el "al centavo".
 */
function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return Math.round(valor * 100) / 100
  if (typeof valor === 'object') {
    const v = valor as { result?: unknown }
    if (v.result !== undefined) return numero(v.result)
  }
  const s = texto(valor).replace(/[$,\s]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** Suma en centavos enteros y regresa pesos. Evita el arrastre del flotante. */
function sumar(valores: number[]): number {
  const centavos = valores.reduce((acc, v) => acc + Math.round(v * 100), 0)
  return centavos / 100
}

/**
 * Fecha en `YYYY-MM-DD`.
 *
 * exceljs entrega las fechas como `Date` en UTC. Se corta el ISO en seco y NO se
 * convierte a zona local: hacerlo movería un pago del día 1 al día anterior en
 * cualquier servidor al oeste de Greenwich — y este archivo se lee en Vercel,
 * que corre en UTC, pero se mira desde México.
 */
function fecha(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  const s = texto(valor)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/**
 * La CLAVE es un identificador, no un número: `001753001` con ceros a la
 * izquierda. Si el generador la escribiera alguna vez como número, Excel se
 * comería los ceros; se restauran al ancho que traen todas las demás.
 */
function clave(valor: unknown, ancho: number): string {
  if (typeof valor === 'number') return String(valor).padStart(ancho, '0')
  return texto(valor)
}

function nulo(s: string): string | null {
  return s === '' ? null : s
}

export function leerCalendario(wb: ExcelJS.Workbook): LecturaCalendario {
  const ws = wb.worksheets.find(w => RE_HOJA_BASE.test(w.name.trim()))
  if (!ws) {
    return {
      ok: false,
      errores: ['No se encontró la hoja de datos `BASE MM` dentro del archivo.'],
    }
  }

  const col = mapaColumnas(ws)
  const faltantes = REQUERIDAS.filter(c => !(c in col))
  if (faltantes.length > 0) {
    return {
      ok: false,
      errores: [
        `A la hoja ${ws.name} le faltan columnas: ${faltantes.join(', ')}.`,
        `Columnas encontradas: ${Object.keys(col).join(', ')}`,
      ],
    }
  }

  const avisos: string[] = []
  const pagos: PagoCalendario[] = []
  const seccionesDesconocidas = new Set<string>()
  const sinFecha: string[] = []
  // Se cuentan aunque no se guarden: es la única señal de que el generador
  // aguas arriba sigue escribiendo la CLABE como número. Ver inv_007.
  let clabes = 0
  let clabesRotas = 0

  // Ancho de la clave más frecuente, para restaurar ceros si alguna llega numérica.
  const anchoClave = 9

  const v = (fila: ExcelJS.Row, nombre: string): unknown =>
    nombre in col ? fila.getCell(col[nombre]).value : null

  for (let i = 2; i <= ws.rowCount; i++) {
    const fila = ws.getRow(i)
    const cve = clave(v(fila, 'CLAVE'), anchoClave)
    const monto = numero(v(fila, 'MONTO'))
    const seccion = texto(v(fila, 'SECCION'))

    // Fila vacía de relleno al final de la hoja: sin clave y sin importe.
    if (!cve && monto === null && !seccion) continue

    if (!seccion) {
      return {
        ok: false,
        errores: [`La fila ${i} de ${ws.name} no trae SECCION. No se puede clasificar el pago.`],
      }
    }
    if (!(SECCIONES as readonly string[]).includes(seccion)) {
      seccionesDesconocidas.add(seccion)
    }

    const f = fecha(v(fila, 'FECHA_PAGO'))
    if (!f) sinFecha.push(cve || `fila ${i}`)

    // Una CLABE bien escrita es texto de exactamente 18 dígitos. Si llega como
    // número, Excel ya le comió los ceros de la izquierda y float64 le alteró
    // los últimos dígitos: deja de ser una cuenta bancaria y pasa a ser un
    // número parecido a una.
    const clabeCruda = v(fila, 'CLABE')
    if (clabeCruda !== null && clabeCruda !== undefined && clabeCruda !== '') {
      clabes++
      if (typeof clabeCruda !== 'string' || !/^\d{18}$/.test(clabeCruda.trim())) {
        clabesRotas++
      }
    }

    const diaCrudo = numero(v(fila, 'DIA'))

    pagos.push({
      fila: i,
      // Columna sin nombre que pandas arrastra: el índice del registro en la
      // fuente de Felix. No sirve para nada aquí, pero permite rastrear una fila
      // hasta su archivo de origen si algún día no cuadra.
      indice_origen: numero(v(fila, 'Unnamed: 0')),
      clave: cve,
      // Un pago sin importe es 0, no nulo: hay filas legítimas en 0 (ver la
      // clave 001284001 de agosto) y convertirlas en NULL rompería las sumas.
      monto: monto ?? 0,
      inversionista: nulo(texto(v(fila, 'INVERSIONISTA'))),
      fecha_pago: f,
      tipo_pago: nulo(texto(v(fila, 'TIPO_PAGO'))),
      universo: nulo(texto(v(fila, 'UNIVERSO'))),
      forma_pago: nulo(texto(v(fila, 'FORMA_PAGO_CALENDARIO'))),
      nombre_cl: nulo(texto(v(fila, 'NOMBRE_CL'))),
      periodicidad: nulo(texto(v(fila, 'TIPOPAGO'))),
      tipo_rendimiento: nulo(texto(v(fila, 'TIPOREN'))),
      banco: nulo(texto(v(fila, 'IBNOMBRE'))),
      gerente_inversion: nulo(texto(v(fila, 'GERENTE_INVERSION'))),
      gerente_ejecutivo: nulo(texto(v(fila, 'GERENTE_EJECUTIVO'))),
      ejecutivo: nulo(texto(v(fila, 'EJECUTIVO'))),
      fuente_catalogo: nulo(texto(v(fila, 'FUENTE_CATALOGO'))),
      seccion,
      dia: diaCrudo === null ? null : Math.trunc(diaCrudo),
    })
  }

  if (pagos.length === 0) {
    return { ok: false, errores: [`La hoja ${ws.name} no tiene ninguna fila de datos.`] }
  }

  // Una sección nueva no es un error: el generador puede agregar uno. Pero hay
  // que verlo, porque si nadie la clasifica queda fuera de los agregados.
  if (seccionesDesconocidas.size > 0) {
    avisos.push(
      `Sección no reconocida: ${Array.from(seccionesDesconocidas).join(', ')}. ` +
      'Se guardó tal cual, pero revisa si debe contar como salida de caja.',
    )
  }
  if (sinFecha.length > 0) {
    avisos.push(
      `${sinFecha.length} pago(s) sin fecha legible (${sinFecha.slice(0, 3).join(', ')}` +
      `${sinFecha.length > 3 ? '…' : ''}).`,
    )
  }
  if (clabesRotas > 0) {
    avisos.push(
      `${clabesRotas} de ${clabes} CLABEs vienen como número en el archivo y perdieron ` +
      'dígitos, así que no se guardan. Para arreglarlo, el script que genera el ' +
      'reporte debe escribir esa columna como texto.',
    )
  }

  const total = sumar(pagos.map(p => p.monto))
  const capitalizado = sumar(pagos.filter(p => p.seccion === SECCION_CAPITALIZA).map(p => p.monto))

  const validaciones = leerValidaciones(wb)

  return {
    ok: true,
    pagos,
    validaciones,
    resumen: {
      filas: pagos.length,
      total,
      capitalizado,
      // Se resta en vez de volver a sumar: así `capitalizado + salidas` es
      // exactamente `total` por construcción, y no por suerte del redondeo.
      salidas: Math.round((total - capitalizado) * 100) / 100,
      revisar: pagos.filter(p => p.seccion === SECCION_REVISAR).length,
    },
    avisos,
  }
}

/**
 * Hoja VALIDACIONES: los casos que el script de Felix no pudo clasificar. No es
 * un anexo — es la lista de trabajo de Tesorería, porque son pagos programados
 * sin medio de pago determinado.
 */
function leerValidaciones(wb: ExcelJS.Workbook): ValidacionCalendario[] {
  const ws = wb.worksheets.find(w => w.name.trim().toUpperCase().startsWith('VALIDACIONES'))
  if (!ws) return []

  const col = mapaColumnas(ws)
  const filas: ValidacionCalendario[] = []

  for (let i = 2; i <= ws.rowCount; i++) {
    const fila = ws.getRow(i)
    const val = (n: string) => (n in col ? nulo(texto(fila.getCell(col[n]).value)) : null)
    const cve = val('CLAVE')
    const obs = val('OBSERVACION')
    if (!cve && !obs) continue
    filas.push({
      fila: i,
      universo: val('UNIVERSO'),
      clave: cve,
      inversionista: val('INVERSIONISTA'),
      observacion: obs,
    })
  }
  return filas
}
