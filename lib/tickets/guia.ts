// Guía contextual del ticket: qué significa el estado actual y cuál es el
// siguiente paso, según quién esté mirando. Mismo criterio que la guía de
// candidatos de Reclutamiento: nadie debería tener que adivinar qué hacer.
//
// Puro: sin React ni Supabase.

import { formatoDuracion } from './sla'

export interface GuiaInput {
  estado: string
  esLevantador: boolean
  esResponsable: boolean
  /** Pertenece al área que atiende (o es admin) y el ticket sigue sin tomar. */
  puedeTomar: boolean
  areaNombre: string
  responsableNombre: string | null
  slaMin: number | null
}

export interface Guia {
  titulo: string
  cuerpo: string
}

export function guiaDelTicket(g: GuiaInput): Guia | null {
  const sinTomar = g.responsableNombre === null

  if (g.estado === 'cerrado' || g.estado === 'rechazado') return null

  if (sinTomar) {
    // Quien puede tomarlo ya tiene el banner con el botón (ControlEstado);
    // duplicar el texto aquí solo estorba.
    if (g.puedeTomar) return null
    if (g.esLevantador) {
      const tiempo = g.slaMin == null
        ? 'El tiempo de atención es variable según el caso.'
        : `El tiempo estimado de atención es de ${formatoDuracion(g.slaMin)}.`
      return {
        titulo: `Tu ticket está en la cola de ${g.areaNombre}`,
        cuerpo: `Alguien del equipo lo tomará. ${tiempo} Te avisaremos aquí mismo cuando haya avances.`,
      }
    }
    return {
      titulo: `En la cola de ${g.areaNombre}`,
      cuerpo: 'Todavía nadie lo ha tomado.',
    }
  }

  switch (g.estado) {
    case 'abierto':
    case 'en_revision':
      if (g.esResponsable) {
        return {
          titulo: 'Estás atendiendo este ticket',
          cuerpo: 'Responde al usuario con lo que encuentres. Márcalo Programado si entra en la siguiente tanda, o "Marcar como resuelto" cuando esté listo.',
        }
      }
      if (g.esLevantador) {
        return {
          titulo: `${g.responsableNombre} está atendiendo tu ticket`,
          cuerpo: 'Si tienes información nueva (otra captura, algo que cambió), respóndele en el hilo: le ahorra tiempo.',
        }
      }
      return {
        titulo: `Lo atiende ${g.responsableNombre}`,
        cuerpo: 'El ticket está en curso.',
      }

    case 'programado':
      if (g.esResponsable) {
        return {
          titulo: 'Programado para la siguiente tanda',
          cuerpo: 'Cuando se aplique el corte, márcalo como resuelto para que el usuario confirme.',
        }
      }
      if (g.esLevantador) {
        return {
          titulo: 'Tu solicitud ya fue validada',
          cuerpo: 'Se aplicará en la siguiente tanda o corte. No necesitas hacer nada más por ahora.',
        }
      }
      return {
        titulo: 'Programado',
        cuerpo: 'Validado; se aplica en la siguiente tanda.',
      }

    case 'resuelto':
      if (g.esLevantador) {
        return {
          titulo: `${g.responsableNombre} marcó tu ticket como resuelto`,
          cuerpo: 'Revisa si quedó solucionado. Abajo puedes confirmar el cierre, o reabrirlo con un comentario si el problema sigue.',
        }
      }
      if (g.esResponsable) {
        return {
          titulo: 'Esperando confirmación del usuario',
          cuerpo: 'El ticket se cerrará cuando quien lo levantó confirme que quedó resuelto.',
        }
      }
      return {
        titulo: 'Resuelto, pendiente de confirmación',
        cuerpo: 'Falta que quien lo levantó confirme el cierre.',
      }

    default:
      return null
  }
}
