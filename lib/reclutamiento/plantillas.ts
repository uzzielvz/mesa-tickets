// Catálogo de las plantillas de correo editables desde /reclutamiento/ajustes.
//
// `rec_plantillas_correo` guarda asunto y cuerpo desde el inicio, pero hasta
// ahora solo se cambiaban con una migración (`rec_014`, `rec_019` son
// literalmente `update … set cuerpo = …`). Este módulo es la fuente de verdad
// de qué plantillas se envían de verdad, con qué variables y cuáles de ellas
// no se pueden borrar.
//
// Puro: sin React ni Supabase, para que lo usen igual la página, el editor y
// la server action.

import { z } from 'zod'
import type { RecPlantillaCodigo } from '@/lib/supabase/types'

export interface PlantillaVar {
  nombre: string
  descripcion: string
}

export interface PlantillaMeta {
  codigo: RecPlantillaCodigo
  label: string
  cuando: string
  /** Si el envío pasa `cc` a Gmail. En las demás, editar el CC no haría nada. */
  cc: boolean
  vars: PlantillaVar[]
  /** Sin estas variables el destinatario no puede hacer lo que el correo le pide. */
  requeridos: string[]
}

// Solo las 6 que se envían hoy. `confirmacion_postulacion`, `descarte`,
// `oferta` e `informativa` están seedeadas pero ningún flujo las manda:
// exponerlas haría creer que editarlas cambia algo.
export const PLANTILLAS: PlantillaMeta[] = [
  {
    codigo: 'agendamiento_fase2',
    label: 'Invitación a entrevista — al candidato',
    cuando: 'Al agendar la sesión de entrevistas, a cada candidato seleccionado.',
    cc: false,
    vars: [
      { nombre: 'nombre_candidato', descripcion: 'Nombre del candidato' },
      { nombre: 'vacante', descripcion: 'Título de la vacante' },
      { nombre: 'fecha', descripcion: 'Fecha de la sesión, en largo' },
      { nombre: 'hora_inicio', descripcion: 'Hora de inicio de su entrevista' },
      { nombre: 'hora_fin', descripcion: 'Hora de fin de su entrevista' },
      { nombre: 'link_meet', descripcion: 'Liga de Google Meet del candidato' },
      { nombre: 'rotacion_entrevistadores', descripcion: 'Lista de quién lo entrevista y en qué bloque' },
    ],
    requeridos: ['fecha', 'hora_inicio', 'link_meet'],
  },
  {
    codigo: 'agenda_entrevistadores',
    label: 'Agenda de la sesión — a los entrevistadores',
    cuando: 'Al agendar, con los CV de los candidatos adjuntos.',
    cc: false,
    vars: [
      { nombre: 'nombres_entrevistadores', descripcion: 'Entrevistadores de la sesión' },
      { nombre: 'vacante', descripcion: 'Título de la vacante' },
      { nombre: 'fecha', descripcion: 'Fecha de la sesión, en largo' },
      { nombre: 'descripcion_sesion', descripcion: 'Cómo funciona la rotación, generado automáticamente' },
      { nombre: 'tabla_agenda', descripcion: 'Tabla de horarios y ligas de Meet' },
    ],
    requeridos: ['tabla_agenda'],
  },
  {
    codigo: 'notificacion_entrevistador',
    label: 'Liga de evaluación — al entrevistador',
    cuando: 'Al agendar. Es el enlace único con el que cada entrevistador califica.',
    cc: false,
    vars: [
      { nombre: 'nombre_entrevistador', descripcion: 'Nombre del entrevistador' },
      { nombre: 'vacante', descripcion: 'Título de la vacante' },
      { nombre: 'fecha', descripcion: 'Fecha de la sesión, en largo' },
      { nombre: 'magic_link', descripcion: 'Enlace personal para evaluar (sin él no puede calificar)' },
    ],
    requeridos: ['magic_link'],
  },
  {
    codigo: 'pase_fase3',
    label: 'Pase a entrevista con la Dirección General — al candidato',
    cuando: 'Al mover el candidato de Comité a Final DG.',
    cc: false,
    vars: [
      { nombre: 'nombre_candidato', descripcion: 'Nombre del candidato' },
      { nombre: 'fecha_hora', descripcion: 'Fecha y hora de la entrevista con la DG' },
    ],
    requeridos: ['fecha_hora'],
  },
  {
    codigo: 'bienvenida_contratacion',
    label: 'Bienvenida — al candidato contratado',
    cuando: 'Al contratar, con los formatos de ingreso adjuntos.',
    cc: true,
    vars: [
      { nombre: 'nombre_candidato', descripcion: 'Nombre del candidato' },
      { nombre: 'fecha_ingreso', descripcion: 'Fecha de ingreso, en largo' },
      { nombre: 'fecha_limite_docs', descripcion: 'Fecha límite para entregar documentos' },
    ],
    requeridos: ['fecha_ingreso', 'fecha_limite_docs'],
  },
  {
    codigo: 'altas_nuevos_ingresos',
    label: 'Altas de nuevos ingresos — interno',
    cuando: 'Al contratar. Avisa a cada área la tarea de alta que le toca.',
    cc: true,
    vars: [
      { nombre: 'nombre_candidato', descripcion: 'Nombre del candidato' },
      { nombre: 'puesto', descripcion: 'Título de la vacante' },
      { nombre: 'zona', descripcion: 'Área de la vacante' },
      { nombre: 'telefono', descripcion: 'Teléfono del candidato' },
      { nombre: 'jefe_directo', descripcion: 'Correo del jefe directo' },
      { nombre: 'fecha_ingreso', descripcion: 'Fecha de ingreso, en largo' },
      { nombre: 'equipo', descripcion: 'Equipo que se le entrega' },
      { nombre: 'tareas', descripcion: 'Lista de tareas por área, según la configuración de alta' },
    ],
    requeridos: ['nombre_candidato', 'tareas'],
  },
]

