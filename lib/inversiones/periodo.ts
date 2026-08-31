/**
 * Etiquetas de periodo. Archivo aparte de `excel.ts` a propósito: aquél importa
 * `exceljs`, que es Node puro y no puede llegar al navegador. Esto lo llaman las
 * dos mitades.
 *
 * Y sin `'use client'`, por la lección del 2026-08-18 (RESEARCH §5.6): una
 * función que llaman servidor y cliente no puede vivir en un archivo marcado
 * como cliente — renderizar su export es válido, invocarlo revienta, y
 * `next build` no lo detecta.
 */

import type { TipoReporte } from './excel'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** '2026-08-15' → '15 de agosto de 2026' */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  return `${d} de ${MESES[m - 1]} de ${a}`
}

/** '2026-08-15' → '15 ago' */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  if (!m || !d) return iso
  return `${d} ${MESES[m - 1].slice(0, 3)}`
}

/**
 * Cómo se nombra el periodo de una carga, que no es igual para los dos reportes:
 * el Calendario cubre un mes completo y se lee como mes; el Tablero es un rango
 * que termina en su fecha de corte y se lee como corte.
 */
export function etiquetaPeriodo(
  tipo: TipoReporte,
  inicio: string,
  fin: string,
): string {
  if (tipo === 'calendario') {
    const [a, m] = inicio.split('-').map(Number)
    return `${MESES[m - 1]} ${a}`
  }
  return `corte al ${fechaLarga(fin)}`
}

/** Versión compacta, para listas y tablas. */
export function etiquetaPeriodoCorta(
  tipo: TipoReporte,
  inicio: string,
  fin: string,
): string {
  if (tipo === 'calendario') {
    const [a, m] = inicio.split('-').map(Number)
    return `${MESES[m - 1].slice(0, 3)} ${a}`
  }
  return `al ${fechaCorta(fin)}`
}
