// Motor de etapas del pipeline de Reclutamiento (S7.5).
//
// Módulo PURO: sin React, sin Supabase, sin 'use client'/'use server'. Recibe el
// estado del candidato y el contexto de la página, y devuelve qué es lo siguiente
// que hay que hacer, si se puede hacer y qué falta si no.
//
// Existe para que el kanban, el perfil del candidato y las server actions digan
// exactamente lo mismo. Antes cada pantalla tenía su propia idea de "siguiente
// etapa" y el kanban movía tarjetas sin ejecutar la acción real.
//
// Dos criterios detrás de la tabla de decisión:
//   1. La fricción es proporcional al efecto secundario. Todo lo que manda correo
//      (comite→final_dg, oferta→contratado) es `formulario`: exige datos y una
//      confirmación explícita. Los pasos `directa` no envían nada.
//   2. Bloqueo duro solo con 0 evaluaciones; con evaluaciones parciales es
//      advertencia. Un entrevistador que nunca responde no puede congelar el
//      pipeline.

import type { RecEtapa, RecRevisionCv } from '@/lib/supabase/types'

/** Estado del candidato necesario para decidir el siguiente paso. */
export interface CandidatoEstado {
  id: string
  vacante_id: string
  etapa: RecEtapa
  email: string | null
  revision_cv: RecRevisionCv | null
  final_dg_at: string | null
  /** Evaluaciones que deberían llegar (una por entrevistador de la sesión). */
  evaluaciones_esperadas: number
  /** Evaluaciones ya registradas por magic link. */
  evaluaciones_registradas: number
  tiene_alta_config: boolean
}

/** Condiciones que no dependen del candidato sino del entorno. */
export interface ContextoEtapas {
  /** Hay cuenta de Google conectada (necesaria para crear Meets y enviar correo). */
  googleConectado: boolean
  /** Hay correo del Director General en /reclutamiento/ajustes. */
  dgConfigurada: boolean
  /** Inyectable para pruebas; por defecto, el reloj real. */
  ahora?: Date
}

export type AccionPaso =
  | { tipo: 'directa' }
  | { tipo: 'formulario'; form: 'final_dg' | 'alta_config' | 'contratacion' }
  | { tipo: 'redirect'; href: string }

export interface SiguientePaso {
  /** Etapa a la que se transiciona. `null` = paso preparatorio (no mueve la tarjeta). */
  etapaDestino: RecEtapa | null
  /** Etiqueta del botón / encabezado de la tarjeta guía. */
  titulo: string
  /** Explicación larga (perfil del candidato). */
  descripcion: string
  /** Una línea para la tarjeta del kanban cuando no hay bloqueos ni advertencias. */
  resumen: string
  accion: AccionPaso
  /** false si hay bloqueos: el botón va deshabilitado. */
  puede: boolean
  /** Impiden avanzar. */
  bloqueos: string[]
  /** Permiten avanzar, pero pidiendo confirmación. */
  advertencias: string[]
  /** Progreso de evaluaciones, si aplica a la etapa. */
  progreso: { registradas: number; total: number } | null
}

const SIN_CORREO = 'El candidato no tiene correo registrado'
const SIN_GOOGLE = 'No hay cuenta de Google conectada'
const SIN_DG = 'Falta el correo del Director General (Ajustes)'

/**
 * Qué sigue para este candidato. Devuelve `null` en etapas terminales
 * (contratado / descartado), donde no hay nada que hacer.
 */
