import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mandarCorreosDeAvisos } from '@/lib/notificaciones/correo'
import type { CorreoPendiente } from '@/lib/notificaciones/tipos'

export const dynamic = 'force-dynamic'

/**
 * Manda los correos de los avisos que provocó quien llama (NTF-001). La base
 * solo le entrega los suyos (`ntf_correos_por_enviar`) y solo le deja marcar
 * esos. El navegador lo llama justo después de cada acción de vacaciones.
 */
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.rpc('ntf_correos_por_enviar', {})
  if (error) {
    console.error('[avisos] no se leyeron los correos pendientes:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const pendientes = (data as unknown as CorreoPendiente[] | null) ?? []
  const resultados = await mandarCorreosDeAvisos(pendientes)
  if (resultados.length > 0) {
    const { error: e } = await supabase.rpc('ntf_correo_resultado', { p_resultados: resultados })
    if (e) console.error('[avisos] no se guardó el resultado de los correos:', e.message)
  }

  return NextResponse.json({ pendientes: pendientes.length, enviados: resultados.filter(r => r.ok).length })
}
