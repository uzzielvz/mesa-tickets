import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import CarteraAccesos from '@/components/admin/cartera-accesos'

export default async function CarteraAccesosPage() {
  const supabase = createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre_completo, email, acceso_cartera')
    .order('nombre_completo')

  return (
    <div>
      <Header title="Accesos — Cartera" subtitle="Activa o desactiva el módulo de Cartera Individual por usuario." />
      <div className="px-5 md:px-9 pb-12">
        <CarteraAccesos profiles={profiles ?? []} />
      </div>
    </div>
  )
}
