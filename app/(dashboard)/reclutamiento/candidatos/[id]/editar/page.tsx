import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CandidatoForm from '@/components/reclutamiento/candidato-form'
import EtapaStepper from '@/components/reclutamiento/etapa-stepper'
import CandidatoGuia from '@/components/reclutamiento/candidato-guia'
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

  // S6 (REC-058): abrir el perfil de un postulado lo mueve automáticamente a
  // "En revisión" (la RPC valida el DAG y registra el cambio en el historial).
  if (candidato.etapa === 'postulado') {
    const { error } = await supabase.rpc('rec_transicion_etapa', {
      p_candidato_id: candidato.id,
      p_etapa_destino: 'en_revision',
      p_motivo_descarte: null,
      p_notas: 'Apertura de perfil',
    })
    if (!error) candidato.etapa = 'en_revision'
  }

  const { data: vacData } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, estado')
    .order('created_at', { ascending: false })

  const vacantes = (vacData ?? []) as { id: string; titulo: string; estado: 'abierta' | 'cerrada' }[]

  // Progreso de evaluaciones: cuántos entrevistadores ya registraron su
  // valoración (evaluación con recomendación) sobre el total de entrevistas.
  // Alimenta la tarjeta guía para saber cuándo el candidato está listo para comité.
  let evalProgress: { registradas: number; total: number } | null = null
  const { data: entData } = await supabase
    .from('rec_entrevistas')
    .select('id')
    .eq('candidato_id', candidato.id)
  const entrevistas = (entData ?? []) as { id: string }[]
  if (entrevistas.length > 0) {
    const { data: evalData } = await supabase
      .from('rec_evaluaciones')
      .select('entrevista_id, recomendacion')
      .in('entrevista_id', entrevistas.map(e => e.id))
    const registradas = ((evalData ?? []) as { recomendacion: string | null }[])
      .filter(e => e.recomendacion).length
    evalProgress = { registradas, total: entrevistas.length }
  }

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

      <EtapaStepper etapa={candidato.etapa} />

      <CandidatoGuia etapa={candidato.etapa} vacanteId={candidato.vacante_id} evalProgress={evalProgress} />

      <h1 className="text-[18px] font-semibold text-ink-900">Editar candidato</h1>

      <CandidatoForm vacantes={vacantes} initialData={candidato} />
    </div>
  )
}
