import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function TicketsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_tickets')
    .eq('id', user.id)
    .single()

  const tieneAcceso = profile?.rol === 'admin' || profile?.acceso_tickets === true

  if (!tieneAcceso) redirect('/dashboard')

  return <>{children}</>
}
