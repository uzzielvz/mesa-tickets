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
  comite: 'Reunión de comité',
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

// ── Agendamiento masivo Fase 2 (cascada) ──
// Cada candidato tiene UNA liga de Meet; los N entrevistadores rotan en bloques
// de 20 min (duración por candidato = N × 20) y los arranques entre candidatos
// se escalonan 20 min: en cada slot coinciden pares distintos, nadie se empalma.

export const DURACION_BLOQUE_MIN = 20

export const entrevistadorSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre del entrevistador requerido'),
  email: z.string().trim().email('Correo de entrevistador inválido'),
})

export const agendarSesionSchema = z.object({
  vacante_id: z.string().uuid('Vacante inválida'),
  candidato_ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos un candidato'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de inicio inválida'),
  pausa_despues_de: z.number().int().min(1).optional().nullable(),
  pausa_minutos: z.number().int().min(5, 'Pausa mínima 5 min').max(120, 'Pausa máxima 120 min').optional().nullable(),
  entrevistadores: z.array(entrevistadorSchema).min(1, 'Agrega al menos un entrevistador'),
}).superRefine((val, ctx) => {
  if (val.pausa_despues_de != null && val.pausa_minutos == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pausa_minutos'],
      message: 'Indica los minutos de pausa',
    })
  }
})

export type AgendarSesionInput = z.infer<typeof agendarSesionSchema>

// ── Evaluación del entrevistador (ruta pública /evaluar/[token]) ──
// La recomendación es obligatoria; comentarios y puntaje (1–10) opcionales.

export const submitEvaluacionSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  entrevista_id: z.string().uuid('Entrevista inválida'),
  recomendacion: z.enum(['si', 'no', 'filtro_dg']),
  comentarios: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  puntaje: z.number().int().min(1, 'Mínimo 1').max(10, 'Máximo 10').optional().nullable(),
})

export type SubmitEvaluacionInput = z.infer<typeof submitEvaluacionSchema>

// ── Comité y contratación (S6) ──

export const notasComiteSchema = z.object({
  candidato_id: z.string().uuid('Candidato inválido'),
  notas_comite: z.string().trim().max(4000, 'Máximo 4000 caracteres').optional().or(z.literal('')),
})

export type NotasComiteInput = z.infer<typeof notasComiteSchema>

export const contratarSchema = z.object({
  candidato_id: z.string().uuid('Candidato inválido'),
  fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de ingreso inválida'),
  fecha_limite_docs: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha límite de documentos inválida'),
  cc_emails: z.array(z.string().trim().email('Correo de copia inválido')),
})

export type ContratarInput = z.infer<typeof contratarSchema>

// ── Entrevista final con la Dirección General (S7) ──
// Al pasar comité → final_dg se agenda un Meet con el Director General y el
// candidato, y se envía la plantilla pase_fase3.

export const DG_EMAIL = 'jvargas@financieracrediflexi.com'
export const DG_NOMBRE = 'Javier Vargas'
export const DURACION_FINAL_DG_MIN = 30