export function siguientePaso(
  c: CandidatoEstado,
  ctx: ContextoEtapas,
): SiguientePaso | null {
  const perfil = `/reclutamiento/candidatos/${c.id}/editar`
  const agendar = `/reclutamiento/agendar?vacante=${c.vacante_id}&candidato=${c.id}`

  switch (c.etapa) {
    case 'postulado':
      return paso({
        etapaDestino: 'en_revision',
        titulo: 'Pasar a revisión',
        descripcion:
          'El candidato acaba de entrar. Muévelo a revisión para evaluar su CV y definir su viabilidad.',
        resumen: 'Listo para revisar',
        accion: { tipo: 'directa' },
      })

    case 'en_revision':
      // Sin viabilidad definida no hay nada que avanzar: la decisión se toma en
      // el formulario del perfil, no en el kanban.
      if (c.revision_cv !== 'viable') {
        return paso({
          etapaDestino: null,
          titulo: 'Revisar el CV',
          descripcion:
            'Define la viabilidad del candidato en el formulario de revisión. Si es viable, el siguiente paso es agendar sus entrevistas.',
          resumen: 'Falta definir la viabilidad del CV',
          accion: { tipo: 'redirect', href: perfil },
        })
      }
      return paso({
        etapaDestino: 'viable',
        titulo: 'Marcar como viable',
        descripcion: 'El CV está marcado como viable. Muévelo a la etapa Viable para poder agendar.',
        resumen: 'CV viable — listo para avanzar',
        accion: { tipo: 'directa' },
      })

    case 'viable':
      // La cascada de Meets se arma en /agendar (varios candidatos a la vez);
      // el kanban solo lleva ahí con el candidato preseleccionado.
      return paso({
        etapaDestino: 'entrevistas_agendadas',
        titulo: 'Agendar entrevistas',
        descripcion:
          'Agenda la sesión de entrevistas: se crea una liga de Meet por candidato y se envían las invitaciones a los entrevistadores.',
        resumen: 'Listo para agendar entrevistas',
        accion: { tipo: 'redirect', href: agendar },
        bloqueos: c.email ? [] : [SIN_CORREO],
      })

    case 'entrevistas_agendadas': {
      const { evaluaciones_registradas: reg, evaluaciones_esperadas: esp } = c
      const faltan = Math.max(esp - reg, 0)
      return paso({
        etapaDestino: 'comite',
        titulo: 'Pasar a comité',
        descripcion:
          'Los entrevistadores registran su evaluación por su liga. Cuando haya suficientes, pasa el candidato a comité para la decisión conjunta.',
        resumen: esp > 0 ? `${reg} de ${esp} evaluaciones registradas` : 'Sin evaluaciones esperadas',
        accion: { tipo: 'directa' },
        // 0 evaluaciones = no hay nada que discutir en comité.
        bloqueos: esp > 0 && reg === 0 ? ['Aún no hay ninguna evaluación registrada'] : [],
        advertencias: reg > 0 && faltan > 0 ? [`Faltan ${faltan} de ${esp} evaluaciones`] : [],
        progreso: esp > 0 ? { registradas: reg, total: esp } : null,
      })
    }

    case 'comite': {
      const bloqueos: string[] = []
      if (!c.email) bloqueos.push(SIN_CORREO)
      if (!ctx.googleConectado) bloqueos.push(SIN_GOOGLE)
      if (!ctx.dgConfigurada) bloqueos.push(SIN_DG)
      return paso({
        etapaDestino: 'final_dg',
        titulo: 'Agendar con la DG',
        descripcion:
          'Revisa las evaluaciones y las notas del comité. Al agendar se crea el Meet con Dirección General y se avisa al candidato por correo.',
        resumen: 'Listo para la entrevista final',
        accion: { tipo: 'formulario', form: 'final_dg' },
        bloqueos,
      })
    }

    case 'final_dg': {
      const futura =
        c.final_dg_at != null && new Date(c.final_dg_at) > (ctx.ahora ?? new Date())
      return paso({
        etapaDestino: 'oferta',
        titulo: 'Preparar el alta',
        descripcion:
          'Tras la entrevista final con Dirección General, mueve al candidato a oferta para configurar su alta.',
        resumen: 'Entrevista final realizada',
        accion: { tipo: 'directa' },
        advertencias: futura ? ['La entrevista con la DG aún no ocurre'] : [],
      })
    }

    case 'oferta': {
      // Dos sub-pasos: primero se configura el alta, después se contrata.
      if (!c.tiene_alta_config) {
        return paso({
          etapaDestino: null,
          titulo: 'Configurar el alta',
          descripcion:
            'Define equipo, sistemas, fecha de inducción y a quién se le avisa. Estos datos van en el correo interno de altas al contratar.',
          resumen: 'Falta configurar el alta',
          accion: { tipo: 'formulario', form: 'alta_config' },
        })
      }
      const bloqueos: string[] = []
      if (!c.email) bloqueos.push(SIN_CORREO)
      if (!ctx.googleConectado) bloqueos.push(SIN_GOOGLE)
      return paso({
        etapaDestino: 'contratado',
        titulo: 'Contratar',
        descripcion:
          'Último paso: se envía el correo de bienvenida al candidato y el correo interno de altas a los responsables.',
        resumen: 'Alta configurada — listo para contratar',
        accion: { tipo: 'formulario', form: 'contratacion' },
        bloqueos,
      })
    }

    default:
      // contratado / descartado: etapas terminales.
      return null
  }
}

/** Completa los campos opcionales y deriva `puede` de los bloqueos. */
function paso(
  p: Omit<SiguientePaso, 'puede' | 'bloqueos' | 'advertencias' | 'progreso'> &
    Partial<Pick<SiguientePaso, 'bloqueos' | 'advertencias' | 'progreso'>>,
): SiguientePaso {
  const bloqueos = p.bloqueos ?? []
  return {
    ...p,
    bloqueos,
    advertencias: p.advertencias ?? [],
    progreso: p.progreso ?? null,
    puede: bloqueos.length === 0,
  }
}

/**
 * La única línea que se muestra en la tarjeta del kanban: el primer bloqueo, o
 * la advertencia, o el resumen. En 220px no cabe más de una.
 */
export function indicacion(p: SiguientePaso): { texto: string; tono: 'bloqueo' | 'aviso' | 'normal' } {
  if (p.bloqueos.length > 0) return { texto: p.bloqueos[0], tono: 'bloqueo' }
  if (p.advertencias.length > 0) return { texto: p.advertencias[0], tono: 'aviso' }
  return { texto: p.resumen, tono: 'normal' }
}
