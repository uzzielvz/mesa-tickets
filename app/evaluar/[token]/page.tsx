import { createClient } from '@/lib/supabase/server'
import { EvaluacionForm } from '@/components/reclutamiento/evaluacion-form'
import type { CandidatoEval } from './tipos'

// Ruta pública del entrevistador (magic link). No requiere sesión: el acceso a
// datos se resuelve por token vía la RPC security definer rec_sesion_por_token.
// Nunca expone CVs, correos de candidatos ni evaluaciones de otros entrevistadores.

export const dynamic = 'force-dynamic'

interface SesionToken {
  valido: boolean
  motivo?: 'invalido' | 'expirado'
  entrevistador_nombre?: string | null
  vacante?: string | null
  fecha?: string | null
  candidatos?: CandidatoEval[]
}

function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d)
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </main>
  )
}

export default async function EvaluarPage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const { data } = await supabase.rpc('rec_sesion_por_token', { p_token: params.token })
  const sesion = (data ?? { valido: false, motivo: 'invalido' }) as SesionToken

  if (!sesion.valido) {
    const expirado = sesion.motivo === 'expirado'
    return (
      <Marco>
        <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            {expirado ? 'Esta liga ya expiró' : 'Liga no válida'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {expirado
              ? 'El periodo para registrar tus evaluaciones terminó. Si aún necesitas capturarlas, pide una nueva liga al equipo de Reclutamiento.'
              : 'La liga que abriste no es correcta o ya no está disponible. Verifica el enlace del correo o solicita uno nuevo a Reclutamiento.'}
          </p>
        </div>
      </Marco>
    )
  }

  const candidatos = sesion.candidatos ?? []

  return (
    <Marco>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Evaluación de candidatos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hola{sesion.entrevistador_nombre ? `, ${sesion.entrevistador_nombre}` : ''}. Registra tu
          valoración de cada candidato que entrevistaste.
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
          {sesion.vacante && (
            <div className="flex gap-1">
              <dt className="font-medium text-slate-500">Vacante:</dt>
              <dd>{sesion.vacante}</dd>
            </div>
          )}
          {sesion.fecha && (
            <div className="flex gap-1">
              <dt className="font-medium text-slate-500">Fecha:</dt>
              <dd className="capitalize">{fechaLarga(sesion.fecha)}</dd>
            </div>
          )}
        </dl>
      </header>

      {candidatos.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
          No hay candidatos asociados a esta sesión.
        </div>
      ) : (
        <ul className="space-y-4">
          {candidatos.map(c => (
            <li key={c.entrevista_id} className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium text-slate-900">{c.nombre}</h2>
                <span className="text-xs text-slate-500">{c.horario}</span>
              </div>
              <div className="mt-4">
                <EvaluacionForm token={params.token} candidato={c} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Marco>
  )
}
