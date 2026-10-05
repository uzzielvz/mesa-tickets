import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guarda de módulo. Entran dos audiencias:
 *   · Gente y Cultura (bandera `acceso_vacaciones_rh` o admin): todo el personal.
 *   · Cualquier persona cuyo correo esté en la base (VAC-004): "Mis vacaciones"
 *     y, si tiene equipo, "Mi equipo".
 * Cada pantalla de RH vuelve a comprobar su bandera; los RPCs del empleado y
 * del jefe solo devuelven lo de quien pregunta.
 */
export default async function VacacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { data: yo }] = await Promise.all([
    supabase.from('profiles').select('rol, acceso_vacaciones_rh').eq('id', user.id).single(),
    supabase.rpc('vac_mi_empleado', {}),
  ])

  const p = profile as Record<string, unknown> | null
  const rh = p?.rol === 'admin' || p?.acceso_vacaciones_rh === true
  if (!rh && !yo) redirect('/dashboard')

  return <>{children}</>
}
