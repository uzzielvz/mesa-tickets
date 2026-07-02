import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PipelineBoard from '@/components/reclutamiento/pipeline-board'
import type { RecEtapa, RecMotivoDescarte } from '@/lib/supabase/types'

export const metadata = { title: 'Pipeline — Reclutamiento' }

export interface PipelineCandidato {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  etapa: RecEtapa
  motivo_descarte: RecMotivoDescarte | null
  created_at: string
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: { vacante?: string }
}) {
  const supabase = createClient()

  const { data: vacData } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, estado')
    .order('created_at', { ascending: false })

  const vacantes = (vacData ?? []) as { id: string; titulo: string; estado: 'abierta' | 'cerrada' }[]

  // Vacante seleccionada: la del query o la primera disponible.
  const vacanteId = searchParams.vacante ?? vacantes[0]?.id ?? null

  let candidatos: PipelineCandidato[] = []
  if (vacanteId) {
    const { data } = await supabase
      .from('rec_candidatos')
      .select('id, nombre, email, telefono, etapa, motivo_descarte, created_at')
      .eq('vacante_id', vacanteId)
      .order('created_at', { ascending: false })
    candidatos = (data ?? []) as PipelineCandidato[]
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">Pipeline</h1>
          <p className="text-[13px] text-ink-400 mt-0.5">
            {vacanteId ? `${candidatos.length} candidato${candidatos.length !== 1 ? 's' : ''}` : 'Selecciona una vacante'}
          </p>
        </div>
        {vacanteId && (
          <Link
            href={`/reclutamiento/candidatos/nuevo?vacante=${vacanteId}`}
            className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-4 py-[7px] transition-colors"
          >
            <Plus size={13} />
            Nuevo candidato
          </Link>
        )}
      </div>

      <PipelineBoard vacantes={vacantes} vacanteId={vacanteId} candidatos={candidatos} />
    </div>
  )
}
