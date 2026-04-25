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

  // Calcular score en servidor
  const refs = referencias as Referencia[]
  const { puntaje } = calcularScore(campos, refs)
  const clasif = clasificar(puntaje)

  // Insertar acreditado
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

  if (error || !acreditado) {
    return { ok: false, error: 'Error al guardar el registro.' }
  }

  // Insertar referencias
  if (refs.length > 0) {
    await supabase.from('acreditado_referencias').insert(
      refs.map(r => ({
        acreditado_id: (acreditado as { id: string; numero: number }).id,
        calidad: r.calidad,
        nombre_referencia: r.nombre_referencia ?? null,
      }))
    )
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

  // Leer registro actual para comparar
  const { data: actualRaw } = await supabase
    .from('acreditados')
    .select('*')
    .eq('id', acreditadoId)
    .single()

  if (!actualRaw) return { ok: false, error: 'Registro no encontrado.' }

  const actual = actualRaw as Record<string, unknown>

  const { referencias, ...campos } = parsed.data

  // Calcular nuevo score
  const refs = referencias as Referencia[]
  const { puntaje } = calcularScore(campos, refs)
  const clasif = clasificar(puntaje)

  // Detectar cambios campo por campo
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

  // Insertar historial si hay cambios
  if (cambios.length > 0) {
    await supabase.from('acreditado_historial').insert(cambios)
  }

  // Actualizar registro
  const { error } = await supabase
    .from('acreditados')
    .update({
      ...campos,
      puntaje_total: puntaje,
      clasificacion_modelo: clasif.letra,
      contador_ediciones: ((actual.contador_ediciones as number) ?? 0) + 1,
    })
    .eq('id', acreditadoId)

  if (error) return { ok: false, error: 'Error al actualizar el registro.' }

  // Reemplazar referencias
  await supabase.from('acreditado_referencias').delete().eq('acreditado_id', acreditadoId)
  if (refs.length > 0) {
    await supabase.from('acreditado_referencias').insert(
      refs.map(r => ({
        acreditado_id: acreditadoId,
        calidad: r.calidad,
        nombre_referencia: r.nombre_referencia ?? null,
      }))
    )
  }

  revalidatePath('/score/acreditados')
  revalidatePath(`/score/acreditados/${actual.numero}`)
  return { ok: true, numero: actual.numero as number }
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

  const { error } = await supabase
    .from('acreditados')
    .update({
      calificacion_promotor: parsed.data.calificacion_promotor,
      justificacion_promotor: parsed.data.justificacion_promotor,
      promotor_id: user.id,
    })
    .eq('id', acreditadoId)

  if (error) return { ok: false, error: 'Error al guardar la evaluación.' }

  revalidatePath(`/score/acreditados`)
  return { ok: true }
}
