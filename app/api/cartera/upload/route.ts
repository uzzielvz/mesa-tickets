import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }

  const archivo = formData.get('archivo') as File | null
  const fechaCorte = formData.get('fecha_corte') as string | null

  if (!archivo) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!fechaCorte) return NextResponse.json({ error: 'Falta la fecha de corte' }, { status: 400 })

  if (!archivo.name.endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos .xlsx' }, { status: 400 })
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: `El archivo supera ${MAX_MB}MB` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cartera_uploads')
    .insert({
      fecha_corte: fechaCorte,
      nombre_archivo: archivo.name,
      drive_file_id: null,
      subido_por: user.id,
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Error al registrar la carga' }, { status: 500 })
  }

  return NextResponse.json({ uploadId: data.id })
}
