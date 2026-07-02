import { z } from 'zod'

// ── Enums de dominio (espejo de los enums rec_* en la DB) ──

export const FUENTES = ['occ', 'computrabajo', 'linkedin', 'factorial', 'manual'] as const
export const REVISIONES_CV = ['viable', 'parcial', 'no_viable'] as const
export const MOTIVOS_DESCARTE = [
  'no_perfil', 'expectativa_salarial', 'ubicacion',
  'experiencia_insuficiente', 'no_contesto', 'declino', 'otro',
] as const
export const ETAPAS = [
  'postulado', 'en_revision', 'viable', 'entrevistas_agendadas',
  'comite', 'final_dg', 'oferta', 'contratado', 'descartado',
] as const

// ── Etiquetas en español para la UI ──

export const FUENTE_LABEL: Record<(typeof FUENTES)[number], string> = {
  occ: 'OCC',
  computrabajo: 'Computrabajo',
  linkedin: 'LinkedIn',
  factorial: 'Factorial',
  manual: 'Captura manual',
}

export const REVISION_CV_LABEL: Record<(typeof REVISIONES_CV)[number], string> = {
  viable: 'Viable',
  parcial: 'Parcial',
  no_viable: 'No viable',
}

export const MOTIVO_DESCARTE_LABEL: Record<(typeof MOTIVOS_DESCARTE)[number], string> = {
  no_perfil: 'No cumple el perfil',
  expectativa_salarial: 'Expectativa salarial',
  ubicacion: 'Ubicación',
  experiencia_insuficiente: 'Experiencia insuficiente',
  no_contesto: 'No contestó',
  declino: 'Declinó',
  otro: 'Otro',
}

export const ETAPA_LABEL: Record<(typeof ETAPAS)[number], string> = {
  postulado: 'Postulado',
  en_revision: 'En revisión',
  viable: 'Viable',
  entrevistas_agendadas: 'Entrevistas agendadas',
  comite: 'Comité',
  final_dg: 'Final DG',
  oferta: 'Oferta',
  contratado: 'Contratado',
  descartado: 'Descartado',
}

// ── Carga de CV ──

export const CV_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const
export const CV_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// ── Vacante ──

export const vacanteSchema = z.object({
  titulo: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  area: z.string().trim().max(120, 'Máximo 120 caracteres').optional().or(z.literal('')),
  descripcion: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  estado: z.enum(['abierta', 'cerrada']).default('abierta'),
})

export type VacanteInput = z.infer<typeof vacanteSchema>

// ── Candidato ──
// motivo_descarte solo aplica cuando revision_cv = 'no_viable' o etapa = 'descartado'.

export const candidatoSchema = z.object({
  vacante_id: z.string().uuid('Vacante inválida'),
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
  email: z.string().trim().email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().trim().max(30, 'Máximo 30 caracteres').optional().or(z.literal('')),
  fuente: z.enum(FUENTES).optional().nullable(),
  etapa: z.enum(ETAPAS).default('postulado'),
  revision_cv: z.enum(REVISIONES_CV).optional().nullable(),
  viabilidad: z.enum(['si', 'no', 'filtro_dg']).optional().nullable(),
  motivo_descarte: z.enum(MOTIVOS_DESCARTE).optional().nullable(),
  cv_storage_path: z.string().trim().optional().or(z.literal('')),
  notas: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
}).superRefine((val, ctx) => {
  const requiereMotivo = val.revision_cv === 'no_viable' || val.etapa === 'descartado'
  if (requiereMotivo && !val.motivo_descarte) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['motivo_descarte'],
      message: 'Indica el motivo del descarte',
    })
  }
  if (!requiereMotivo && val.motivo_descarte) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['motivo_descarte'],
      message: 'El motivo solo aplica a CV no viable o candidato descartado',
    })
  }
})

export type CandidatoInput = z.infer<typeof candidatoSchema>

// ── Revisión de CV (edición rápida desde la tabla) ──

export const revisionCvSchema = z.object({
  revision_cv: z.enum(REVISIONES_CV),
  motivo_descarte: z.enum(MOTIVOS_DESCARTE).optional().nullable(),
}).superRefine((val, ctx) => {
  if (val.revision_cv === 'no_viable' && !val.motivo_descarte) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['motivo_descarte'],
      message: 'Indica el motivo del descarte',
    })
  }
  if (val.revision_cv !== 'no_viable' && val.motivo_descarte) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['motivo_descarte'],
      message: 'El motivo solo aplica a CV no viable',
    })
  }
})

export type RevisionCvInput = z.infer<typeof revisionCvSchema>

// ── Transición de etapa (pipeline) ──
// El motivo es obligatorio solo al descartar; la RPC valida el DAG server-side.

export const transicionEtapaSchema = z.object({
  candidato_id: z.string().uuid('Candidato inválido'),
  etapa_destino: z.enum(ETAPAS),
  motivo_descarte: z.enum(MOTIVOS_DESCARTE).optional().nullable(),
  notas: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
}).superRefine((val, ctx) => {
  if (val.etapa_destino === 'descartado' && !val.motivo_descarte) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['motivo_descarte'],
      message: 'Indica el motivo del descarte',
    })
  }
})

export type TransicionEtapaInput = z.infer<typeof transicionEtapaSchema>
