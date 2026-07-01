import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CandidatoForm from '@/components/reclutamiento/candidato-form'
import type { RecEtapa, RecFuente, RecRevisionCv, RecMotivoDescarte } from '@/lib/supabase/types'

export const metadata = { title: 'Editar candidato — Reclutamiento' }

export default async function EditarCandidatoPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data } = await supabase
    .from('rec_candidatos')
    .select('id, vacante_id, nombre, email, telefono, fuente, etapa, revision_cv, motivo_descarte, cv_storage_path, notas')
    .eq('id', params.id)
    .single()

  if (!data) notFound()

  const candidato = data as {
    id: string
    vacante_id: string
    nombre: string
    email: string | null
    telefono: string | null
    fuente: RecFuente | null
    etapa: RecEtapa
    revision_cv: RecRevisionCv | null
    motivo_descarte: RecMotivoDescarte | null
    cv_storage_path: string | null
    notas: string | null
  }

  const { data: vacData } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, estado')
    .order('created_at', { ascending: false })

  const vacantes = (vacData ?? []) as { id: string; titulo: string; estado: 'abierta' | 'cerrada' }[]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/reclutamiento/candidatos?vacante=${candidato.vacante_id}`}
          className="flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700 transition-colors"
        >
          <ChevronLeft size={13} />
          Candidatos
        </Link>
        <span className="text-ink-300 text-[12.5px]">/</span>
        <span className="text-[12.5px] text-ink-700">{candidato.nombre}</span>
      </div>

      <h1 className="text-[18px] font-semibold text-ink-900">Editar candidato</h1>

      <CandidatoForm vacantes={vacantes} initialData={candidato} />
    </div>
  )
}
