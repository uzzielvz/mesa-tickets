import { createClient } from '@/lib/supabase/server'
import AgendarForm from '@/components/reclutamiento/agendar-form'
import { ETAPA_LABEL } from '@/lib/schemas/reclutamiento'
import type { RecEtapa } from '@/lib/supabase/types'

export const metadata = { title: 'Agendar entrevistas — Reclutamiento' }

// REC-031 — Agendamiento masivo Fase 2: el usuario elige vacante, candidatos
// viables, fecha/hora y entrevistadores; el sistema genera la cascada de Meets
// y envía los correos desde la cuenta de Google conectada.

export interface CandidatoViable {
  id: string
  nombre: string
  email: string | null
}

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: { vacante?: string; candidato?: string; google?: string; google_error?: string }
}) {
  const supabase = createClient()

  const { data: vacData } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, estado')
    .order('created_at', { ascending: false })
  const vacantes = (vacData ?? []) as { id: string; titulo: string; estado: 'abierta' | 'cerrada' }[]

  const vacanteId = searchParams.vacante ?? vacantes[0]?.id ?? null

  let candidatos: CandidatoViable[] = []
  if (vacanteId) {
    const { data } = await supabase
      .from('rec_candidatos')
      .select('id, nombre, email')
      .eq('vacante_id', vacanteId)
      .eq('etapa', 'viable')
      .order('created_at', { ascending: true })
    candidatos = (data ?? []) as CandidatoViable[]
  }

  // El kanban manda aquí con ?candidato= para no obligar a buscarlo en la lista.
  // Si el id no está entre los viables (ya se agendó, se descartó, cambió de
  // vacante), se dice por qué en vez de ignorarlo en silencio.
  const preseleccion = searchParams.candidato ?? null
  let avisoPreseleccion: string | null = null
  if (preseleccion && !candidatos.some(c => c.id === preseleccion)) {
    const { data: otro } = await supabase
      .from('rec_candidatos')
      .select('nombre, etapa')
      .eq('id', preseleccion)
      .maybeSingle()
    const c = otro as { nombre: string; etapa: string } | null
    avisoPreseleccion = c
      ? `${c.nombre} no aparece en la lista: está en la etapa "${ETAPA_LABEL[c.etapa as RecEtapa]}" o pertenece a otra vacante. Solo se pueden agendar candidatos viables.`
      : 'El candidato indicado ya no existe.'
  }

  // ¿Hay cuenta de Google emisora conectada?
  const { data: cred } = await supabase
    .from('rec_credenciales_google')
    .select('id, actualizado_at')
    .order('actualizado_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[18px] font-semibold text-ink-900">Agendar entrevistas</h1>
        <p className="text-[13px] text-ink-400 mt-0.5">
          Fase 2 en cascada: una liga de Meet por candidato, 3 entrevistadores rotando en bloques de 20 min.
        </p>
      </div>

      <AgendarForm
        vacantes={vacantes}
        vacanteId={vacanteId}
        candidatos={candidatos}
        preseleccion={avisoPreseleccion ? null : preseleccion}
        avisoPreseleccion={avisoPreseleccion}
        googleConectado={!!cred}
        googleQuery={searchParams.google ?? null}
        googleError={searchParams.google_error ?? null}
      />
    </div>
  )
}
