import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Contadores para el sidebar
  const [{ count: miosCount }, { count: asignadosCount }] = await Promise.all([
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('levantado_por_id', user.id)
      .is('closed_at', null),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('responsable_id', user.id)
      .is('closed_at', null),
  ])

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar
        profile={profile}
        counts={{
          mios: miosCount ?? 0,
          asignados: asignadosCount ?? 0,
        }}
      />
      <main className="flex-1 min-w-0 w-full">
        {children}
      </main>
    </div>
  )
}
