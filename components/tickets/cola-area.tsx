'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Hand } from 'lucide-react'
import StatusBadge from './status-badge'
import { timeAgo } from '@/lib/utils/format'
import { calcularSla, PRIORIDAD_CHIP, PRIORIDAD_LABEL, SLA_COLOR, type Sla } from '@/lib/tickets/sla'
import { tomarTicket } from '@/lib/actions/tickets'
import type { TicketPrioridad } from '@/lib/supabase/types'

interface Ticket {
  id: string
  numero: number
  status: string
  problema_nombre: string
  responsable_id: string | null
  responsable_nombre: string | null
  levantado_por_nombre: string
  prioridad: TicketPrioridad
  sla_min: number | null
  created_at: string
  ultima_respuesta_at: string | null
}

interface Props {
  tickets: Ticket[]
  /** Reloj del servidor: SSR e hidratación tienen que coincidir. */
  ahora: number
  usuarioId: string
}

// Lo más urgente arriba: primero lo vencido, luego lo que menos tiempo tiene,
// y a igualdad de reloj manda la prioridad del tipo de problema.
const PESO_PRIORIDAD: Record<TicketPrioridad, number> = { alta: 0, media: 1, baja: 2 }

function urgencia(a: { t: Ticket; sla: Sla }, b: { t: Ticket; sla: Sla }): number {
  const ma = a.sla.minutos ?? Number.POSITIVE_INFINITY
  const mb = b.sla.minutos ?? Number.POSITIVE_INFINITY
  if (ma !== mb) return ma - mb
  const pa = PESO_PRIORIDAD[a.t.prioridad]
  const pb = PESO_PRIORIDAD[b.t.prioridad]
  if (pa !== pb) return pa - pb
  return a.t.numero - b.t.numero
}

export default function ColaArea({ tickets, ahora, usuarioId }: Props) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [tomando, setTomando] = useState<string | null>(null)

  const { sinTomar, enCurso } = useMemo(() => {
    const conSla = tickets.map(t => ({ t, sla: calcularSla(t, ahora) }))
    return {
      sinTomar: conSla.filter(x => x.t.responsable_id === null).sort(urgencia),
      enCurso: conSla.filter(x => x.t.responsable_id !== null).sort(urgencia),
    }
  }, [tickets, ahora])

  function handleTomar(ticket: Ticket) {
    setTomando(ticket.id)
    startTransition(async () => {
      const res = await tomarTicket(ticket.id, ticket.numero)
      setTomando(null)
      if (!res.ok) {
        toast.error(res.error)
        // Puede ser que alguien más lo tomó: refrescar deja la cola al día.
        router.refresh()
        return
      }
      toast.success(`Tomaste el ticket #${ticket.numero}`)
      router.refresh()
    })
  }

  if (tickets.length === 0) {
    return (
      <div className="mx-5 md:mx-9 py-16 text-center border border-[#ECECEC] rounded-md">
        <p className="text-[13px] text-ink-400">
          No hay tickets activos en tu área. Todo al corriente.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full pb-12">
      <Seccion
        titulo="Sin tomar"
        descripcion="Nadie los está atendiendo todavía. El más urgente arriba."
        vacio="Ningún ticket sin tomar."
        filas={sinTomar}
        ahora={ahora}
        onTomar={handleTomar}
        tomando={tomando}
        deshabilitado={pendiente}
      />

      <Seccion
        titulo="En curso"
        descripcion="Ya tienen responsable."
        vacio="Ningún ticket en curso."
        filas={enCurso}
        ahora={ahora}
        usuarioId={usuarioId}
      />
    </div>
  )
}

interface SeccionProps {
  titulo: string
  descripcion: string
  vacio: string
  filas: { t: Ticket; sla: Sla }[]
  ahora: number
  usuarioId?: string
  onTomar?: (t: Ticket) => void
  tomando?: string | null
  deshabilitado?: boolean
}

function Seccion({
  titulo, descripcion, vacio, filas, usuarioId, onTomar, tomando, deshabilitado,
}: SeccionProps) {
  return (
    <section className="mt-2">
      <div className="px-5 md:px-9 pt-5 pb-2">
        <h2 className="text-[13px] font-medium text-ink-900">
          {titulo}
          <span className="ml-2 text-[12px] text-ink-400 font-normal">{filas.length}</span>
        </h2>
        <p className="text-[11.5px] text-ink-400 mt-0.5">{descripcion}</p>
      </div>

      {filas.length === 0 ? (
        <p className="px-5 md:px-9 py-6 text-[12.5px] text-ink-400">{vacio}</p>
      ) : (
        <div className="border-t border-[#ECECEC]">
          {filas.map(({ t, sla }, i) => (
            <div
              key={t.id}
              className={`
                flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2
                px-5 md:px-9 py-3
                ${i < filas.length - 1 ? 'border-b border-[#F5F5F5]' : ''}
              `}
            >
              <Link
                href={`/tickets/${t.numero}`}
                className="flex-1 min-w-0 flex flex-col gap-1 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[12px] font-medium text-navy font-mono shrink-0">
                    #{t.numero}
                  </span>
                  <span className="text-[13px] font-medium text-ink-900 truncate group-hover:text-orange transition-colors">
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
                  Levantó {t.levantado_por_nombre} · {timeAgo(t.created_at)}
                  {t.responsable_nombre && (
                    <>
                      {' · '}
                      {t.responsable_id === usuarioId ? 'Tú' : t.responsable_nombre}
                    </>
                  )}
                </span>
              </Link>

              <span className={`text-[12px] shrink-0 md:w-[150px] ${SLA_COLOR[sla.estado]}`}>
                {sla.etiqueta}
              </span>

              <div className="shrink-0 md:w-[116px]">
                <StatusBadge status={t.status} />
              </div>

              {onTomar && (
                <button
                  type="button"
                  onClick={() => onTomar(t)}
                  disabled={deshabilitado}
                  className="shrink-0 flex items-center gap-1.5 bg-navy hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium rounded px-3 py-[6px] transition-colors"
                >
                  <Hand size={12} />
                  {tomando === t.id ? 'Tomando…' : 'Tomar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
