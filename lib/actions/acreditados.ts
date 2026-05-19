'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { acreditadoSchema, evaluacionSchema } from '@/lib/schemas/acreditado'
import { calcularScore, clasificar } from '@/lib/scoring/modelo'
import type { Referencia } from '@/lib/scoring/types'

// ─── Crear nuevo acreditado ────────────────────────────────────────────────────

export async function crearAcreditado(raw: unknown): Promise<{ ok: boolean; numero?: number; error?: string }> {
  const parsed = acreditadoSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { referencias, ...campos } = parsed.data

  const refs = referencias as Referencia[]
  const { puntaje } = calcularScore(campos, refs)
  const clasif = clasificar(puntaje)

  const { data: acreditado, error } = await supabase
    .from('acreditados')
    .insert({
      ...campos,
      negocio_domicilio: campos.negocio_domicilio,
      automovil_propio: campos.automovil_propio,
      puntaje_total: puntaje,
      clasificacion_modelo: clasif.letra,
      capturado_por_id: user.id,
    })
    .select('id, numero')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe un acreditado con esa clave.' }
    }
    return { ok: false, error: 'Error al guardar el registro.' }
  }

  if (!acreditado) {
    return { ok: false, error: 'Error al guardar el registro.' }
  }

  if (refs.length > 0) {
    const { error: refError } = await supabase.from('acreditado_referencias').insert(
      refs.map(r => ({
        acreditado_id: (acreditado as { id: string; numero: number }).id,
        calidad: r.calidad,
        nombre_referencia: r.nombre_referencia ?? null,
      }))
    )
    if (refError) {
      return { ok: false, error: 'Error al guardar las referencias.' }
    }
  }

  revalidatePath('/score/acreditados')
  return { ok: true, numero: (acreditado as { id: string; numero: number }).numero }
}

// ─── Actualizar acreditado con historial ───────────────────────────────────────

export async function actualizarAcreditado(
  acreditadoId: string,
  raw: unknown
): Promise<{ ok: boolean; numero?: number; error?: string }> {
  const parsed = acreditadoSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: actualRaw } = await supabase
    .from('acreditados')
    .select('*')
    .eq('id', acreditadoId)
    .single()

  if (!actualRaw) return { ok: false, error: 'Registro no encontrado.' }

  const actual = actualRaw as Record<string, unknown>

  const { referencias, ...campos } = parsed.data
  const refs = referencias as Referencia[]
  const { puntaje } = calcularScore(campos, refs)
  const clasif = clasificar(puntaje)

  const camposComparables = Object.keys(campos) as (keyof typeof campos)[]
  const cambios = camposComparables
    .filter(k => String(actual[k]) !== String(campos[k]))
    .map(k => ({
      acreditado_id: acreditadoId,
      editado_por_id: user.id,
      campo: k,
      valor_antes: String(actual[k] ?? ''),
      valor_despues: String(campos[k]),
    }))

  if (cambios.length > 0) {
    await supabase.from('acreditado_historial').insert(cambios)
  }

  const { error } = await supabase
    .from('acreditados')
    .update({
      ...campos,
      puntaje_total: puntaje,
      clasificacion_modelo: clasif.letra,
      contador_ediciones: ((actual.contador_ediciones as number) ?? 0) + 1,
    })
    .eq('id', acreditadoId)

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe otro acreditado con esa clave.' }
    }
    return { ok: false, error: 'Error al actualizar el registro.' }
  }

  const { error: delRefError } = await supabase
    .from('acreditado_referencias')
    .delete()
    .eq('acreditado_id', acreditadoId)

  if (delRefError) {
    return { ok: false, error: 'Error al actualizar las referencias. Verifica permisos o contacta al administrador.' }
  }

  if (refs.length > 0) {
    const { error: insRefError } = await supabase.from('acreditado_referencias').insert(
      refs.map(r => ({
        acreditado_id: acreditadoId,
        calidad: r.calidad,
        nombre_referencia: r.nombre_referencia ?? null,
      }))
    )
    if (insRefError) {
      return { ok: false, error: 'Error al guardar las referencias.' }
    }
  }

  const numero = actual.numero as number
  revalidatePath('/score/acreditados')
  revalidatePath(`/score/acreditados/${numero}`)
  revalidatePath(`/score/acreditados/${numero}/editar`)
  return { ok: true, numero }
}

// ─── Guardar evaluación del promotor ──────────────────────────────────────────

export async function guardarEvaluacion(
  acreditadoId: string,
  raw: unknown
): Promise<{ ok: boolean; error?: string }> {
  const parsed = evaluacionSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.rpc('guardar_evaluacion_promotor', {
    p_acreditado_id: acreditadoId,
    p_calificacion: parsed.data.calificacion_promotor,
    p_justificacion: parsed.data.justificacion_promotor,
  })

  if (error) {
    const msg = error.message
    if (msg.includes('sin_acceso')) return { ok: false, error: 'No tienes acceso al módulo de score.' }
    if (msg.includes('justificacion_invalida')) return { ok: false, error: 'La justificación debe tener al menos 10 caracteres.' }
    if (msg.includes('no_existe')) return { ok: false, error: 'Registro no encontrado.' }
    return { ok: false, error: 'Error al guardar la evaluación.' }
  }

  const { data: row } = await supabase
    .from('acreditados')
    .select('numero')
    .eq('id', acreditadoId)
    .single()

  revalidatePath('/score/acreditados')
  if (row) {
    const numero = (row as { numero: number }).numero
    revalidatePath(`/score/acreditados/${numero}`)
  }

  return { ok: true }
}

// ─── Eliminar acreditado ───────────────────────────────────────────────────────

export async function eliminarAcreditado(
  acreditadoId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { data: row } = await supabase
    .from('acreditados')
    .select('capturado_por_id')
    .eq('id', acreditadoId)
    .single()

  if (!row) return { ok: false, error: 'Registro no encontrado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  const rol = (profile as { rol: string } | null)?.rol ?? 'usuario'
  const capturadoPorId = (row as { capturado_por_id: string }).capturado_por_id

  if (rol !== 'admin' && user.id !== capturadoPorId) {
    return { ok: false, error: 'No tienes permiso para eliminar este registro.' }
  }

  const { error } = await supabase.from('acreditados').delete().eq('id', acreditadoId)

  if (error) {
    return { ok: false, error: 'Error al eliminar el registro.' }
  }

  revalidatePath('/score/acreditados')
  revalidatePath('/dashboard')
  return { ok: true }
}
