import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Guarda de módulo. La puerta de carga vuelve a comprobar la suya en su página. */
export default async function AuditorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_auditor, acceso_auditor_carga')
    .eq('id', user.id)
    .single()

  const p = profile as Record<string, unknown> | null
  const puede = p?.rol === 'admin' || p?.acceso_auditor === true || p?.acceso_auditor_carga === true
  if (!puede) redirect('/dashboard')

  return <>{children}</>
}
