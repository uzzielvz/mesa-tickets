// Definición de las exportaciones a CSV del módulo Reclutamiento (REC-024).
//
// Módulo PURO: sin React, sin Supabase, sin directivas. Define qué columnas
// salen y cómo se formatea cada una; las rutas de /api solo consultan, llaman
// aquí y sirven el archivo.
//
// Criterio: **el CSV lleva las mismas etiquetas que la pantalla.** Si el kanban
// dice "Entrevistas agendadas", el CSV no puede decir `entrevistas_agendadas`.
// Quien lo abre en Excel no tiene por qué traducir los enums de la base, y las
// etiquetas ya existen en un solo lugar (`lib/schemas/reclutamiento.ts`).

import {
  ETAPA_LABEL, FUENTE_LABEL, REVISION_CV_LABEL, MOTIVO_DESCARTE_LABEL,
} from '@/lib/schemas/reclutamiento'
import { plantillaMeta } from '@/lib/reclutamiento/plantillas'
import type { ColumnaCsv } from '@/lib/utils/csv'
import type { RecEtapa } from '@/lib/supabase/types'

const ZONA_MX = 'America/Mexico_City'

/**
 * `YYYY-MM-DD HH:mm` en hora de México.
 *
 * Formato ISO a propósito y no `dd/mmm`: ordena bien como texto, Excel lo
 * reconoce como fecha, y no depende de la configuración regional de quien abre
 * el archivo. La zona es explícita porque el servidor corre en UTC y una
 * entrevista de las 19:00 del día 5 no puede aparecer como del día 6.
 */
export function fechaMx(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const fecha = d.toLocaleDateString('en-CA', { timeZone: ZONA_MX })
  const hora = d.toLocaleTimeString('es-MX', {
    timeZone: ZONA_MX, hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return `${fecha} ${hora}`
}

function etiqueta(mapa: Record<string, string>, v: string | null | undefined): string {
  if (!v) return ''
  return mapa[v] ?? v
}

// ── Candidatos ────────────────────────────────────────────────────────────────

export interface CandidatoExport {
  nombre: string
  email: string | null
  telefono: string | null
  fuente: string | null
  etapa: RecEtapa
  revision_cv: string | null
  motivo_descarte: string | null
  cv_storage_path: string | null
  etapa_actualizada_at: string | null
  created_at: string
}

export const COLUMNAS_CANDIDATOS: ColumnaCsv<CandidatoExport>[] = [
  { encabezado: 'Nombre', valor: c => c.nombre },
  { encabezado: 'Correo', valor: c => c.email },
  { encabezado: 'Teléfono', valor: c => c.telefono },
  { encabezado: 'Fuente', valor: c => etiqueta(FUENTE_LABEL, c.fuente) },
  { encabezado: 'Etapa', valor: c => etiqueta(ETAPA_LABEL, c.etapa) },
  { encabezado: 'Revisión CV', valor: c => etiqueta(REVISION_CV_LABEL, c.revision_cv) },
  { encabezado: 'Motivo de descarte', valor: c => etiqueta(MOTIVO_DESCARTE_LABEL, c.motivo_descarte) },
  // El path del CV no sale: es una ruta interna de Storage y no le sirve a
  // nadie en una hoja de cálculo. Lo que importa es si el CV existe.
  { encabezado: 'Tiene CV', valor: c => (c.cv_storage_path ? 'Sí' : 'No') },
  { encabezado: 'Última actualización de etapa', valor: c => fechaMx(c.etapa_actualizada_at) },
  { encabezado: 'Registrado', valor: c => fechaMx(c.created_at) },
]

// ── Correos enviados ──────────────────────────────────────────────────────────

export interface CorreoExport {
  plantilla_codigo: string | null
  to_email: string
  candidato_nombre: string | null
  enviado_at: string
  estado: string
  error: string | null
}

export const COLUMNAS_CORREOS: ColumnaCsv<CorreoExport>[] = [
  { encabezado: 'Fecha', valor: c => fechaMx(c.enviado_at) },
  {
    encabezado: 'Correo',
    valor: c => (c.plantilla_codigo ? plantillaMeta(c.plantilla_codigo)?.label ?? c.plantilla_codigo : ''),
  },
  { encabezado: 'Destinatario', valor: c => c.to_email },
  { encabezado: 'Candidato', valor: c => c.candidato_nombre },
  { encabezado: 'Estado', valor: c => (c.estado === 'enviado' ? 'Enviado' : 'Error') },
  // El error literal de Gmail es justo lo que hace útil este CSV para
  // diagnosticar; se exporta completo, no truncado como en la tabla.
  { encabezado: 'Detalle del error', valor: c => c.error },
]

// ── Nombre del archivo ────────────────────────────────────────────────────────

/** `reclutamiento-candidatos-2026-08-31.csv` */
export function nombreArchivo(recurso: 'candidatos' | 'correos', ahora = new Date()): string {
  const dia = ahora.toLocaleDateString('en-CA', { timeZone: ZONA_MX })
  return `reclutamiento-${recurso}-${dia}.csv`
}
