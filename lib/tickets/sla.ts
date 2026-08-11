// Estado de atención de un ticket contra el SLA de su tipo de problema.
//
// Módulo puro (sin React ni Supabase) para que el mismo cálculo lo usen el
// listado, el detalle y cualquier métrica futura. Recibe `ahora` en vez de
// leer el reloj: así el servidor y el cliente pintan lo mismo y no hay
// desajuste de hidratación.
//
// El reloj corre **solo mientras el ticket está `abierto`**, es decir cuando
// la pelota está del lado del área que atiende. En `contestado` el que debe
// moverse es el solicitante, y en `terminado`/`cerrado`/`rechazado` ya no
// hay nada que medir.

import type { TicketModalidad, TicketPrioridad } from '@/lib/supabase/types'

export type SlaEstado = 'sin_sla' | 'no_aplica' | 'ok' | 'por_vencer' | 'vencido'

export interface Sla {
  estado: SlaEstado
  /** Minutos restantes; negativo si ya se pasó. `null` cuando no aplica. */
  minutos: number | null
  etiqueta: string
}

interface TicketSlaInput {
  status: string
  sla_min: number | null
  created_at: string
}

/** "40 min", "1 h 5 min", "2 h". */
export function formatoDuracion(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  const horas = Math.floor(m / 60)
  const resto = m % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/**
 * El reloj corre solo mientras el área debe algo: cuando el ticket está en la
 * cola (`abierto`) o alguien lo está atendiendo (`en_revision`).
 *
 * `programado` lo pausa a propósito — el ticket ya se validó y espera a la
 * siguiente tanda, así que la demora dejó de ser responsabilidad del técnico.
 * `resuelto` también, porque ahí la pelota es del solicitante.
 */
const RELOJ_CORRIENDO = new Set(['abierto', 'en_revision'])

export function calcularSla(t: TicketSlaInput, ahora: number): Sla {
  if (t.sla_min == null) {
    return { estado: 'sin_sla', minutos: null, etiqueta: 'Tiempo variable' }
  }
  if (!RELOJ_CORRIENDO.has(t.status)) {
    const etiqueta = t.status === 'programado'
      ? 'En espera de la siguiente tanda'
      : `SLA ${formatoDuracion(t.sla_min)}`
    return { estado: 'no_aplica', minutos: null, etiqueta }
  }

  // Desde que se levantó el ticket. Las pausas (`programado`, `resuelto`) no se
  // acumulan: un ticket que se reabre vuelve a contar contra su hora original.
  // Es la lectura estricta y la que se puede defender en junta; llevar tiempo
  // acumulado exigiría una bitácora de cambios de estado.
  const transcurrido = (ahora - new Date(t.created_at).getTime()) / 60_000
  const restante = t.sla_min - transcurrido

  if (restante <= 0) {
    return { estado: 'vencido', minutos: restante, etiqueta: `Vencido por ${formatoDuracion(-restante)}` }
  }
  // El último cuarto del SLA ya es zona de riesgo.
  const estado: SlaEstado = restante <= t.sla_min * 0.25 ? 'por_vencer' : 'ok'
  return { estado, minutos: restante, etiqueta: `Quedan ${formatoDuracion(restante)}` }
}

export const SLA_COLOR: Record<SlaEstado, string> = {
  vencido: 'text-[#b91c1c]',
  por_vencer: 'text-[#a16207]',
  ok: 'text-ink-500',
  no_aplica: 'text-ink-400',
  sin_sla: 'text-ink-400',
}

export const PRIORIDAD_LABEL: Record<TicketPrioridad, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

export const PRIORIDAD_CHIP: Record<TicketPrioridad, string> = {
  alta: 'bg-red-50 text-red-700 border-red-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  baja: 'bg-gray-100 text-gray-600 border-gray-200',
}

export const MODALIDAD_LABEL: Record<TicketModalidad, string> = {
  remoto: 'Remoto',
  presencial: 'Presencial',
  ambas: 'Remoto o presencial',
}
