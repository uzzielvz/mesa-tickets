import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hoyMexico } from '@/lib/vacaciones/calendario'
import { informePdf } from '@/lib/vacaciones/informe-pdf'
import { cargarSeguimiento } from '@/lib/vacaciones/seguimiento-carga'

// pdf-lib es Node puro: no corre en el runtime edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Informe ejecutivo de vacaciones en PDF (VAC-009), para Gente y Cultura y
 * Dirección. Los RPCs vuelven a validar la bandera; esta revisión solo da un
 * 403 claro.
 */
export async function GET() {
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
    return NextResponse.json({ error: 'Solo Gente y Cultura descarga el informe' }, { status: 403 })
  }

  const hoy = hoyMexico()
  const datos = await cargarSeguimiento(supabase, hoy, 8)
  if (datos.error) return NextResponse.json({ error: datos.error.message }, { status: 500 })

  const pdf = await informePdf(datos, { generadoPor: p.nombre_completo?.trim() || p.email, generado: new Date() })
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informe_vacaciones_${hoy}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
