import { Check } from 'lucide-react'
import type { RecEtapa } from '@/lib/supabase/types'

// Camino principal del flujo (descartado queda fuera de la línea).
const FLUJO: RecEtapa[] = [
  'postulado', 'en_revision', 'viable', 'entrevistas_agendadas',
  'comite', 'final_dg', 'oferta', 'contratado',
]

// Etiquetas orientadas a la acción (más humanas que los códigos internos).
const PASO_LABEL: Record<RecEtapa, string> = {
  postulado: 'Postulado',
  en_revision: 'En revisión',
  viable: 'Viable',
  entrevistas_agendadas: 'Entrevistas',
  comite: 'Comité',
  final_dg: 'Entrevista final (DG)',
  oferta: 'Configurar alta',
  contratado: 'Contratado',
  descartado: 'Descartado',
}

// Stepper del flujo de reclutamiento: muestra en qué etapa va el candidato y
// cuál sigue. Pasos completados en verde con check, el actual en naranja,
// los futuros en gris.
export default function EtapaStepper({ etapa }: { etapa: RecEtapa }) {
  if (etapa === 'descartado') {
    return (
      <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3">
        <p className="text-[12.5px] font-medium text-[#b91c1c]">Candidato descartado</p>
        <p className="text-[11.5px] text-[#b91c1c]/80">Salió del flujo de reclutamiento.</p>
      </div>
    )
  }

  const actual = FLUJO.indexOf(etapa)
  const siguiente = actual >= 0 && actual < FLUJO.length - 1 ? FLUJO[actual + 1] : null

  return (
    <div className="rounded-md border border-[#ECECEC] bg-white px-3.5 py-3.5">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[600px]">
          {FLUJO.map((paso, i) => {
            const hecho = i < actual
            const esActual = i === actual
            const dot = hecho
              ? 'bg-[#15803d] text-white border-[#15803d]'
              : esActual
                ? 'bg-orange text-white border-orange'
                : 'bg-white text-ink-300 border-[#ECECEC]'
            const label = esActual
              ? 'font-semibold text-ink-900'
              : hecho
                ? 'text-ink-500'
                : 'text-ink-300'
            return (
              <div key={paso} className="relative flex flex-1 flex-col items-center gap-1.5 px-1">
                {i < FLUJO.length - 1 && (
                  <span
                    className={`absolute left-1/2 top-3 h-[2px] w-full ${hecho ? 'bg-[#15803d]' : 'bg-[#ECECEC]'}`}
                  />
                )}
                <span
                  className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${dot}`}
                >
                  {hecho ? <Check size={13} /> : i + 1}
                </span>
                <span className={`text-center text-[10.5px] leading-tight ${label}`}>
                  {PASO_LABEL[paso]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {siguiente ? (
        <p className="mt-2 text-[11.5px] text-ink-500">
          Etapa actual: <span className="font-medium text-ink-900">{PASO_LABEL[etapa]}</span>
          <span className="mx-1.5 text-ink-300">→</span>
          siguiente: <span className="font-medium text-navy">{PASO_LABEL[siguiente]}</span>
        </p>
      ) : (
        <p className="mt-2 text-[11.5px] font-medium text-[#15803d]">
          ✓ Candidato contratado — flujo completo.
        </p>
      )}
    </div>
  )
}
