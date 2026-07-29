import { createClient } from '@/lib/supabase/server'
import ComitePanel from '@/components/reclutamiento/comite-panel'
import type { RecEtapa, RecViabilidad } from '@/lib/supabase/types'

export const metadata = { title: 'Comité — Reclutamiento' }

// Etapas que se muestran en la pantalla de comité (decisión conjunta → DG → contratación).
const ETAPAS_COMITE: RecEtapa[] = ['comite', 'final_dg', 'oferta']

export interface EvaluacionComite {
  entrevistador_nombre: string | null
  recomendacion: RecViabilidad | null
  comentarios: string | null
  puntaje: number | null
}

export interface AltaConfigComite {
  equipo: string[]
  sistemas: string[]
  otros_texto: string | null
  induccion_fecha: string | null
  induccion_meet_url: string | null
  destinatarios: Record<string, string>
}

export interface CandidatoComite {
  id: string
  nombre: string
  email: string | null
  etapa: RecEtapa
  notas_comite: string | null
  fecha_ingreso: string | null
  final_dg_at: string | null
  final_dg_meet_url: string | null
  evaluaciones: EvaluacionComite[]
  altaConfig: AltaConfigComite | null
}

export default async function ComitePage({
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

  const vacanteId = searchParams.vacante ?? vacantes[0]?.id ?? null

  let candidatos: CandidatoComite[] = []
  if (vacanteId) {
    const { data: candData } = await supabase
      .from('rec_candidatos')
      .select('id, nombre, email, etapa, notas_comite, fecha_ingreso, final_dg_at, final_dg_meet_url')
      .eq('vacante_id', vacanteId)
      .in('etapa', ETAPAS_COMITE)
      .order('created_at', { ascending: false })
    const base = (candData ?? []) as Omit<CandidatoComite, 'evaluaciones' | 'altaConfig'>[]

    // Evaluaciones de cada candidato: candidato → entrevistas → evaluaciones.
    const porCandidato = new Map<string, EvaluacionComite[]>(base.map(c => [c.id, []]))
    if (base.length > 0) {
      const { data: entData } = await supabase
        .from('rec_entrevistas')
        .select('id, candidato_id')
        .in('candidato_id', base.map(c => c.id))
      const entrevistas = (entData ?? []) as { id: string; candidato_id: string }[]
      const candPorEntrevista = new Map(entrevistas.map(e => [e.id, e.candidato_id]))

      if (entrevistas.length > 0) {
        const { data: evalData } = await supabase
          .from('rec_evaluaciones')
          .select('entrevista_id, entrevistador_nombre, recomendacion, comentarios, puntaje')
          .in('entrevista_id', entrevistas.map(e => e.id))
        const evals = (evalData ?? []) as (EvaluacionComite & { entrevista_id: string })[]
        for (const ev of evals) {
          const candId = candPorEntrevista.get(ev.entrevista_id)
          if (candId) porCandidato.get(candId)?.push(ev)
        }
      }
    }

    // Configuración de alta ya guardada (para candidatos en 'oferta').
    const configPorCandidato = new Map<string, AltaConfigComite>()
    const idsOferta = base.filter(c => c.etapa === 'oferta').map(c => c.id)
    if (idsOferta.length > 0) {
      const { data: cfgData } = await supabase
        .from('rec_alta_config')
        .select('candidato_id, equipo, sistemas, otros_texto, induccion_fecha, induccion_meet_url, destinatarios')
        .in('candidato_id', idsOferta)
      const cfgs = (cfgData ?? []) as (AltaConfigComite & { candidato_id: string })[]
      for (const cfg of cfgs) {
        const { candidato_id, ...rest } = cfg
        configPorCandidato.set(candidato_id, rest)
      }
    }

    candidatos = base.map(c => ({
      ...c,
      evaluaciones: porCandidato.get(c.id) ?? [],
      altaConfig: configPorCandidato.get(c.id) ?? null,
    }))
  }

  // CC por defecto del correo de bienvenida (configurado en la plantilla).
  const { data: tplData } = await supabase
    .from('rec_plantillas_correo')
    .select('cc_emails')
    .eq('codigo', 'bienvenida_contratacion')
    .maybeSingle()
  const ccDefault = ((tplData as { cc_emails: string[] } | null)?.cc_emails ?? []) as string[]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[18px] font-semibold text-ink-900">Comité</h1>
        <p className="text-[13px] text-ink-400 mt-0.5">
          {vacanteId
            ? `${candidatos.length} candidato${candidatos.length !== 1 ? 's' : ''} en comité / decisión final`
            : 'Selecciona una vacante'}
        </p>
      </div>

      <ComitePanel
        vacantes={vacantes}
        vacanteId={vacanteId}
        candidatos={candidatos}
        ccDefault={ccDefault}
      />
    </div>
  )
}
