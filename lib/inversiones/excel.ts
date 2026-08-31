/**
 * Lectura de los reportes de inversiones. Módulo puro: recibe un buffer y
 * devuelve lo que trae el archivo, o por qué no se puede usar. No sabe de
 * Supabase ni de React, para que se pueda probar sin levantar nada.
 *
 * En I1 solo se lee el ENCABEZADO: qué reporte es, de qué periodo, sus notas
 * metodológicas y qué hojas vinieron degradadas. Los hechos (las 20 columnas del
 * calendario, las 66 del tablero) se parsean en I2 e I4.
 *
 * Análisis de origen de los archivos en RESEARCH §14.
 */

import ExcelJS from 'exceljs'

export type TipoReporte = 'calendario' | 'tablero'

/** Hoja que identifica sin ambigüedad al Tablero Ejecutivo. */
const HOJA_TABLERO = 'historial_movimientos'
/** Las hojas del Calendario llevan el mes pegado: `BASE 08`, `CALENDARIO 08`. */
const RE_HOJA_BASE = /^base\s+\d{1,2}$/i
const RE_HOJA_CALENDARIO = /^calendario\s+\d{1,2}$/i

/** Marca que el generador escribe cuando una hoja no tuvo con qué llenarse. */
const MARCA_SIN_DATOS = 'SIN_DATOS'

export interface Encabezado {
  tipo: TipoReporte
  periodoInicio: string           // YYYY-MM-DD
  periodoFin: string              // YYYY-MM-DD
  hojas: string[]
  notas: Record<string, string>   // hoja → texto metodológico
  hojasDegradadas: string[]
  avisos: string[]
}

export type LecturaEncabezado =
  | { ok: true; encabezado: Encabezado }
  | { ok: false; errores: string[] }

/**
 * exceljs devuelve `.value` con formas distintas según la celda: string, número,
 * fecha, `{ formula, result }` para fórmulas y `{ richText: [...] }` para texto
 * con formato. Los encabezados de estos archivos vienen con formato, así que sin
 * aplanar el richText las notas metodológicas salen vacías.
 */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor.trim()
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'object') {
    const v = valor as { richText?: { text: string }[]; result?: unknown; text?: string }
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('').trim()
    if (v.result !== undefined) return texto(v.result)
    if (typeof v.text === 'string') return v.text.trim()
  }
  return ''
}

/** Las primeras `n` filas de una hoja, aplanadas a texto. */
function primerasFilas(ws: ExcelJS.Worksheet, n: number): string[][] {
  const filas: string[][] = []
  for (let i = 1; i <= Math.min(n, ws.rowCount || n); i++) {
    const fila = ws.getRow(i)
    const celdas: string[] = []
    fila.eachCell({ includeEmpty: true }, c => celdas.push(texto(c.value)))
    filas.push(celdas)
  }
  return filas
}

function ultimoDiaDelMes(anio: number, mes: number): string {
  // Día 0 del mes siguiente = último del actual. Sirve para febrero y bisiestos.
  const d = new Date(Date.UTC(anio, mes, 0))
  return d.toISOString().slice(0, 10)
}

function detectarTipo(wb: ExcelJS.Workbook): TipoReporte | null {
  const nombres = wb.worksheets.map(w => w.name.trim())
  if (nombres.some(n => n.toLowerCase() === HOJA_TABLERO)) return 'tablero'
  if (nombres.some(n => RE_HOJA_BASE.test(n))) return 'calendario'
  return null
}

/**
 * Calendario: el periodo vive en el título de la hoja de vista.
 *   "CALENDARIO DE PAGOS A FONDEADORES — 08/2026"
 * El periodo es el mes completo, no hasta donde llegue el dato: es un reporte
 * prospectivo y su alcance es el mes.
 */
function periodoCalendario(wb: ExcelJS.Workbook): { inicio: string; fin: string } | null {
  const hoja = wb.worksheets.find(w => RE_HOJA_CALENDARIO.test(w.name.trim()))
    ?? wb.worksheets.find(w => RE_HOJA_BASE.test(w.name.trim()))
  if (!hoja) return null

  for (const fila of primerasFilas(hoja, 4)) {
    for (const celda of fila) {
      const m = celda.match(/(\d{1,2})\s*\/\s*(\d{4})/)
      if (m) {
        const mes = Number(m[1])
        const anio = Number(m[2])
        if (mes >= 1 && mes <= 12) {
          return {
            inicio: `${anio}-${String(mes).padStart(2, '0')}-01`,
            fin: ultimoDiaDelMes(anio, mes),
          }
        }
      }
    }
  }
  return null
}

/**
 * Tablero: el periodo viene escrito literalmente.
 *   "Periodo analizado: 01/08/2026 al 27/08/2026"
 */
