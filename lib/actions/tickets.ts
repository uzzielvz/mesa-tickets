'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { accessTokenDesdeRefresh, enviarCorreo } from '@/lib/google/client'
import {
  correoCerrado, correoDevuelto, correoPausa, correoRechazado,
  correoRespuesta, correoResuelto, correoResueltoDirecto, correoTePasaron,
  correoTicketNuevo, correoTomado, type Correo, type TicketCorreoInfo,
} from '@/lib/tickets/correos'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TicketStatus } from '@/lib/supabase/types'

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
  fuera_del_area: 'Esa persona no pertenece al área que atiende este ticket.',
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

// ─── Notificaciones por correo ─────────────────────────────────────────────
// Best-effort SIEMPRE: un Gmail caído jamás bloquea tomar, mover o crear un
// ticket. El error se registra en el log del servidor y la vida sigue.

type Supa = SupabaseClient<Database>

interface TicketNotif extends TicketCorreoInfo {
  id: string
  area_id: string
  levantado_por_id: string
  responsable_id: string | null
  responsable_nombre: string | null
  estado: string
  etiqueta_pausa: string | null
}

async function ticketParaNotificar(supabase: Supa, ticketId: string): Promise<TicketNotif | null> {
  const { data } = await supabase
    .from('tickets_with_status')
    .select('id, numero, area_id, problema_nombre, area_nombre, levantado_por_id, levantado_por_nombre, responsable_id, responsable_nombre, prioridad, sla_min, estado, etiqueta_pausa')
    .eq('id', ticketId)
    .single()
  if (!data) return null
  const t = data as unknown as {
    id: string; numero: number; area_id: string; problema_nombre: string
    area_nombre: string; levantado_por_id: string; levantado_por_nombre: string
    responsable_id: string | null; responsable_nombre: string | null
    prioridad: TicketCorreoInfo['prioridad']; sla_min: number | null
    estado: string; etiqueta_pausa: string | null
  }
  return {
    id: t.id,
    numero: t.numero,
    area_id: t.area_id,
    problema: t.problema_nombre,
    area: t.area_nombre,
    levantadoPor: t.levantado_por_nombre,
    levantado_por_id: t.levantado_por_id,
    responsable_id: t.responsable_id,
    responsable_nombre: t.responsable_nombre,
    prioridad: t.prioridad,
    slaMin: t.sla_min,
    estado: t.estado,
    etiqueta_pausa: t.etiqueta_pausa,
  }
}

async function emailDe(supabase: Supa, profileId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('email').eq('id', profileId).single()
  return (data as { email: string | null } | null)?.email ?? null
}

/** Emails del área, excluyendo a quien no debe recibir (p.ej. el autor). */
async function emailsDelArea(supabase: Supa, areaId: string, excluir: string[]): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('area_id', areaId)
  return ((data ?? []) as { id: string; email: string | null }[])
    .filter(p => p.email && !excluir.includes(p.id))
    .map(p => p.email as string)
}

/** Nombre visible del remitente. Las notificaciones son de la plataforma. */
const REMITENTE = 'Mesa de Ayuda CrediFlexi'

/**
 * La cuenta emisora de la mesa vive en el ENTORNO, no en la base de datos.
 *
 * Es deliberado: mientras la credencial fuera una fila de
 * `rec_credenciales_google`, cualquier usuario con permisos podía reconectar
 * desde cualquier dispositivo y cambiar el remitente — de hecho pasó. Como
 * variable de Vercel no hay pantalla que la toque, ni RLS que se pueda
 * relajar, ni "última cuenta conectada" que gane.
 *
 * Se obtiene una sola vez con `scripts/google-token-plataforma.mjs`.
 */
function credencialPlataforma(): { refreshToken: string; email: string } | null {
  const refreshToken = process.env.TICKETS_GOOGLE_REFRESH_TOKEN
  const email = process.env.TICKETS_SENDER_EMAIL
  if (!refreshToken || !email) return null
  return { refreshToken, email }
}

async function enviar(_supabase: Supa, to: string[], correo: Correo): Promise<void> {
  if (to.length === 0) return
  const cred = credencialPlataforma()
  if (!cred) {
    // Sin configurar: no se manda nada. Nunca se cae de vuelta a la cuenta de
    // un usuario — un remitente equivocado es peor que ningún correo.
    console.warn('[tickets] TICKETS_GOOGLE_REFRESH_TOKEN/SENDER_EMAIL sin configurar: no se envió')
    return
  }
  try {
    const accessToken = await accessTokenDesdeRefresh(cred.refreshToken)
    await enviarCorreo(accessToken, {
      to,
      subject: correo.subject,
      html: correo.html,
      from: `${REMITENTE} <${cred.email}>`,
    })
  } catch (e) {
    console.error('[tickets] notificación no enviada:', e)
  }
}

