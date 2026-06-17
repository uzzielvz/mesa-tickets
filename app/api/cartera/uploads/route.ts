import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerUploadsRecientes } from '@/lib/cartera/uploads'

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

  const uploads = await obtenerUploadsRecientes(supabase)
  return NextResponse.json({ uploads })
}
