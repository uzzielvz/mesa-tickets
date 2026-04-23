import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import AreasAdmin from '@/components/admin/areas-admin'

export default async function AreasPage() {
  const supabase = createClient()
  const { data: areas } = await supabase
    .from('areas')
    .select('*')
    .order('nombre')

  return (
    <div>
      <Header title="Áreas" subtitle="Gestiona las áreas de la empresa." />
      <div className="px-5 md:px-9 pb-12">
        <AreasAdmin areas={areas ?? []} />
      </div>
    </div>
  )
}
