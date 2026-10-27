import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Panel } from '@/components/viz'
import AltaEmpleado from '@/components/vacaciones/alta-form'

export const dynamic = 'force-dynamic'

/**
 * Alta de personal (VAC-011). Antes solo se podía por SQL; ahora Gente y
 * Cultura da de alta a quien entra, y desde su ficha corrige datos o le da de
 * baja.
 */
export default async function AltaPersonalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_vacaciones_rh')
    .eq('id', user!.id)
    .single()
  const pr = profile as Record<string, unknown> | null
  if (!(pr?.rol === 'admin' || pr?.acceso_vacaciones_rh === true)) redirect('/vacaciones/mias')

  const { data: jefes } = await supabase
    .from('vac_empleados')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  return (
    <div>
      <Header
        title="Dar de alta"
        subtitle="Una persona nueva en la base de vacaciones."
        action={
          <Link href="/vacaciones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />
      <div className="px-5 md:px-9 pb-12 max-w-3xl">
        <Panel titulo="Datos de la persona">
          <AltaEmpleado posiblesJefes={(jefes ?? []) as { id: string; nombre: string }[]} />
        </Panel>
      </div>
    </div>
  )
}
