import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hoyMexico } from '@/lib/vacaciones/calendario'
import { describirFiltro, filtrarPersonal } from '@/lib/vacaciones/filtro'
import { MIME_XLSX, libroBase, libroPeriodo, type DiaTomado } from '@/lib/vacaciones/reportes'
import { leerVer, type ReportePeriodo, type SaldoEmpleado } from '@/lib/vacaciones/tipos'

// exceljs es Node puro: no corre en el runtime edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reportes de Gente y Cultura en Excel (VAC-008).
 *   ?tipo=base&ver=&q=          la base al día, con el filtro de la pantalla
 *   ?tipo=periodo&desde=&hasta= solicitudes y días tomados en un rango
 * Los RPCs vuelven a validar la bandera; esta revisión solo da un 403 claro.
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('profiles')
    .select('rol, acceso_vacaciones_rh, nombre_completo, email')
    .eq('id', user.id)
    .single()
  const p = perfil as { rol: string; acceso_vacaciones_rh: boolean; nombre_completo: string | null; email: string } | null
  if (!(p?.rol === 'admin' || p?.acceso_vacaciones_rh === true)) {
    return NextResponse.json({ error: 'Solo Gente y Cultura descarga reportes' }, { status: 403 })
  }
  const meta = { generadoPor: p.nombre_completo?.trim() || p.email, generado: new Date() }

  const url = new URL(request.url)
  const tipo = url.searchParams.get('tipo')
  let libro
  let nombre: string

  if (tipo === 'base') {
    const ver = leerVer(url.searchParams.get('ver'))
    const q = url.searchParams.get('q') ?? ''
    const [saldos, tomados] = await Promise.all([
      supabase.rpc('vac_saldos', {}),
      supabase
        .from('vac_movimientos')
        .select('empleado_id, tipo, dias, fecha_inicio, fecha_fin, fechas_texto')
        .is('anulado_at', null),
    ])
    const error = saldos.error ?? tomados.error
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const personas = filtrarPersonal((saldos.data as unknown as SaldoEmpleado[] | null) ?? [], ver, q)
    libro = libroBase(personas, (tomados.data ?? []) as DiaTomado[], describirFiltro(ver, q), meta)
    nombre = `vacaciones_base_${hoyMexico()}.xlsx`
  } else if (tipo === 'periodo') {
    const desde = url.searchParams.get('desde') ?? ''
    const hasta = url.searchParams.get('hasta') ?? ''
    if (!FECHA_ISO.test(desde) || !FECHA_ISO.test(hasta)) {
      return NextResponse.json({ error: 'Elige las dos fechas del rango' }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('vac_reporte_periodo', { p_desde: desde, p_hasta: hasta })
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 })
    libro = libroPeriodo(data as unknown as ReportePeriodo, desde, hasta, meta)
    nombre = `vacaciones_${desde}_a_${hasta}.xlsx`
  } else {
    return NextResponse.json({ error: 'Reporte desconocido' }, { status: 400 })
  }

  const buffer = await libro.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': MIME_XLSX,
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  })
}
