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

  // Sin ningún acceso otorgado → sala de espera corporativa.
  // El área y los accesos los asigna un admin desde /admin/usuarios.
  const tieneAlgunAcceso =
    profile.rol === 'admin' ||
    profile.acceso_tickets === true ||
    profile.acceso_score === true ||
    profile.acceso_cartera === true ||
    profile.acceso_reclutamiento === true

  if (!tieneAlgunAcceso) redirect('/stand-by')

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
      <main className="flex-1 min-w-0 w-full max-w-[1100px]">
        {children}
      </main>
    </div>
  )
}
