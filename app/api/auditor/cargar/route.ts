import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leerPagosRegistrados } from '@/lib/auditor/excel'

// exceljs es Node puro: no corre en el runtime edge.
export const runtime = 'nodejs'

// El archivo de un mes pesa ~50 KB; el tope real lo pone Vercel (4.5 MB).
const MAX_BYTES = 4 * 1024 * 1024

/**
 * Carga del archivo de pagos registrados (AUD-001). Cada carga es una foto
 * completa y se escribe de una vez con `aud_cargar`, que es atómico.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: puede } = await supabase.rpc('has_auditor_carga', {})
  if (puede !== true) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }

  const archivo = formData.get('archivo') as File | null
  if (!archivo) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos .xlsx' }, { status: 400 })
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera 4 MB' }, { status: 400 })
  }

  const lectura = await leerPagosRegistrados(await archivo.arrayBuffer())
  if (!lectura.ok) {
    return NextResponse.json({ error: 'No se reconoce este archivo', errores: lectura.errores }, { status: 422 })
  }

  const { data, error } = await supabase.rpc('aud_cargar', {
    p_nombre: archivo.name,
    p_filas: lectura.filas,
    p_avisos: lectura.avisos,
  })
  if (error) {
    return NextResponse.json({ error: `No se pudo cargar: ${error.message}`, errores: [] }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resultado: data, avisos: lectura.avisos })
}
