import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mandarCorreosDeAvisos } from '@/lib/notificaciones/correo'
import type { CorreoPendiente } from '@/lib/notificaciones/tipos'
import type { Database } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

/**
 * Cron diario de Vercel (vercel.json). Manda los correos que nadie mandó: los
 * recordatorios del día (los crea `vac_recordatorios` con pg_cron a las 9:00)
 * y los que fallaron cuando se hizo la acción.
 *
 * Vercel firma la llamada con `Authorization: Bearer <CRON_SECRET>`. Sin
 * sesión, la ruta entra a la base con la llave pública y el MISMO secreto: la
 * base solo guarda su sha256 (`ntf_ajustes`) y sin él no entrega nada.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    return NextResponse.json({ error: 'CRON_SECRET sin configurar' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await supabase.rpc('ntf_correos_sistema', { p_secreto: secreto })
  if (error) {
    console.error('[avisos] cron: no se leyeron los correos pendientes:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const pendientes = (data as unknown as CorreoPendiente[] | null) ?? []
  const resultados = await mandarCorreosDeAvisos(pendientes)
  if (resultados.length > 0) {
    const { error: e } = await supabase.rpc('ntf_resultado_sistema', { p_secreto: secreto, p_resultados: resultados })
    if (e) {
      console.error('[avisos] cron: no se guardó el resultado de los correos:', e.message)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    pendientes: pendientes.length,
    enviados: resultados.filter(r => r.ok).length,
    fallidos: resultados.filter(r => !r.ok).length,
  })
}
