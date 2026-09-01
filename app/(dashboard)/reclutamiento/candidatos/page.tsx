import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CandidatoList from '@/components/reclutamiento/candidato-list'
import VolverPipeline from '@/components/reclutamiento/volver-pipeline'
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
      <VolverPipeline vacanteId={vacanteId} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">Candidatos</h1>
          <p className="text-[13px] text-ink-400 mt-0.5">
            {vacanteId ? `${candidatos.length} candidato${candidatos.length !== 1 ? 's' : ''}` : 'Selecciona una vacante'}
          </p>
        </div>
        {vacanteId && (
          <div className="flex items-center gap-2">
            {/* El filtro de etapa vive en la URL, así que el CSV sale con los
                mismos candidatos que se están viendo. */}
            <a
              href={`/api/reclutamiento/exportar/candidatos?vacante=${vacanteId}${
                searchParams.etapa ? `&etapa=${searchParams.etapa}` : ''
              }`}
              className="flex items-center gap-1.5 border border-[#ECECEC] hover:bg-surface-hover text-ink-700 text-[12.5px] font-medium rounded px-3 py-[7px] transition-colors"
              title="Descarga los candidatos de esta vacante, con los filtros aplicados. Lleva datos personales: queda registrado quién lo exportó."
            >
              <Download size={13} />
              Exportar CSV
            </a>
            <Link
              href={`/reclutamiento/candidatos/nuevo?vacante=${vacanteId}`}
              className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-4 py-[7px] transition-colors"
            >
              <Plus size={13} />
              Nuevo candidato
            </Link>
          </div>
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
