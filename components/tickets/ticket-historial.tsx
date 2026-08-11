import { formatDate, formatName } from '@/lib/utils/format'
import type { TicketStatus } from '@/lib/supabase/types'

export interface HistorialRow {
  id: string
  actor_id: string | null
  evento: 'creado' | 'tomado' | 'devuelto' | 'reasignado' | 'cambio_estado'
  a_estado: TicketStatus | null
  a_responsable_id: string | null
  created_at: string
}

interface Props {
  rows: HistorialRow[]
  /** profile_id → nombre_completo, para actor y destinatario de reasignación. */
  nombres: Record<string, string>
}

const ESTADO_LABEL: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  programado: 'Programado',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  rechazado: 'Rechazado',
}

function nombreDe(nombres: Record<string, string>, id: string | null): string {
  if (!id) return 'Sistema'
  const n = nombres[id]
  return n ? formatName(n, '') : '—'
}

function textoDe(r: HistorialRow, nombres: Record<string, string>): string {
  const actor = nombreDe(nombres, r.actor_id)
  switch (r.evento) {
    case 'creado':
      return `${actor} levantó el ticket`
    case 'tomado':
      return `${nombreDe(nombres, r.a_responsable_id)} tomó el ticket`
    case 'devuelto':
      return `${actor} lo devolvió a la cola`
    case 'reasignado':
      return `${actor} lo pasó a ${nombreDe(nombres, r.a_responsable_id)}`
    case 'cambio_estado':
      return `${actor} lo marcó ${r.a_estado ? ESTADO_LABEL[r.a_estado] : '—'}`
  }
}

/**
 * Plegado por default: el historial es para cuando alguien pregunta "¿quién
 * lo tuvo y desde cuándo?", no para estorbar la lectura del hilo.
 */
export default function TicketHistorial({ rows, nombres }: Props) {
  if (rows.length === 0) return null

  return (
    <details className="mx-5 md:mx-9 mb-5 border border-[#ECECEC] rounded-md group">
      <summary className="px-4 py-2.5 text-[12px] font-medium text-ink-500 cursor-pointer select-none hover:text-ink-900 transition-colors list-none flex items-center gap-1.5">
        <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
        Historial
        <span className="text-ink-400 font-normal">{rows.length}</span>
      </summary>
      <div className="px-4 pb-3 flex flex-col gap-1.5 border-t border-[#F5F5F5] pt-2.5">
        {rows.map(r => (
          <div key={r.id} className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-[12px] text-ink-700">{textoDe(r, nombres)}</span>
            <span className="text-[11.5px] text-ink-400 shrink-0">{formatDate(r.created_at)}</span>
          </div>
        ))}
      </div>
    </details>
  )
}
