'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import StatusBadge from './status-badge'
import { timeAgo } from '@/lib/utils/format'
import { calcularSla, PRIORIDAD_CHIP, PRIORIDAD_LABEL, SLA_COLOR } from '@/lib/tickets/sla'
import type { TicketPrioridad } from '@/lib/supabase/types'

interface Ticket {
  numero: number
  status: string
  problema_nombre: string
  area_nombre: string
  /** NULL mientras nadie lo haya tomado de la cola. */
  responsable_nombre: string | null
  levantado_por_nombre: string
  prioridad: TicketPrioridad
  sla_min: number | null
  created_at: string
  ultima_respuesta_at: string | null
}

interface Props {
  tickets: Ticket[]
  /** Reloj del servidor. Se pasa como prop para que SSR e hidratación coincidan. */
  ahora: number
  emptyMessage?: string
  showResponsable?: boolean
}

type Filtro = 'todos' | 'activos' | 'vencidos' | 'cerrados'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'activos', label: 'Activos' },
  { key: 'vencidos', label: 'Vencidos' },
  { key: 'cerrados', label: 'Cerrados' },
  { key: 'todos', label: 'Todos' },
]

const COLUMNS = 'grid-cols-[56px_minmax(0,1fr)_116px_140px_96px]'
const CERRADOS = new Set(['cerrado', 'rechazado'])

export default function TicketList({
  tickets,
  ahora,
  emptyMessage = 'No hay tickets.',
  showResponsable = true,
}: Props) {
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [busqueda, setBusqueda] = useState('')

  // El SLA se calcula una vez por ticket y se reusa en el filtro y en la fila.
  const conSla = useMemo(
    () => tickets.map(t => ({ t, sla: calcularSla(t, ahora) })),
    [tickets, ahora],
  )

  const conteos = useMemo(() => ({
    todos: conSla.length,
    activos: conSla.filter(({ t }) => !CERRADOS.has(t.status)).length,
    vencidos: conSla.filter(({ sla }) => sla.estado === 'vencido').length,
    cerrados: conSla.filter(({ t }) => CERRADOS.has(t.status)).length,
  }), [conSla])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return conSla.filter(({ t, sla }) => {
      if (filtro === 'activos' && CERRADOS.has(t.status)) return false
      if (filtro === 'cerrados' && !CERRADOS.has(t.status)) return false
      if (filtro === 'vencidos' && sla.estado !== 'vencido') return false
      if (!q) return true
      return [
        String(t.numero), t.problema_nombre, t.area_nombre,
        t.responsable_nombre ?? '', t.levantado_por_nombre,
      ].some(v => v.toLowerCase().includes(q))
    })
  }, [conSla, filtro, busqueda])

  return (
    <div className="w-full">
      {/* Barra de filtros */}
      <div className="px-5 md:px-9 pb-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {FILTROS.map(f => {
          const activo = filtro === f.key
          const n = conteos[f.key]
          const alerta = f.key === 'vencidos' && n > 0
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={`
                text-[12px] font-medium rounded-full border px-2.5 py-[3px] transition-colors
                ${activo
                  ? 'bg-navy text-white border-navy'
                  : alerta
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    : 'bg-white text-ink-500 border-[#ECECEC] hover:bg-surface-hover'}
              `}
            >
              {f.label}
              <span className={activo ? 'ml-1 opacity-70' : 'ml-1 text-ink-400'}>{n}</span>
            </button>
          )
        })}

        <div className="relative ml-auto w-full sm:w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar #, asunto o persona"
            className="w-full bg-white border border-[#ECECEC] rounded pl-7 pr-2.5 py-[5px] text-[12.5px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange transition-all"
          />
        </div>
      </div>

      {/* Header de columnas — solo desktop */}
      <div className={`hidden md:grid ${COLUMNS} gap-3 px-9 pb-2 border-b border-[#ECECEC]`}>
        {['Ticket', 'Asunto', 'Estatus', 'Atención', 'Actualizado'].map(col => (
          <span key={col} className="text-[11px] font-medium text-ink-400 uppercase tracking-[0.3px]">
            {col}
          </span>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="px-5 md:px-9 py-16 text-center">
          <p className="text-[13px] text-ink-400">
            {tickets.length === 0
              ? emptyMessage
              : 'Ningún ticket coincide con el filtro.'}
          </p>
        </div>
      ) : (
        visibles.map(({ t, sla }, i) => (
          <Link
            key={t.numero}
            href={`/tickets/${t.numero}`}
            className={`
              block md:grid ${COLUMNS} gap-3 items-center
              px-5 md:px-9 py-[13px] transition-colors hover:bg-surface-hover
              ${i < visibles.length - 1 ? 'border-b border-[#F5F5F5]' : ''}
            `}
          >
            {/* Número — desktop */}
            <span className="hidden md:block text-[12px] font-medium text-navy font-mono">
              #{t.numero}
            </span>

            {/* Asunto (+ todo lo demás en móvil) */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 md:hidden">
                <span className="text-[11px] font-medium text-navy font-mono">#{t.numero}</span>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-medium text-ink-900 truncate">
                  {t.problema_nombre}
                </span>
                {t.prioridad !== 'baja' && (
                  <span
                    className={`shrink-0 text-[10.5px] font-medium px-1.5 py-[1px] rounded-full border ${PRIORIDAD_CHIP[t.prioridad]}`}
                  >
                    {PRIORIDAD_LABEL[t.prioridad]}
                  </span>
                )}
              </div>
              <span className="text-[11.5px] text-ink-400 truncate">
                {t.area_nombre}
                {' · '}
                {showResponsable
                  ? (t.responsable_nombre ?? 'Sin asignar')
                  : t.levantado_por_nombre}
              </span>
            </div>

            {/* Estatus — desktop */}
            <div className="hidden md:block">
              <StatusBadge status={t.status} />
            </div>

            {/* SLA */}
            <span className={`hidden md:block text-[12px] ${SLA_COLOR[sla.estado]}`}>
              {sla.etiqueta}
            </span>

            {/* Actualizado */}
            <span className="hidden md:block text-[12px] text-ink-400">
              {timeAgo(t.ultima_respuesta_at ?? t.created_at)}
            </span>

            {/* Móvil: SLA + fecha en una línea */}
            <div className="flex items-center gap-2 mt-1.5 md:hidden">
              <span className={`text-[11px] ${SLA_COLOR[sla.estado]}`}>{sla.etiqueta}</span>
              <span className="text-[11px] text-ink-400">·</span>
              <span className="text-[11px] text-ink-400">
                {timeAgo(t.ultima_respuesta_at ?? t.created_at)}
              </span>
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
