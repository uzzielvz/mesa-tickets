import { createClient } from '@/lib/supabase/server'
import AgendarForm from '@/components/reclutamiento/agendar-form'

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
  searchParams: { vacante?: string; google?: string; google_error?: string }
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
        googleConectado={!!cred}
        googleQuery={searchParams.google ?? null}
        googleError={searchParams.google_error ?? null}
      />
    </div>
  )
}
