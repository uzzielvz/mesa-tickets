import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TipoReporte } from '@/lib/inversiones/excel'

export const runtime = 'nodejs'

const BUCKET = 'inversiones'
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Qué bandera abre cada reporte. */
const BANDERA: Record<TipoReporte, 'acceso_inversiones_pagos' | 'acceso_inversiones_desempeno'> = {
  calendario: 'acceso_inversiones_pagos',
  tablero: 'acceso_inversiones_desempeno',
}

/**
 * Devuelve el .xlsx original, tal como lo subió Felix.
 *
 * ⚠ El permiso se revalida AQUÍ, contra el `tipo_reporte` de la carga que se
 * pide — no se sirve por `storage_path`. Un path filtrado o adivinado no puede
 * ser suficiente para bajar el archivo: **el original trae la CLABE de todos los
 * fondeadores**. Las políticas de Storage (migración inv_003) dicen lo mismo por
 * segunda vez; que las dos capas coincidan es intencional.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: carga } = await supabase
    .from('inv_cargas')
    .select('tipo_reporte, storage_path, nombre_archivo')
    .eq('id', params.id)
    .maybeSingle()

  if (!carga) return NextResponse.json({ error: 'Carga no encontrada' }, { status: 404 })

  const tipo = carga.tipo_reporte as TipoReporte
  const bandera = BANDERA[tipo]
  if (!bandera) {
    return NextResponse.json({ error: 'Tipo de reporte desconocido' }, { status: 500 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`rol, ${bandera}`)
    .eq('id', user.id)
    .single()

  const perfil = profile as Record<string, unknown> | null
  const puede = perfil?.rol === 'admin' || perfil?.[bandera] === true
  if (!puede) return NextResponse.json({ error: 'Sin acceso a este reporte' }, { status: 403 })

  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(carga.storage_path as string)

  if (error || !blob) {
    return NextResponse.json(
      { error: 'El archivo ya no está disponible en el almacenamiento' },
      { status: 404 },
    )
  }

  const nombre = (carga.nombre_archivo as string).replace(/["\\]/g, '')

  return new NextResponse(await blob.arrayBuffer(), {
    headers: {
      'Content-Type': MIME_XLSX,
      'Content-Disposition': `attachment; filename="${nombre}"`,
      // El original es inmutable, pero es material sensible: no debe quedarse en
      // caches intermedios.
      'Cache-Control': 'private, no-store',
    },
  })
}
