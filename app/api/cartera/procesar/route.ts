import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_cartera')
    .eq('id', user.id)
    .single()

  const tieneAcceso = profile?.rol === 'admin' || profile?.acceso_cartera === true
  if (!tieneAcceso) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const uploadId = searchParams.get('uploadId')
  if (!uploadId) return NextResponse.json({ error: 'Falta uploadId' }, { status: 400 })

  // Verificar que el upload existe
  const { data: upload } = await supabase
    .from('cartera_uploads')
    .select('id, estado')
    .eq('id', uploadId)
    .single()

  if (!upload) return NextResponse.json({ error: 'Upload no encontrado' }, { status: 404 })
  if (upload.estado === 'procesando') {
    return NextResponse.json({ error: 'Ya está procesando' }, { status: 409 })
  }

  // Marcar como procesando
  await supabase
    .from('cartera_uploads')
    .update({ estado: 'procesando' })
    .eq('id', uploadId)

  // TODO Sesión 3: llamar al microservicio Python aquí
  // Por ahora stub: marcar como procesado directamente
  const { error } = await supabase
    .from('cartera_uploads')
    .update({ estado: 'procesado', rows_inserted: 0 })
    .eq('id', uploadId)

  if (error) {
    await supabase
      .from('cartera_uploads')
      .update({ estado: 'error', error_detalle: error.message })
      .eq('id', uploadId)
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
