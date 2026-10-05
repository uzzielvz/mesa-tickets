import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guarda de módulo. Los RPCs ya rechazan a quien no tiene bandera, pero quien no
 * pertenece al módulo no debe ni ver la pantalla armarse. La puerta de carga
 * vuelve a comprobar la suya en su página.
 */
export default async function AhorrosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_ahorros, acceso_ahorros_carga')
    .eq('id', user.id)
    .single()

  const p = profile as Record<string, unknown> | null
  const puede = p?.rol === 'admin' || p?.acceso_ahorros === true || p?.acceso_ahorros_carga === true

  if (!puede) redirect('/dashboard')

  return <>{children}</>
}
