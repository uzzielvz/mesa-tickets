import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TIMEOUT_MINUTOS = 10

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Resetear uploads atascados en 'procesando' por más de TIMEOUT_MINUTOS
  const timeoutISO = new Date(Date.now() - TIMEOUT_MINUTOS * 60 * 1000).toISOString()
  await supabase
    .from('cartera_uploads')
    .update({ estado: 'error', error_detalle: `Timeout: sin respuesta después de ${TIMEOUT_MINUTOS} minutos` })
    .eq('estado', 'procesando')
    .lt('created_at', timeoutISO)

  const { data } = await supabase
    .from('cartera_uploads')
    .select('id, fecha_corte, nombre_archivo, estado, error_detalle, rows_inserted, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ uploads: data ?? [] })
}
