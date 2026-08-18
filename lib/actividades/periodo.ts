/**
 * Helpers de periodo, puros y sin React.
 *
 * Viven aquí y no junto al selector de filtros por una razón que costó un error
 * en producción: `filtros.tsx` es `'use client'`, y en el App Router **cada**
 * export de un módulo cliente se convierte en una referencia al cliente. Un
 * componente de servidor puede *renderizar* esos exports, pero si **llama** a
 * una función de ahí, revienta en tiempo de ejecución — y no en el build,
 * porque las páginas dinámicas nunca se renderizan al compilar.
 *
 * Regla: si una función la van a llamar los dos lados, no vive en un archivo
 * con `'use client'`.
 */

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** '2026-08' → 'Agosto 2026'. Un periodo es un mes, no una cadena técnica. */
export function etiquetaPeriodo(p: string | null | undefined): string {
  if (!p) return '—'
  const [a, m] = p.split('-')
  const nombre = MESES[Number(m) - 1]
  return nombre ? `${nombre} ${a}` : p
}
