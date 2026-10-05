import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leerBaseVacaciones } from '@/lib/vacaciones/base-excel'

// exceljs es Node puro: no corre en el runtime edge.
export const runtime = 'nodejs'

// La base pesa ~45 KB; el tope real lo pone Vercel (4.5 MB por petición).
const MAX_BYTES = 4 * 1024 * 1024

/**
 * Import de la base de Excel de Gente y Cultura (VAC-001). El archivo se lee
 * aquí y se escribe de una sola vez con `vac_importar_base`, que es atómico:
 * o entra todo o nada. El archivo no se guarda; la plataforma pasa a ser la
 * base.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: puede } = await supabase.rpc('has_vacaciones_rh', {})
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

  const lectura = await leerBaseVacaciones(await archivo.arrayBuffer())
  if (!lectura.ok) {
    return NextResponse.json({ error: 'No se reconoce este archivo', errores: lectura.errores }, { status: 422 })
  }

  const { data, error } = await supabase.rpc('vac_importar_base', { p_empleados: lectura.empleados })
  if (error) {
    return NextResponse.json({ error: `No se pudo importar: ${error.message}`, errores: [] }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    hojas: lectura.hojas,
    empleados: lectura.empleados.length,
    resultado: data as { nuevos: number; actualizados: number; movimientos: number },
    avisos: lectura.avisos,
  })
}