export const PLANTILLA_CODIGOS = PLANTILLAS.map(p => p.codigo)

export function plantillaMeta(codigo: string): PlantillaMeta | undefined {
  return PLANTILLAS.find(p => p.codigo === codigo)
}

/** Los `{{...}}` presentes en un texto. */
export function placeholdersDe(texto: string): string[] {
  return Array.from(texto.matchAll(/\{\{(\w+)\}\}/g), m => m[1])
}

const codigosTupla = PLANTILLA_CODIGOS as [RecPlantillaCodigo, ...RecPlantillaCodigo[]]

export const plantillaSchema = z
  .object({
    codigo: z.enum(codigosTupla),
    asunto: z.string().trim().min(3, 'El asunto no puede ir vacío'),
    cuerpo: z.string().trim().min(10, 'El cuerpo no puede ir vacío'),
    cc_emails: z.array(z.string().trim().email('Correo de copia inválido')),
  })
  .superRefine((v, ctx) => {
    const meta = plantillaMeta(v.codigo)
    if (!meta) return

    const usados = [...placeholdersDe(v.asunto), ...placeholdersDe(v.cuerpo)]
    const conocidos = new Set(meta.vars.map(x => x.nombre))

    // Una variable inventada se enviaría tal cual, como `{{foo}}`, al candidato.
    const inventados = Array.from(new Set(usados.filter(p => !conocidos.has(p))))
    if (inventados.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Esta plantilla no conoce ${inventados.map(p => `{{${p}}}`).join(', ')}. Se enviaría tal cual.`,
      })
    }

    const faltantes = meta.requeridos.filter(p => !usados.includes(p))
    if (faltantes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Falta ${faltantes.map(p => `{{${p}}}`).join(', ')}: sin eso el correo no sirve de nada.`,
      })
    }
  })

export type PlantillaInput = z.infer<typeof plantillaSchema>