/**
 * Llamada por el form tras crear el ticket (fire-and-forget desde el
 * cliente). Avisa a toda el área que hay un ticket nuevo sin tomar.
 */
export async function notificarTicketNuevo(ticketId: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const t = await ticketParaNotificar(supabase, ticketId)
  if (!t) return
  const destinos = await emailsDelArea(supabase, t.area_id, [t.levantado_por_id])
  await enviar(supabase, destinos, correoTicketNuevo(t))
}

/**
 * Llamada por el composer tras insertar una respuesta. Avisa a la
 * contraparte del hilo; el tipo decide el texto.
 */
export async function notificarRespuesta(
  ticketId: string,
  tipo: 'mensaje' | 'terminado_responsable' | 'terminado_usuario' | 'rechazo_responsable',
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const t = await ticketParaNotificar(supabase, ticketId)
  if (!t) return

  const soyLevantador = user.id === t.levantado_por_id
  // La contraparte: si escribió el solicitante, avisar al responsable y viceversa.
  const destinoId = soyLevantador ? t.responsable_id : t.levantado_por_id
  if (!destinoId || destinoId === user.id) return
  const email = await emailDe(supabase, destinoId)
  if (!email) return

  const autor = soyLevantador ? t.levantadoPor : (t.responsable_nombre ?? t.area)
  // En los presenciales el trigger ya cerró el ticket: pedirle al usuario que
  // confirme algo que ya está cerrado sería mentirle.
  const correo =
    tipo === 'terminado_responsable'
      ? (t.estado === 'cerrado' ? correoResueltoDirecto(t, autor) : correoResuelto(t, autor))
    : tipo === 'rechazo_responsable' ? correoRechazado(t)
    : tipo === 'terminado_usuario' ? correoCerrado(t)
    : correoRespuesta(t, autor)

  await enviar(supabase, [email], correo)
}

/** Self-assign: alguien del área saca el ticket de la cola. */
export async function tomarTicket(ticketId: string, numero?: number): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.rpc('tkt_tomar_ticket', { p_ticket_id: ticketId })
  if (error) return { ok: false, error: traducir(error.message, 'No se pudo tomar el ticket.') }

  // Avisar al solicitante que su ticket ya tiene manos (best-effort).
  const t = await ticketParaNotificar(supabase, ticketId)
  if (t && t.levantado_por_id !== user.id) {
    const email = await emailDe(supabase, t.levantado_por_id)
    if (email) await enviar(supabase, [email], correoTomado(t, t.responsable_nombre ?? 'Alguien del área'))
  }

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

  // La pausa es lo único que amerita correo desde aquí: cambia lo que el
  // solicitante debe esperar (o hacer). Reanudar no le aporta nada, y
  // resuelto/rechazado avisan desde el composer, que es su camino real.
  if (estado === 'programado') {
    const t = await ticketParaNotificar(supabase, ticketId)
    if (t && t.levantado_por_id !== user.id) {
      const email = await emailDe(supabase, t.levantado_por_id)
      if (email) {
        await enviar(supabase, [email], correoPausa(t, t.etiqueta_pausa ?? 'En pausa'))
      }
    }
  }

  revalidar(numero)
  return { ok: true }
}

/**
 * Reasignación (TKT-002): sin destinatario devuelve el ticket a la cola del
 * área; con destinatario se lo pasa a esa persona. La RPC valida que quien
 * mueve sea el responsable actual (o admin) y que el destino sea del área.
 */
export async function reasignarTicket(
  ticketId: string,
  nuevoResponsableId: string | null,
  numero?: number,
): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // El nombre de quien suelta/pasa, antes de que el ticket cambie de manos.
  const antes = await ticketParaNotificar(supabase, ticketId)

  const { error } = await supabase.rpc('tkt_reasignar_ticket', {
    p_ticket_id: ticketId,
    p_nuevo_responsable: nuevoResponsableId,
  })
  if (error) return { ok: false, error: traducir(error.message, 'No se pudo reasignar el ticket.') }

  const t = await ticketParaNotificar(supabase, ticketId)
  if (t) {
    if (nuevoResponsableId === null) {
      // Volvió a la cola: toda el área debe enterarse o el ticket se pudre.
      const destinos = await emailsDelArea(supabase, t.area_id, [user.id, t.levantado_por_id])
      await enviar(supabase, destinos, correoDevuelto(t))
    } else if (nuevoResponsableId !== user.id) {
      const email = await emailDe(supabase, nuevoResponsableId)
      if (email) {
        await enviar(supabase, [email], correoTePasaron(t, antes?.responsable_nombre ?? 'Un compañero'))
      }
    }
  }

  revalidar(numero)
  return { ok: true }
}
