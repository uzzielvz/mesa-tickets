import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8001'

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

  const { data: upload } = await supabase
    .from('cartera_uploads')
    .select('id, estado, fecha_corte, storage_path')
    .eq('id', uploadId)
    .single()

  if (!upload) return NextResponse.json({ error: 'Upload no encontrado' }, { status: 404 })
  if (upload.estado === 'procesando') {
    return NextResponse.json({ error: 'Ya está procesando' }, { status: 409 })
  }
  if (!upload.storage_path) {
    return NextResponse.json({ error: 'El upload no tiene archivo asociado' }, { status: 400 })
  }

  // Llamar al microservicio Python (el servicio maneja el estado internamente)
  try {
    const resp = await fetch(`${PYTHON_SERVICE_URL}/cartera/procesar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: uploadId,
        fecha_corte: upload.fecha_corte,
        storage_path: upload.storage_path,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      return NextResponse.json({ error: `Microservicio: ${detail}` }, { status: 502 })
    }

    const result = await resp.json()
    return NextResponse.json({ ok: true, registros: result.registros_insertados })
  } catch (err) {
    await supabase
      .from('cartera_uploads')
      .update({ estado: 'error', error_detalle: String(err) })
      .eq('id', uploadId)
    return NextResponse.json({ error: 'No se pudo conectar al microservicio' }, { status: 502 })
  }
}
