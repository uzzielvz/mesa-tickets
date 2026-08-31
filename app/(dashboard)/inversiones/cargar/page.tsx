import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import CargaInversiones from '@/components/inversiones/carga-form'

export const dynamic = 'force-dynamic'

export default async function CargarInversionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_carga')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  // Pertenecer al módulo no basta para cargar: quien solo consulta no sube.
  if (!(p?.rol === 'admin' || p?.acceso_inversiones_carga === true)) {
    redirect('/inversiones')
  }

  return (
    <div>
      <Header
        title="Cargar reporte"
        subtitle="Sube el archivo que generaste; el sistema reconoce cuál es."
        action={
          <Link href="/inversiones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12">
        <CargaInversiones />
      </div>
    </div>
  )
}
