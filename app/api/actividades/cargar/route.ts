import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leerExcelActividades } from '@/lib/actividades/excel'

// exceljs es Node puro (zip + streams): no corre en el runtime edge.
export const runtime = 'nodejs'

const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024
const LOTE = 500

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_actividades')
    .eq('id', user.id)
    .single()

  const puede = profile?.rol === 'admin' || (profile as { acceso_actividades?: boolean })?.acceso_actividades === true
  if (!puede) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

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
    return NextResponse.json({ error: `El archivo supera ${MAX_MB}MB` }, { status: 400 })
  }

  // ── Leer y validar antes de tocar la base ────────────────────────────────
  // El archivo se valida entero primero: no se borra un periodo hasta saber que
  // hay con qué reemplazarlo. Si el Excel viene mal, la base queda intacta.
  const lectura = await leerExcelActividades(await archivo.arrayBuffer())

  if (!lectura.ok) {
    return NextResponse.json({
      error: 'El archivo tiene problemas',
      errores: lectura.errores.slice(0, 20),
      total_errores: lectura.errores.length,
    }, { status: 422 })
  }

  const { data: carga, error: errCarga } = await supabase
    .from('act_cargas')
    .insert({
      nombre_archivo: archivo.name,
      periodos: lectura.periodos,
      registros: lectura.registros.length,
      estado: 'procesando',
      subido_por: user.id,
    })
    .select('id')
    .single()

  if (errCarga || !carga) {
    return NextResponse.json({ error: 'No se pudo registrar la carga' }, { status: 500 })
  }

  const fallar = async (detalle: string) => {
    await supabase.from('act_cargas')
      .update({ estado: 'error', error_detalle: detalle })
      .eq('id', carga.id)
    return NextResponse.json({ error: detalle }, { status: 500 })
  }

  // ── Reemplazo por periodo ────────────────────────────────────────────────
  // Volver a subir el mismo archivo debe ser inofensivo: se borra lo que había
  // de esos periodos y se vuelve a insertar. Los periodos que el archivo no
  // menciona no se tocan.
  const { error: errBorrado } = await supabase
    .from('act_registros')
    .delete()
    .in('periodo', lectura.periodos)

  if (errBorrado) return fallar(`No se pudieron limpiar los periodos: ${errBorrado.message}`)

  for (let i = 0; i < lectura.registros.length; i += LOTE) {
    const lote = lectura.registros.slice(i, i + LOTE).map(r => ({ ...r, carga_id: carga.id }))
    const { error } = await supabase.from('act_registros').insert(lote)
    if (error) return fallar(`Error al insertar registros: ${error.message}`)
  }

  // Catálogos: upsert, nunca borrado. Que un archivo no traiga a alguien no
  // significa que esa persona dejó de existir.
  if (lectura.puestos.length > 0) {
    const { error } = await supabase.from('act_puestos').upsert(
      lectura.puestos.map(p => ({ ...p, actualizado_at: new Date().toISOString() })),
      { onConflict: 'id_puesto' },
    )
    if (error) return fallar(`Error al guardar puestos: ${error.message}`)
  }

  if (lectura.empleados.length > 0) {
    const { error } = await supabase.from('act_empleados').upsert(
      lectura.empleados.map(e => ({ ...e, actualizado_at: new Date().toISOString() })),
      { onConflict: 'no_empleado' },
    )
    if (error) return fallar(`Error al guardar empleados: ${error.message}`)
  }

  await supabase.from('act_cargas').update({ estado: 'procesado' }).eq('id', carga.id)

  return NextResponse.json({
    ok: true,
    cargaId: carga.id,
    periodos: lectura.periodos,
    registros: lectura.registros.length,
    colaboradores: new Set(lectura.registros.map(r => r.no_empleado)).size,
    horas: Math.round(lectura.registros.reduce((s, r) => s + r.minutos, 0) / 60 * 100) / 100,
    empleados: lectura.empleados.length,
    puestos: lectura.puestos.length,
    avisos: lectura.avisos,
  })
}
