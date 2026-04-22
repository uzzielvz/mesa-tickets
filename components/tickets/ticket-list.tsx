import Link from 'next/link'
import StatusBadge from './status-badge'
import { timeAgo } from '@/lib/utils/format'

interface Ticket {
  numero: number
  status: string
  problema_nombre: string
  area_nombre: string
  responsable_nombre: string
  levantado_por_nombre: string
  created_at: string
  ultima_respuesta_at: string | null
}

interface Props {
  tickets: Ticket[]
  emptyMessage?: string
  showResponsable?: boolean
}

const COLUMNS_DESKTOP = 'grid-cols-[80px_1fr_140px_120px_100px]'

export default function TicketList({ tickets, emptyMessage = 'No hay tickets.', showResponsable = true }: Props) {
  if (tickets.length === 0) {
    return (
      <div className="px-5 md:px-9 py-16 text-center">
        <p className="text-[13px] text-ink-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header de columnas — solo desktop */}
      <div className={`hidden md:grid ${COLUMNS_DESKTOP} px-9 pb-2 border-b border-[#ECECEC]`}>
        {['Ticket', 'Asunto', showResponsable ? 'Responsable' : 'Levantado por', 'Estatus', 'Fecha'].map(col => (
          <span key={col} className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.3px]">
            {col}
          </span>
        ))}
      </div>

      {/* Filas */}
      {tickets.map((ticket, i) => (
        <Link
          key={ticket.numero}
          href={`/tickets/${ticket.numero}`}
          className={`
            block md:grid ${COLUMNS_DESKTOP} items-center
            px-5 md:px-9 py-[14px] transition-colors hover:bg-surface-hover
            ${i < tickets.length - 1 ? 'border-b border-[#F5F5F5]' : ''}
          `}
        >
          {/* Número */}
          <span className="hidden md:block text-[12px] font-medium text-navy font-mono">
            #{ticket.numero}
          </span>

          {/* Asunto — mobile muestra todo en stack */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-[11px] font-medium text-navy font-mono">#{ticket.numero}</span>
              <StatusBadge status={ticket.status} />
            </div>
            <span className="text-[13px] font-medium text-ink-900">{ticket.problema_nombre}</span>
            <span className="text-[11.5px] text-ink-400">
              {ticket.area_nombre}
              {showResponsable
                ? ` · ${ticket.responsable_nombre}`
                : ` · ${ticket.levantado_por_nombre}`
              }
            </span>
          </div>

          {/* Responsable / Levantado por — solo desktop */}
          <span className="hidden md:block text-[12.5px] text-ink-700 truncate">
            {showResponsable ? ticket.responsable_nombre : ticket.levantado_por_nombre}
          </span>

          {/* Estatus — solo desktop */}
          <div className="hidden md:block">
            <StatusBadge status={ticket.status} />
          </div>

          {/* Fecha */}
          <span className="hidden md:block text-[12px] text-ink-400">
            {timeAgo(ticket.ultima_respuesta_at ?? ticket.created_at)}
          </span>

          {/* Fecha mobile */}
          <span className="text-[11px] text-ink-400 mt-1 md:hidden">
            {timeAgo(ticket.ultima_respuesta_at ?? ticket.created_at)}
          </span>
        </Link>
      ))}
    </div>
  )
}
