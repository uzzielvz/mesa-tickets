import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guarda de módulo. En la fase 1 solo entra Gente y Cultura: la pantalla
 * enseña nombres, antigüedad y saldos de todo el personal. La fase 2 abrirá una
 * vista propia para cada empleado y su jefe.
 */
export default async function VacacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_vacaciones_rh')
    .eq('id', user.id)
    .single()

  const p = profile as Record<string, unknown> | null
  if (!(p?.rol === 'admin' || p?.acceso_vacaciones_rh === true)) redirect('/dashboard')

  return <>{children}</>
}
