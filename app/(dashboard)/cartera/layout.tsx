import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AssistantWidget from '@/components/cartera/assistant-widget'

export default async function CarteraLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_cartera')
    .eq('id', user.id)
    .single()

  const tieneAcceso = profile?.rol === 'admin' || profile?.acceso_cartera === true

  if (!tieneAcceso) redirect('/dashboard')

  return (
    <div className="px-5 pt-16 pb-10 md:px-9 md:pt-9 md:pb-10">
      {children}
      <AssistantWidget />
    </div>
  )
}
