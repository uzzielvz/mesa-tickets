// Textos de las notificaciones por correo de la mesa de tickets.
// Puro: sin React ni Supabase. El envío vive en lib/actions/tickets.ts.
//
// Nota honesta: a diferencia de Reclutamiento, estas plantillas viven en el
// código. Si el patrón funciona en la operación, el siguiente paso es
// moverlas a la BD con un editor como el de /reclutamiento/ajustes.

import { formatoDuracion } from './sla'
import { PRIORIDAD_LABEL } from './sla'
import type { TicketPrioridad } from '@/lib/supabase/types'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mesa-tickets.vercel.app'

export interface TicketCorreoInfo {
  numero: number
  problema: string
  area: string
  levantadoPor: string
  prioridad: TicketPrioridad
  slaMin: number | null
}

export interface Correo {
  subject: string
  html: string
}

function urlTicket(numero: number): string {
  return `${SITE_URL}/tickets/${numero}`
}

// Marco visual mínimo, consistente con la plataforma. Sin imágenes remotas.
function envolver(titulo: string, lineas: string[], numero: number): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
  <p style="font-size:15px;font-weight:bold;margin:16px 0 4px">${titulo}</p>
  ${lineas.map(l => `<p style="font-size:13px;line-height:1.5;margin:6px 0;color:#444">${l}</p>`).join('\n')}
  <p style="margin:16px 0">
    <a href="${urlTicket(numero)}"
       style="background:#F58220;color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:8px 16px;border-radius:4px">
      Ver el ticket #${numero}
    </a>
  </p>
  <p style="font-size:11px;color:#999;margin-top:20px">
    Mesa de Ayuda — CrediFlexi. Este correo se genera automáticamente; no respondas aquí, responde dentro del ticket.
  </p>
</div>`.trim()
}

function slaTexto(slaMin: number | null): string {
  return slaMin == null
    ? 'tiempo de atención variable'
    : `tiempo estimado de atención: ${formatoDuracion(slaMin)}`
}

/** A los del área: cayó un ticket nuevo en su cola. */
export function correoTicketNuevo(t: TicketCorreoInfo): Correo {
  return {
    subject: `Ticket #${t.numero} — ${t.problema} (${t.area})`,
    html: envolver(
      `Nuevo ticket en la cola de ${t.area}`,
      [
        `<b>${t.levantadoPor}</b> levantó: <b>${t.problema}</b>.`,
        `Prioridad ${PRIORIDAD_LABEL[t.prioridad]} · ${slaTexto(t.slaMin)}.`,
        'Está sin tomar. El primero que lo tome se lo queda.',
      ],
      t.numero,
    ),
  }
}

/** A los del área: un ticket que ya tenía dueño volvió a la cola. */
export function correoDevuelto(t: TicketCorreoInfo): Correo {
  return {
    subject: `Ticket #${t.numero} volvió a la cola — ${t.problema}`,
    html: envolver(
      `Un ticket volvió a la cola de ${t.area}`,
      [
        `<b>${t.problema}</b> (de ${t.levantadoPor}) se quedó sin responsable.`,
        'Alguien tiene que volver a tomarlo — el reloj sigue corriendo.',
      ],
      t.numero,
    ),
  }
}

/** Al nuevo responsable: te pasaron un ticket. */
export function correoTePasaron(t: TicketCorreoInfo, dePersona: string): Correo {
  return {
    subject: `Te pasaron el ticket #${t.numero} — ${t.problema}`,
    html: envolver(
      'Te pasaron un ticket',
      [
        `<b>${dePersona}</b> te pasó <b>${t.problema}</b>, levantado por ${t.levantadoPor}.`,
        `Prioridad ${PRIORIDAD_LABEL[t.prioridad]} · ${slaTexto(t.slaMin)}.`,
      ],
      t.numero,
    ),
  }
}

/** Al solicitante: alguien tomó tu ticket. */
export function correoTomado(t: TicketCorreoInfo, responsable: string): Correo {
  return {
    subject: `Tu ticket #${t.numero} ya está siendo atendido`,
    html: envolver(
      `${responsable} tomó tu ticket`,
      [`<b>${t.problema}</b> ya está en manos de ${t.area}. Te avisaremos cuando haya avances.`],
      t.numero,
    ),
  }
}

/** Al solicitante: tu ticket quedó programado. */
export function correoProgramado(t: TicketCorreoInfo): Correo {
  return {
    subject: `Tu ticket #${t.numero} quedó programado`,
    html: envolver(
      'Tu solicitud fue validada',
      ['Se aplicará en la siguiente tanda o corte. No necesitas hacer nada más por ahora.'],
      t.numero,
    ),
  }
}

/** A la contraparte del hilo: hay una respuesta nueva. */
export function correoRespuesta(t: TicketCorreoInfo, autor: string): Correo {
  return {
    subject: `Respuesta en el ticket #${t.numero} — ${t.problema}`,
    html: envolver(
      `${autor} respondió en el ticket`,
      ['Entra al hilo para leer la respuesta y contestar si hace falta.'],
      t.numero,
    ),
  }
}

/** Al solicitante: márcalo cerrado o reábrelo. */
export function correoResuelto(t: TicketCorreoInfo, responsable: string): Correo {
  return {
    subject: `Tu ticket #${t.numero} está resuelto — confirma el cierre`,
    html: envolver(
      `${responsable} marcó tu ticket como resuelto`,
      [
        'Revisa si quedó solucionado.',
        'Dentro del ticket puedes <b>confirmar el cierre</b> o <b>reabrirlo con un comentario</b> si el problema sigue.',
      ],
      t.numero,
    ),
  }
}

/** Al solicitante: tu solicitud fue rechazada. */
export function correoRechazado(t: TicketCorreoInfo): Correo {
  return {
    subject: `Tu ticket #${t.numero} fue rechazado`,
    html: envolver(
      'Tu solicitud fue rechazada',
      ['El responsable explicó el motivo dentro del ticket.'],
      t.numero,
    ),
  }
}

/** Al responsable: el usuario confirmó el cierre. */
export function correoCerrado(t: TicketCorreoInfo): Correo {
  return {
    subject: `Ticket #${t.numero} cerrado — ${t.levantadoPor} confirmó`,
    html: envolver(
      'Ticket cerrado',
      [`${t.levantadoPor} confirmó que <b>${t.problema}</b> quedó resuelto. Nada pendiente.`],
      t.numero,
    ),
  }
}
