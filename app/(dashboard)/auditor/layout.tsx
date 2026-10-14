import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guarda de módulo. Entra quien tiene bandera y, sin bandera, el promotor o
 * gerente del reporte de antigüedad vigente (AUD-004); `aud_mi_papel` decide
 * las dos cosas. La puerta de carga vuelve a comprobar la suya en su página.
 */
export default async function AuditorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: papel } = await supabase.rpc('aud_mi_papel', {})
  if (!papel) redirect('/dashboard')

  return <>{children}</>
}
