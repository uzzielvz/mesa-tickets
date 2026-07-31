import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Columns3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CandidatoForm from '@/components/reclutamiento/candidato-form'
import EtapaStepper from '@/components/reclutamiento/etapa-stepper'
import CandidatoGuia from '@/components/reclutamiento/candidato-guia'
import { leerAjustes } from '@/lib/reclutamiento/ajustes'
import { siguientePaso } from '@/lib/reclutamiento/etapas'
import type { RecEtapa, RecFuente, RecRevisionCv, RecMotivoDescarte } from '@/lib/supabase/types'

export const metadata = { title: 'Editar candidato — Reclutamiento' }

export default async function EditarCandidatoPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // La vista trae el candidato y sus requisitos derivados (evaluaciones
  // esperadas/registradas, alta configurada) en una sola consulta.
  const { data } = await supabase
    .from('rec_candidato_requisitos')
    .select('id, vacante_id, nombre, email, telefono, fuente, etapa, revision_cv, motivo_descarte, cv_storage_path, notas, final_dg_at, evaluaciones_esperadas, evaluaciones_registradas, tiene_alta_config')
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
    final_dg_at: string | null
    evaluaciones_esperadas: number
    evaluaciones_registradas: number
    tiene_alta_config: boolean
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

  const [{ data: vacData }, { data: cred }, ajustes] = await Promise.all([
    supabase.from('rec_vacantes').select('id, titulo, estado').order('created_at', { ascending: false }),
    supabase.from('rec_credenciales_google').select('id').limit(1).maybeSingle(),
    leerAjustes(supabase),
  ])

  const vacantes = (vacData ?? []) as { id: string; titulo: string; estado: 'abierta' | 'cerrada' }[]

  const paso = siguientePaso(candidato, {
    googleConectado: !!cred,
    dgConfigurada: !!ajustes.dg.email,
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/reclutamiento/candidatos?vacante=${candidato.vacante_id}`}
            className="flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700 transition-colors"
          >
            <ChevronLeft size={13} />
            Candidatos
          </Link>
          <span className="text-ink-300 text-[12.5px]">/</span>
          <span className="text-[12.5px] text-ink-700 truncate">{candidato.nombre}</span>
        </div>
        <Link
          href={`/reclutamiento/pipeline?vacante=${candidato.vacante_id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#ECECEC] px-3 py-[6px] text-[12px] font-medium text-ink-700 transition-colors hover:bg-surface-hover"
        >
          <Columns3 size={13} className="text-ink-400" />
          Ir al pipeline
        </Link>
      </div>

      <EtapaStepper etapa={candidato.etapa} />

      <CandidatoGuia etapa={candidato.etapa} paso={paso} />

      <h1 className="text-[18px] font-semibold text-ink-900">Editar candidato</h1>

      <CandidatoForm vacantes={vacantes} initialData={candidato} />
    </div>
  )
}
