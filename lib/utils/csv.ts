// Construcción de CSV para descarga.
//
// Módulo PURO: sin React, sin Supabase, sin directivas. Recibe columnas y filas
// y devuelve el texto del archivo.
//
// Tres decisiones que no son obvias y que se pagan caro si se omiten:
//
//   1. BOM UTF-8. Sin él, Excel en Windows abre el archivo con la codificación
//      local y "Ríos Osorio" llega como "RÃ­os Osorio". Los nombres de este
//      dominio llevan acentos y ñ; sin BOM el CSV se ve roto y parece culpa del
//      sistema, no del programa que lo abrió.
//
//   2. Neutralización de fórmulas. Excel evalúa como fórmula cualquier celda que
//      empiece con = + - @ (o tabulador / retorno de carro). Como estos CSV
//      llevan texto que alguien capturó a mano, un nombre o una nota pueden
//      convertirse en código al abrir el archivo. Se les antepone un apóstrofo,
//      que Excel usa como marca de texto y no muestra.
//
//   3. Los números NO se neutralizan. Un importe negativo (-958114.57) empieza
//      con '-' y sin esta excepción saldría como texto con apóstrofo — que es
//      exactamente cómo se rompe una suma en Excel. La regla 2 aplica a texto
//      capturado, no a cifras.

const SEPARADOR = ','
const INICIOS_PELIGROSOS = ['=', '+', '-', '@', '\t', '\r']

/** Se ve como número, así que no se neutraliza (ver decisión 3). */
const NUMERICO = /^-?\d+(\.\d+)?$/

export interface ColumnaCsv<T> {
  encabezado: string
  valor: (fila: T) => string | number | null | undefined
}

function celda(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''

  let s = String(v)

  const esNumero = typeof v === 'number' || NUMERICO.test(s)
  if (!esNumero && s.length > 0 && INICIOS_PELIGROSOS.includes(s[0])) {
    s = `'${s}`
  }

  // RFC 4180: se entrecomilla si hay separador, comillas o saltos de línea, y
  // las comillas internas se duplican.
  if (s.includes(SEPARADOR) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    s = `"${s.replace(/"/g, '""')}"`
  }

  return s
}

export function construirCsv<T>(columnas: ColumnaCsv<T>[], filas: T[]): string {
  const lineas = [
    columnas.map(c => celda(c.encabezado)).join(SEPARADOR),
    ...filas.map(f => columnas.map(c => celda(c.valor(f))).join(SEPARADOR)),
  ]
  // \r\n por RFC 4180 y porque es lo que espera Excel en Windows.
  // \uFEFF = BOM (decisión 1).
  return '\uFEFF' + lineas.join('\r\n') + '\r\n'
}

/**
 * Cabeceras de una descarga de CSV.
 * `private, no-store` porque estos archivos pueden llevar datos personales y no
 * tienen por qué quedarse en caches intermedios.
 */
export function cabecerasCsv(nombreArchivo: string): Record<string, string> {
  // Comillas y barras invertidas romperían el header; no hay nombre legítimo
  // que las lleve.
  const limpio = nombreArchivo.replace(/["\\]/g, '')
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${limpio}"`,
    'Cache-Control': 'private, no-store',
  }
}
