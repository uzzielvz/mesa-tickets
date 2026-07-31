'use server'

// Ajustes del módulo de Reclutamiento (S7.5, REC-071).
// El RLS de rec_ajustes y rec_plantillas_correo ya restringe la escritura a
// admin / acceso_reclutamiento; aquí solo se valida la forma del dato y se
// registra quién lo cambió.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  ajustesDgSchema, ajustesDestinatariosSchema, ccPlantillaSchema,
  ajustesFactorialSchema,
} from '@/lib/schemas/reclutamiento'

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

// Las páginas que consumen los ajustes: si cambia un correo, todas deben releer.
function revalidarConsumidores() {
  revalidatePath('/reclutamiento/ajustes')
  revalidatePath('/reclutamiento/pipeline')
  revalidatePath('/reclutamiento/comite')
}

export async function guardarAjustesDg(raw: unknown): Promise<Result> {
  const parsed = ajustesDgSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.from('rec_ajustes').upsert({
    clave: 'dg',
    valor: parsed.data,
    actualizado_at: new Date().toISOString(),
    actualizado_por: user.id,
  })
  if (error) return { ok: false, error: 'No se pudieron guardar los datos de la Dirección General.' }

  revalidarConsumidores()
  return { ok: true }
}

export async function guardarDestinatariosAltas(raw: unknown): Promise<Result> {
  const parsed = ajustesDestinatariosSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.from('rec_ajustes').upsert({
    clave: 'alta_destinatarios',
    valor: parsed.data,
    actualizado_at: new Date().toISOString(),
    actualizado_por: user.id,
  })
  if (error) return { ok: false, error: 'No se pudieron guardar los destinatarios de altas.' }

  revalidarConsumidores()
  return { ok: true }
}

export async function guardarAjustesFactorial(raw: unknown): Promise<Result> {
  const parsed = ajustesFactorialSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.from('rec_ajustes').upsert({
    clave: 'factorial',
    valor: parsed.data,
    actualizado_at: new Date().toISOString(),
    actualizado_por: user.id,
  })
  if (error) return { ok: false, error: 'No se pudo guardar la sincronización con Factorial.' }

  revalidarConsumidores()
  return { ok: true }
}

export async function guardarCcPlantilla(raw: unknown): Promise<Result> {
  const parsed = ccPlantillaSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('rec_plantillas_correo')
    .update({ cc_emails: parsed.data.cc_emails })
    .eq('codigo', parsed.data.codigo)
  if (error) return { ok: false, error: 'No se pudieron guardar los correos en copia.' }

  revalidarConsumidores()
  return { ok: true }
}
