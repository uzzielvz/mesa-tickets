import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data } = await supabase
    .from('cartera_uploads')
    .select('id, fecha_corte, nombre_archivo, drive_file_id, subido_por, estado, error_detalle, rows_inserted, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ uploads: data ?? [] })
}
