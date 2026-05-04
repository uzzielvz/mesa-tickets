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

  return (
    <div className="px-5 pt-16 pb-10 md:px-9 md:pt-9 md:pb-10">
      {children}
    </div>
  )
}
