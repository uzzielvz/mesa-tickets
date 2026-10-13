// Utilidades de texto para los PDF de vacaciones (constancia e informe).
// Solo servidor.

import type { PDFFont } from 'pdf-lib'

/**
 * Helvetica de pdf-lib solo codifica WinAnsi. Lo que no cabe (un carácter raro
 * en un nombre o una nota) se cambia por su letra base o por "?", en vez de
 * tumbar la descarga.
 */
export function ansi(texto: string): string {
  const especiales = '“”‘’–—…•€'
  let out = ''
  for (const ch of texto.replace(/[\r\n\t]+/g, ' ')) {
    const c = ch.codePointAt(0)!
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || especiales.includes(ch)) {
      out += ch
    } else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      out += /^[\x20-\x7e]+$/.test(base) ? base : '?'
    }
  }
  return out
}

/** El texto más grande que quepa en `ancho`, sin bajar de `minimo`; si ni así, se corta con "…". */
export function ajustar(font: PDFFont, texto: string, size: number, ancho: number, minimo = 6): { texto: string; size: number } {
  let s = size
  while (s > minimo && font.widthOfTextAtSize(texto, s) > ancho) s -= 0.25
  if (font.widthOfTextAtSize(texto, s) <= ancho) return { texto, size: s }
  let t = texto
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, s) > ancho) t = t.slice(0, -1)
  return { texto: `${t}…`, size: s }
}

export function envolver(font: PDFFont, texto: string, size: number, ancho: number): string[] {
  const lineas: string[] = []
  let actual = ''
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (font.widthOfTextAtSize(prueba, size) <= ancho) {
      actual = prueba
    } else {
      if (actual) lineas.push(actual)
      actual = palabra
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}
