'use server'

import { createClient } from '@/lib/supabase/server'
import { submitEvaluacionSchema } from '@/lib/schemas/reclutamiento'

// Server action pública (sin sesión): el entrevistador la invoca desde
// /evaluar/[token]. La autorización la resuelve la RPC security definer
// rec_submit_evaluacion a partir del token.

type Result = { ok: true } | { ok: false; error: string }

// Códigos de error que devuelve la RPC → mensaje en español.
const SUBMIT_ERRORES: Record<string, string> = {
  invalido: 'La liga ya no es válida.',
  expirado: 'La liga expiró. Pide una nueva a Reclutamiento.',
  recomendacion_requerida: 'Selecciona una valoración.',
  entrevista_invalida: 'Ese candidato no corresponde a esta sesión.',
}

export async function submitEvaluacion(raw: unknown): Promise<Result> {
  const parsed = submitEvaluacionSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = createClient()
  const { data, error } = await supabase.rpc('rec_submit_evaluacion', {
    p_token: d.token,
    p_entrevista_id: d.entrevista_id,
    p_recomendacion: d.recomendacion,
    p_comentarios: (d.comentarios ?? '') || null,
    p_puntaje: d.puntaje ?? null,
  })

  if (error) return { ok: false, error: 'No se pudo guardar la evaluación.' }

  const res = (data ?? {}) as { ok?: boolean; error?: string }
  if (!res.ok) {
    return { ok: false, error: SUBMIT_ERRORES[res.error ?? ''] ?? 'No se pudo guardar la evaluación.' }
  }
  return { ok: true }
}