export const pasarFinalDgSchema = z.object({
  candidato_id: z.string().uuid('Candidato inválido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
})

export type PasarFinalDgInput = z.infer<typeof pasarFinalDgSchema>

// ── Configuración de alta (etapa 'oferta', S7) ──
// Equipo y sistemas son multi-selección; 'otros' en sistemas habilita texto libre.
// Los destinatarios internos se prellenan con defaults y se editan al momento.

export const EQUIPO_OPCIONES = ['celular', 'laptop', 'desktop'] as const
export const SISTEMAS_OPCIONES = ['yunius', 'hubspot', 'otros'] as const

export const EQUIPO_LABEL: Record<(typeof EQUIPO_OPCIONES)[number], string> = {
  celular: 'Celular',
  laptop: 'Laptop',
  desktop: 'Desktop',
}

export const SISTEMAS_LABEL: Record<(typeof SISTEMAS_OPCIONES)[number], string> = {
  yunius: 'Yunius',
  hubspot: 'HubSpot',
  otros: 'Otros',
}

// Roles de destinatarios internos del correo de altas (orden de despliegue en el form).
export const DESTINATARIOS_ROLES = [
  { key: 'rh_firmas', label: 'RH / firmas y bienvenida' },
  { key: 'correos', label: 'Correos electrónicos' },
  { key: 'induccion', label: 'Inducción' },
  { key: 'alta_yunius', label: 'Alta Yunius' },
  { key: 'alta_hubspot', label: 'Alta HubSpot' },
  { key: 'jefe_directo', label: 'Jefe directo' },
  { key: 'cc_adicional', label: 'CC adicional' },
] as const

export type DestinatarioRol = (typeof DESTINATARIOS_ROLES)[number]['key']

// Defaults prellenados de los destinatarios por rol. Se editan por candidato en el
// form de alta; el valor elegido se persiste en rec_alta_config.destinatarios.
// TODO(REC-062): completar con los correos reales de cada rol (por confirmar).
export const ALTA_DESTINATARIOS_DEFAULT: Record<DestinatarioRol, string> = {
  rh_firmas: '',
  correos: '',
  induccion: '',
  alta_yunius: '',
  alta_hubspot: '',
  jefe_directo: '',
  cc_adicional: '',
}

const emailOpcional = z.string().trim().email('Correo inválido').optional().or(z.literal(''))

export const altaConfigSchema = z.object({
  candidato_id: z.string().uuid('Candidato inválido'),
  equipo: z.array(z.enum(EQUIPO_OPCIONES)).default([]),
  sistemas: z.array(z.enum(SISTEMAS_OPCIONES)).default([]),
  otros_texto: z.string().trim().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
  induccion_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional().or(z.literal('')),
  induccion_meet_url: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  destinatarios: z.object({
    rh_firmas: emailOpcional,
    correos: emailOpcional,
    induccion: emailOpcional,
    alta_yunius: emailOpcional,
    alta_hubspot: emailOpcional,
    jefe_directo: emailOpcional,
    cc_adicional: emailOpcional,
  }),
}).superRefine((val, ctx) => {
  if (val.sistemas.includes('otros') && !val.otros_texto) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['otros_texto'],
      message: 'Especifica qué otros sistemas',
    })
  }
})

export type AltaConfigInput = z.infer<typeof altaConfigSchema>

// ── Cálculo de la cascada (puro, compartido entre preview y server action) ──

export interface BloqueCascada {
  /** índice del candidato (0-based) */
  indice: number
  inicio: string // 'HH:MM'
  fin: string
  /** hora de arranque del bloque de 20 min de cada entrevistador (longitud = N) */
  bloques: string[]
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatoHora(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function calcularCascada(params: {
  horaInicio: string
  numCandidatos: number
  numEntrevistadores: number
  pausaDespuesDe?: number | null
  pausaMinutos?: number | null
}): BloqueCascada[] {
  const base = aMinutos(params.horaInicio)
  const n = Math.max(params.numEntrevistadores, 1)
  const pausaTras = params.pausaDespuesDe ?? null
  const pausaMin = params.pausaMinutos ?? 0
  const out: BloqueCascada[] = []
  for (let i = 0; i < params.numCandidatos; i++) {
    // Escalonamiento de 20 min entre candidatos + pausa opcional tras el candidato N.
    const pausa = pausaTras != null && i >= pausaTras ? pausaMin : 0
    const inicio = base + i * DURACION_BLOQUE_MIN + pausa
    out.push({
      indice: i,
      inicio: formatoHora(inicio),
      fin: formatoHora(inicio + DURACION_BLOQUE_MIN * n),
      bloques: Array.from({ length: n }, (_, j) => formatoHora(inicio + DURACION_BLOQUE_MIN * j)),
    })
  }
  return out
}
