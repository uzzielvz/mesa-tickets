import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import UsuariosAdmin from '@/components/admin/usuarios-admin'

export default async function UsuariosPage() {
  const supabase = createClient()
  const [{ data: profiles }, { data: areas }] = await Promise.all([
    supabase.from('profiles').select('*').order('nombre_completo'),
    supabase.from('areas').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  return (
    <div>
      <Header title="Usuarios" subtitle="Gestiona roles y áreas del equipo." />
      <div className="px-5 md:px-9 pb-12">
        <UsuariosAdmin profiles={profiles ?? []} areas={areas ?? []} />
      </div>
    </div>
  )
}
