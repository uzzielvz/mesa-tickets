'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  vacanteSchema,
  candidatoSchema,
  revisionCvSchema,
  transicionEtapaSchema,
} from '@/lib/schemas/reclutamiento'

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

// Normaliza cadenas vacías a null (los campos opcionales del schema aceptan '').
function nn(v: string | null | undefined): string | null {
  const t = (v ?? '').toString().trim()
  return t === '' ? null : t
}

// ─── Vacantes ──────────────────────────────────────────────────────────────────

export async function crearVacante(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = vacanteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('rec_vacantes')
    .insert({
      titulo: parsed.data.titulo,
      area: nn(parsed.data.area),
      descripcion: nn(parsed.data.descripcion),
      estado: parsed.data.estado,
      creada_por_id: user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Error al crear la vacante.' }

  revalidatePath('/reclutamiento/vacantes')
  return { ok: true, id: (data as { id: string }).id }
}

export async function actualizarVacante(vacanteId: string, raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = vacanteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('rec_vacantes')
    .update({
      titulo: parsed.data.titulo,
      area: nn(parsed.data.area),
      descripcion: nn(parsed.data.descripcion),
      estado: parsed.data.estado,
    })
    .eq('id', vacanteId)

  if (error) return { ok: false, error: 'Error al actualizar la vacante.' }

  revalidatePath('/reclutamiento/vacantes')
  revalidatePath(`/reclutamiento/vacantes/${vacanteId}/editar`)
  return { ok: true, id: vacanteId }
}

export async function cerrarVacante(vacanteId: string, reabrir = false): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('rec_vacantes')
    .update({ estado: reabrir ? 'abierta' : 'cerrada' })
    .eq('id', vacanteId)

  if (error) return { ok: false, error: 'Error al cambiar el estado de la vacante.' }

  revalidatePath('/reclutamiento/vacantes')
  return { ok: true }
}

// ─── Candidatos ────────────────────────────────────────────────────────────────

export async function crearCandidato(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = candidatoSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const d = parsed.data
  const requiereMotivo = d.revision_cv === 'no_viable' || d.etapa === 'descartado'

  const { data, error } = await supabase
    .from('rec_candidatos')
    .insert({
      vacante_id: d.vacante_id,
      nombre: d.nombre,
      email: nn(d.email),
      telefono: nn(d.telefono),
      fuente: d.fuente ?? null,
      etapa: d.etapa,
      revision_cv: d.revision_cv ?? null,
      viabilidad: d.viabilidad ?? null,
      motivo_descarte: requiereMotivo ? (d.motivo_descarte ?? null) : null,
      cv_storage_path: nn(d.cv_storage_path),
      notas: nn(d.notas),
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'Error al crear el candidato.' }

  revalidatePath('/reclutamiento/candidatos')
  return { ok: true, id: (data as { id: string }).id }
}

export async function actualizarCandidato(candidatoId: string, raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = candidatoSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const d = parsed.data
  const requiereMotivo = d.revision_cv === 'no_viable' || d.etapa === 'descartado'

  const { error } = await supabase
    .from('rec_candidatos')
    .update({
      vacante_id: d.vacante_id,
      nombre: d.nombre,
      email: nn(d.email),
      telefono: nn(d.telefono),
      fuente: d.fuente ?? null,
      etapa: d.etapa,
      revision_cv: d.revision_cv ?? null,
      viabilidad: d.viabilidad ?? null,
      motivo_descarte: requiereMotivo ? (d.motivo_descarte ?? null) : null,
      cv_storage_path: nn(d.cv_storage_path),
      notas: nn(d.notas),
    })
    .eq('id', candidatoId)

  if (error) return { ok: false, error: 'Error al actualizar el candidato.' }

  revalidatePath('/reclutamiento/candidatos')
  revalidatePath(`/reclutamiento/candidatos/${candidatoId}/editar`)
  return { ok: true, id: candidatoId }
}

// Edición rápida de la revisión de CV desde la tabla.
export async function actualizarRevisionCandidato(candidatoId: string, raw: unknown): Promise<Result> {
  const parsed = revisionCvSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const noViable = parsed.data.revision_cv === 'no_viable'

  const { error } = await supabase
    .from('rec_candidatos')
    .update({
      revision_cv: parsed.data.revision_cv,
      motivo_descarte: noViable ? (parsed.data.motivo_descarte ?? null) : null,
    })
    .eq('id', candidatoId)

  if (error) return { ok: false, error: 'Error al guardar la revisión.' }

  revalidatePath('/reclutamiento/candidatos')
  return { ok: true }
}

export async function eliminarCandidato(candidatoId: string): Promise<Result> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: row } = await supabase
    .from('rec_candidatos')
    .select('cv_storage_path')
    .eq('id', candidatoId)
    .single()

  const { error } = await supabase.from('rec_candidatos').delete().eq('id', candidatoId)
  if (error) return { ok: false, error: 'Error al eliminar el candidato.' }

  const path = (row as { cv_storage_path: string | null } | null)?.cv_storage_path
  if (path) await supabase.storage.from('reclutamiento').remove([path])

  revalidatePath('/reclutamiento/candidatos')
  return { ok: true }
}

// ─── Pipeline: transición de etapa ──────────────────────────────────────────────

// Códigos de excepción que lanza la RPC rec_transicion_etapa → mensaje en español.
const TRANSICION_ERRORES: Record<string, string> = {
  no_auth: 'No autenticado',
  sin_acceso: 'No tienes acceso al módulo de reclutamiento.',
  no_existe: 'El candidato ya no existe.',
  misma_etapa: 'El candidato ya está en esa etapa.',
  motivo_requerido: 'Indica el motivo del descarte.',
  transicion_invalida: 'Esa transición de etapa no está permitida.',
}

export async function transicionarCandidato(raw: unknown): Promise<Result> {
  const parsed = transicionEtapaSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const d = parsed.data
  const { error } = await supabase.rpc('rec_transicion_etapa', {
    p_candidato_id: d.candidato_id,
    p_etapa_destino: d.etapa_destino,
    p_motivo_descarte: d.etapa_destino === 'descartado' ? (d.motivo_descarte ?? null) : null,
    p_notas: nn(d.notas),
  })

  if (error) {
    const code = error.message.match(/[a-z_]+/)?.[0] ?? ''
    return { ok: false, error: TRANSICION_ERRORES[code] ?? 'No se pudo mover el candidato.' }
  }

  revalidatePath('/reclutamiento/pipeline')
  revalidatePath('/reclutamiento/candidatos')
  return { ok: true }
}

// ─── CV (URL firmada temporal para descargar/ver) ───────────────────────────────

export async function urlFirmadaCv(path: string): Promise<Result<{ url: string }>> {
  if (!path) return { ok: false, error: 'Sin CV.' }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data, error } = await supabase.storage
    .from('reclutamiento')
    .createSignedUrl(path, 60 * 10) // 10 minutos

  if (error || !data) return { ok: false, error: 'No se pudo generar el enlace del CV.' }

  return { ok: true, url: data.signedUrl }
}
