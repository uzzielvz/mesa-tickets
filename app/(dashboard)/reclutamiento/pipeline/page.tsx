import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import PipelineBoard from '@/components/reclutamiento/pipeline-board'
import { leerAjustes } from '@/lib/reclutamiento/ajustes'
import type { RecEtapa, RecMotivoDescarte, RecRevisionCv } from '@/lib/supabase/types'

export const metadata = { title: 'Pipeline — Reclutamiento' }

export interface PipelineCandidato {
  id: string
  vacante_id: string
  nombre: string
  email: string | null
  telefono: string | null
  etapa: RecEtapa
  revision_cv: RecRevisionCv | null
  motivo_descarte: RecMotivoDescarte | null
  final_dg_at: string | null
  created_at: string
  evaluaciones_esperadas: number
  evaluaciones_registradas: number
  tiene_alta_config: boolean
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
    // La vista trae los requisitos derivados de cada candidato (evaluaciones,
    // alta configurada) en la misma consulta: el tablero decide sin más viajes.
    const { data } = await supabase
      .from('rec_candidato_requisitos')
      .select('id, vacante_id, nombre, email, telefono, etapa, revision_cv, motivo_descarte, final_dg_at, created_at, evaluaciones_esperadas, evaluaciones_registradas, tiene_alta_config')
      .eq('vacante_id', vacanteId)
      .order('created_at', { ascending: false })
    candidatos = (data ?? []) as PipelineCandidato[]
  }

  // Condiciones de entorno para los pasos que mandan correo, y prellenados.
  const [{ data: cred }, { data: tplData }, ajustes] = await Promise.all([
    supabase.from('rec_credenciales_google').select('id').limit(1).maybeSingle(),
    supabase
      .from('rec_plantillas_correo')
      .select('cc_emails')
      .eq('codigo', 'bienvenida_contratacion')
      .maybeSingle(),
    leerAjustes(supabase),
  ])

  const ccDefault = ((tplData as { cc_emails: string[] } | null)?.cc_emails ?? []) as string[]

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

      <PipelineBoard
        vacantes={vacantes}
        vacanteId={vacanteId}
        candidatos={candidatos}
        googleConectado={!!cred}
        dgNombre={ajustes.dg.nombre || 'la Dirección General'}
        dgConfigurada={!!ajustes.dg.email}
        ccDefault={ccDefault}
        destinatariosDefault={ajustes.altaDestinatarios}
      />
    </div>
  )
}