function periodoTablero(wb: ExcelJS.Workbook): { inicio: string; fin: string } | null {
  const iso = (d: string, m: string, a: string) =>
    `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

  for (const ws of wb.worksheets) {
    for (const fila of primerasFilas(ws, 5)) {
      for (const celda of fila) {
        const m = celda.match(
          /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+al\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
        )
        if (m) {
          return { inicio: iso(m[1], m[2], m[3]), fin: iso(m[4], m[5], m[6]) }
        }
      }
    }
  }
  return null
}

/**
 * Las notas metodológicas son las filas de una sola celda larga al principio de
 * cada hoja: la fórmula del ranking, la definición de meta, la convención de
 * signos. No son adorno — sin ellas nadie puede explicar un puntaje. Se guardan
 * por carga porque el script que las escribe puede cambiarlas.
 */
function notasMetodologicas(wb: ExcelJS.Workbook): Record<string, string> {
  const notas: Record<string, string> = {}
  for (const ws of wb.worksheets) {
    const lineas: string[] = []
    for (const fila of primerasFilas(ws, 8)) {
      const conTexto = fila.filter(Boolean)
      // Una sola celda y con cuerpo = es prosa, no un encabezado de tabla.
      if (conTexto.length === 1 && conTexto[0].length > 25) lineas.push(conTexto[0])
    }
    if (lineas.length > 0) notas[ws.name.trim()] = lineas.join('\n')
  }
  return notas
}

/**
 * Una hoja puede llegar vacía con la marca SIN_DATOS — le pasa a los rankings
 * cuando el periodo lleva pocos días. Es parte del contrato del archivo, no una
 * anomalía: se registra para que la pantalla lo explique en vez de mostrar una
 * tabla vacía que parece rota.
 */
function hojasDegradadas(wb: ExcelJS.Workbook): string[] {
  const degradadas: string[] = []
  for (const ws of wb.worksheets) {
    const hay = primerasFilas(ws, 12).some(f =>
      f.some(c => c.toUpperCase().includes(MARCA_SIN_DATOS)),
    )
    if (hay) degradadas.push(ws.name.trim())
  }
  return degradadas
}

export async function leerEncabezado(buffer: ArrayBuffer): Promise<LecturaEncabezado> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer)
  } catch {
    return { ok: false, errores: ['El archivo no se pudo abrir como .xlsx. ¿Está completo?'] }
  }

  if (wb.worksheets.length === 0) {
    return { ok: false, errores: ['El archivo no tiene ninguna hoja.'] }
  }

  const tipo = detectarTipo(wb)
  if (!tipo) {
    return {
      ok: false,
      errores: [
        'No se reconoce el reporte. Se esperaba el Calendario de Pagos (con una hoja `BASE MM`) ' +
        'o el Tablero Ejecutivo (con la hoja `Historial_Movimientos`).',
        `Hojas encontradas: ${wb.worksheets.map(w => w.name).join(', ')}`,
      ],
    }
  }

  const periodo = tipo === 'calendario' ? periodoCalendario(wb) : periodoTablero(wb)
  if (!periodo) {
    return {
      ok: false,
      errores: [
        tipo === 'calendario'
          ? 'No se encontró el mes en el título de la hoja (se esperaba algo como "— 08/2026").'
          : 'No se encontró la línea "Periodo analizado: DD/MM/AAAA al DD/MM/AAAA".',
      ],
    }
  }

  const avisos: string[] = []

  // El corte no es un dato confiable: ya llegó un archivo con corte 02/09
  // entregado el 29/08, y nadie supo explicar por qué (RESEARCH §14.6). Se marca
  // para que no se vuelva "el vigente" sin que nadie lo note.
  const hoy = new Date().toISOString().slice(0, 10)
  if (periodo.fin > hoy) {
    avisos.push(
      `El periodo de este archivo termina el ${periodo.fin}, que todavía no llega. ` +
      'Verifica que sea el corte que querías subir.',
    )
  }

  const degradadas = hojasDegradadas(wb)
  if (degradadas.length > 0) {
    avisos.push(
      `Sin datos suficientes en: ${degradadas.join(', ')}. ` +
      'Es normal cuando el periodo lleva pocos días.',
    )
  }

  return {
    ok: true,
    encabezado: {
      tipo,
      periodoInicio: periodo.inicio,
      periodoFin: periodo.fin,
      hojas: wb.worksheets.map(w => w.name.trim()),
      notas: notasMetodologicas(wb),
      hojasDegradadas: degradadas,
      avisos,
    },
  }
}

/** Etiqueta legible de un reporte, para pantallas y mensajes. */
export const NOMBRE_REPORTE: Record<TipoReporte, string> = {
  calendario: 'Calendario de Pagos a Fondeadores',
  tablero: 'Tablero Ejecutivo de Cartera de Inversiones',
}
