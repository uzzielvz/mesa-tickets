import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/sidebar'
import type { MiContexto } from '@/lib/vacaciones/tipos'

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

  // Vacaciones (VAC-004): cualquiera cuyo correo esté en la base de Gente y
  // Cultura entra a "Mis vacaciones" sin bandera, y quien tiene equipo ve sus
  // solicitudes por autorizar. Es lo único que un empleado sin accesos ve.
  const { data: ctxData } = await supabase.rpc('vac_mi_contexto', {})
  const vac = (ctxData as unknown as MiContexto | null) ?? { empleado_id: null, es_jefe: false, pendientes_jefe: 0 }

  // Sin ningún acceso otorgado → sala de espera corporativa.
  // El área y los accesos los asigna un admin desde /admin/usuarios.
  const tieneAlgunAcceso =
    vac.empleado_id !== null ||
    profile.rol === 'admin' ||
    profile.acceso_tickets === true ||
    profile.acceso_score === true ||
    profile.acceso_cartera === true ||
    profile.acceso_reclutamiento === true ||
    profile.acceso_actividades === true ||
    profile.acceso_inversiones_carga === true ||
    profile.acceso_inversiones_pagos === true ||
    profile.acceso_inversiones_desempeno === true ||
    profile.acceso_ahorros === true ||
    profile.acceso_ahorros_carga === true ||
    profile.acceso_vacaciones_rh === true ||
    profile.acceso_auditor === true ||
    profile.acceso_auditor_carga === true

  if (!tieneAlgunAcceso) redirect('/stand-by')

  // Contadores para el sidebar. El de la cola cuenta solo lo que NADIE ha
  // tomado: es la cifra que exige acción del área, no el total del área.
  const [{ count: miosCount }, { count: asignadosCount }, { count: colaCount }] =
    await Promise.all([
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
      profile.area_id
        ? supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('area_id', profile.area_id)
            .is('responsable_id', null)
            .is('closed_at', null)
        : Promise.resolve({ count: 0 }),
    ])

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar
        profile={profile}
        counts={{
          mios: miosCount ?? 0,
          asignados: asignadosCount ?? 0,
          cola: colaCount ?? 0,
        }}
        vac={vac}
      />
      <main className="flex-1 min-w-0 w-full max-w-[1100px]">
        {children}
      </main>
    </div>
  )
}
