import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { constanciaPdf } from '@/lib/vacaciones/constancia-pdf'
import { camposFormato, nombreArchivoFormato } from '@/lib/vacaciones/formato'
import type { DatosFormato } from '@/lib/vacaciones/tipos'

// pdf-lib y fontkit son Node puro: no corren en el runtime edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * El formato GYC como PDF (VAC-008). Mismos permisos que la página del
 * formato: los decide `vac_formato` (Gente y Cultura, la persona o su jefe).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Formato no encontrado' }, { status: 404 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await supabase.rpc('vac_formato', { p_movimiento: params.id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 })
  }
  const datos = data as unknown as DatosFormato | null
  if (!datos || !datos.movimiento.fecha_inicio) {
    return NextResponse.json({ error: 'Formato no encontrado o anulado' }, { status: 404 })
  }

  const pdf = await constanciaPdf(datos)
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivoFormato(camposFormato(datos))}"`,
      'Cache-Control': 'no-store',
    },
  })
}
