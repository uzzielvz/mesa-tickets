import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guarda de módulo. El tablero muestra en qué se va el tiempo de cada persona
 * con nombre y apellido, así que no basta con que la RPC rechace la llamada:
 * quien no tiene acceso ni siquiera debe ver la pantalla armarse.
 */
export default async function ActividadesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_actividades')
    .eq('id', user.id)
    .single()

  const puede = profile?.rol === 'admin' ||
    (profile as { acceso_actividades?: boolean } | null)?.acceso_actividades === true

  if (!puede) redirect('/dashboard')

  return <>{children}</>
}
