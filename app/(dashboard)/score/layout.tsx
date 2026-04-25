import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ScoreLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_score')
    .eq('id', user.id)
    .single()

  const tieneAcceso = profile?.rol === 'admin' || (profile as { acceso_score?: boolean } | null)?.acceso_score === true

  if (!tieneAcceso) redirect('/dashboard')

  return <>{children}</>
}
