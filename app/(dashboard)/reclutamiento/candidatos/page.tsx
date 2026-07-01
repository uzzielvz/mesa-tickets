import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CandidatoList from '@/components/reclutamiento/candidato-list'
import type { RecEtapa } from '@/lib/supabase/types'

export const metadata = { title: 'Candidatos — Reclutamiento' }

interface CandidatoRow {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  fuente: string | null
  etapa: RecEtapa
  revision_cv: string | null
  motivo_descarte: string | null
  cv_storage_path: string | null
  created_at: string
}

export default async function CandidatosPage({
  searchParams,
}: {
  searchParams: { vacante?: string; etapa?: string }
}) {
  const supabase = createClient()

  const { data: vacData } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, estado')
    .order('created_at', { ascending: false })

  const vacantes = (vacData ?? []) as { id: string; titulo: string; estado: 'abierta' | 'cerrada' }[]

  // Vacante seleccionada: la del query o la primera disponible.
  const vacanteId = searchParams.vacante ?? vacantes[0]?.id ?? null

  let candidatos: CandidatoRow[] = []
  if (vacanteId) {
    const { data } = await supabase
      .from('rec_candidatos')
      .select('id, nombre, email, telefono, fuente, etapa, revision_cv, motivo_descarte, cv_storage_path, created_at')
      .eq('vacante_id', vacanteId)
      .order('created_at', { ascending: false })
    candidatos = (data ?? []) as CandidatoRow[]
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">Candidatos</h1>
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

      <CandidatoList
        vacantes={vacantes}
        vacanteId={vacanteId}
        candidatos={candidatos}
        etapaFiltro={searchParams.etapa ?? ''}
      />
    </div>
  )
}
