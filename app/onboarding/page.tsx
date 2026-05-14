import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingForm from '@/components/onboarding/onboarding-form'

export default async function OnboardingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre_completo, area_id, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  if (profile.area_id) redirect('/dashboard')

  const { data: areas } = await supabase
    .from('areas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  return (
    <OnboardingForm
      areas={areas ?? []}
      initialNombre={profile.nombre_completo ?? ''}
      initialEmail={profile.email}
    />
  )
}
