import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { abrirLibro, type TipoReporte } from '@/lib/inversiones/excel'
import { procesarCarga, marcarCarga } from '@/lib/inversiones/procesar'

export const runtime = 'nodejs'

const BUCKET = 'inversiones'

/**
 * Vuelve a leer los hechos de una carga a partir del .xlsx que ya está guardado.
 *
 * Existe porque el parser va a cambiar: cada corrección deja desactualizado lo
 * que se ingirió con la versión anterior. Sin esto, la única salida sería
 * borrar la carga y pedirle a Felix que suba el archivo otra vez — perdiendo la
 * bitácora, que es justo lo que no se debe perder.
 *
 * Es idempotente: `procesarCarga` borra lo previo de esta carga antes de
 * insertar, así que correrlo dos veces deja el mismo resultado que una.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Reprocesar reescribe datos: es de quien carga, no de quien consulta.
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_carga')
    .eq('id', user.id)
    .single()

  const puede = profile?.rol === 'admin' ||
    (profile as { acceso_inversiones_carga?: boolean } | null)?.acceso_inversiones_carga === true
  if (!puede) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { data: carga } = await supabase
    .from('inv_cargas')
    .select('id, tipo_reporte, storage_path, avisos')
    .eq('id', params.id)
    .maybeSingle()

  if (!carga) return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 })

  const { data: blob, error: errBajada } = await supabase.storage
    .from(BUCKET)
    .download(carga.storage_path as string)

  if (errBajada || !blob) {
    return NextResponse.json(
      { error: 'El archivo original ya no está en el almacenamiento' },
      { status: 404 },
    )
  }

  let wb
  try {
    wb = await abrirLibro(await blob.arrayBuffer())
  } catch (e) {
    return NextResponse.json({
      error: 'El archivo guardado no se pudo abrir',
      errores: [e instanceof Error ? e.message : String(e)],
    }, { status: 422 })
  }

  const resultado = await procesarCarga(
    supabase,
    carga.id as string,
    carga.tipo_reporte as TipoReporte,
    wb,
  )

  // Los avisos de la subida (corte futuro, duplicado) describen el archivo y
  // siguen siendo ciertos; se conservan y se les suman los del parseo.
  const previos = ((carga.avisos as string[] | null) ?? []).filter(
    a => !a.startsWith('Sección no reconocida') && !a.includes('sin fecha legible'),
  )
  const resumen = resultado.ok ? resultado.resumen : null
  await marcarCarga(supabase, carga.id as string, resultado, previos, resumen?.filas ?? 0)

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, errores: resultado.errores }, { status: 422 })
  }

  return NextResponse.json({ ok: true, resumen, avisos: resultado.avisos })
}
