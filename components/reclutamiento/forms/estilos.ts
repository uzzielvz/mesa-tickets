// Estilos compartidos por los formularios de etapa (comité y pipeline).
// Extraídos de comite-panel.tsx sin cambios para que las dos pantallas se vean igual.

export const inputClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'

export const labelClass = 'text-[11.5px] font-medium text-ink-500'

export const checkboxClass =
  'inline-flex items-center gap-1.5 text-[12px] text-ink-700 border border-[#ECECEC] rounded px-2.5 py-[5px] cursor-pointer select-none'

export const btnPrimario =
  'inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12px] font-medium rounded px-4 py-[7px] disabled:opacity-50 transition-colors'

export const btnNavy =
  'inline-flex items-center gap-1.5 bg-navy hover:opacity-90 text-white text-[12px] font-medium rounded px-4 py-[7px] disabled:opacity-50 transition-colors'

export const btnCancelar =
  'text-[12px] text-ink-500 border border-[#ECECEC] rounded px-4 py-[7px] hover:bg-surface-hover disabled:opacity-50 transition-colors'

/**
 * Dónde vive el formulario: incrustado al pie de una tarjeta de comité, o suelto
 * dentro de un modal del kanban. Solo cambia el marco, no el contenido.
 */
export type VarianteForm = 'inline' | 'modal'

/** `cerrado` = el formulario llega hasta el borde inferior de la tarjeta. */
export function marcoForm(variante: VarianteForm, cerrado = true) {
  if (variante === 'modal') return 'flex flex-col gap-3'
  return `border-t border-border-subtle pt-3 flex flex-col gap-3 bg-surface-sidebar -mx-4 px-4 pb-4${
    cerrado ? ' -mb-4 rounded-b-md' : ''
  }`
}
