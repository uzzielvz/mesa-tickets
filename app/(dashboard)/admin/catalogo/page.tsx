import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import CatalogoAdmin from '@/components/admin/catalogo-admin'

export default async function CatalogoPage() {
  const supabase = createClient()
  const [{ data: catalog }, { data: areas }, { data: profiles }] = await Promise.all([
    supabase.from('problem_catalog').select('*').order('nombre'),
    supabase.from('areas').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('profiles').select('id, nombre_completo').eq('activo', true).order('nombre_completo'),
  ])

  return (
    <div>
      <Header title="Catálogo de problemas" subtitle="Define los tipos de problema por área." />
      <div className="px-5 md:px-9 pb-12">
        <CatalogoAdmin catalog={catalog ?? []} areas={areas ?? []} profiles={profiles ?? []} />
      </div>
    </div>
  )
}
