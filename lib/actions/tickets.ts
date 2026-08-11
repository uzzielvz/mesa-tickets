'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TicketStatus } from '@/lib/supabase/types'

type Result = { ok: true } | { ok: false; error: string }

// Códigos que lanzan las RPCs tkt_* → mensaje en español.
const ERRORES: Record<string, string> = {
  no_auth: 'No autenticado',
  no_existe: 'El ticket ya no existe.',
  ya_tomado: 'Otra persona tomó este ticket primero.',
  sin_acceso: 'No tienes permiso para hacer eso en este ticket.',
  ticket_terminado: 'El ticket ya está cerrado o rechazado.',
  transicion_invalida: 'Ese cambio de estado no está permitido.',
  motivo_requerido: 'Escribe el motivo del rechazo (mínimo 10 caracteres).',
}

// Postgres devuelve el código dentro del mensaje de la excepción.
function traducir(mensaje: string, fallback: string): string {
  const code = mensaje.match(/[a-z_]+/)?.[0] ?? ''
  return ERRORES[code] ?? fallback
}

function revalidar(numero?: number) {
  revalidatePath('/tickets/area')
  revalidatePath('/tickets/asignados')
  revalidatePath('/tickets/mios')
  revalidatePath('/dashboard')
  if (numero != null) revalidatePath(`/tickets/${numero}`)
}

/** Self-assign: alguien del área saca el ticket de la cola. */
export async function tomarTicket(ticketId: string, numero?: number): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.rpc('tkt_tomar_ticket', { p_ticket_id: ticketId })
  if (error) return { ok: false, error: traducir(error.message, 'No se pudo tomar el ticket.') }

  revalidar(numero)
  return { ok: true }
}

/** Cambio de estado. La RPC valida transición y permisos. */
export async function cambiarEstado(
  ticketId: string,
  estado: TicketStatus,
  motivo?: string,
  numero?: number,
): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.rpc('tkt_cambiar_estado', {
    p_ticket_id: ticketId,
    p_estado: estado,
    p_motivo: motivo?.trim() || null,
  })
  if (error) return { ok: false, error: traducir(error.message, 'No se pudo cambiar el estado.') }

  revalidar(numero)
  return { ok: true }
}
