import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CandidatoForm from '@/components/reclutamiento/candidato-form'
import VolverPipeline from '@/components/reclutamiento/volver-pipeline'

export const metadata = { title: 'Nuevo candidato — Reclutamiento' }

export default async function NuevoCandidatoPage({
  searchParams,
}: {
  searchParams: { vacante?: string }
}) {
  const supabase = createClient()
  const { data } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, estado')
    .order('created_at', { ascending: false })

  const vacantes = (data ?? []) as { id: string; titulo: string; estado: 'abierta' | 'cerrada' }[]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <VolverPipeline vacanteId={searchParams.vacante} />
        <span className="text-ink-300 text-[12.5px]">/</span>
        <span className="text-[12.5px] text-ink-700">Nuevo candidato</span>
      </div>

      <h1 className="text-[18px] font-semibold text-ink-900">Nuevo candidato</h1>

      {vacantes.length === 0 ? (
        <p className="text-[13px] text-ink-400">
          Primero crea una vacante.{' '}
          <Link href="/reclutamiento/vacantes/nueva" className="text-navy hover:underline">Crear vacante</Link>
        </p>
      ) : (
        <CandidatoForm vacantes={vacantes} vacanteIdInicial={searchParams.vacante} />
      )}
    </div>
  )
}
