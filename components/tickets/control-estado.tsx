'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Hand, Undo2, Pause, Play } from 'lucide-react'
import { cambiarEstado, reasignarTicket, tomarTicket } from '@/lib/actions/tickets'
import type { TicketStatus } from '@/lib/supabase/types'

export interface CompaneroArea {
  id: string
  nombre: string
}

interface Props {
  ticketId: string
  numero: number
  estado: TicketStatus
  areaNombre: string
  /** NULL = sigue en la cola del área. */
  responsableId: string | null
  /** Quien mira pertenece al área que atiende, la supervisa, o es admin. */
  puedeTomar: boolean
  /** Quien mira es el responsable actual (o admin). */
  puedeMoverEstado: boolean
  /** Gente del área (sin el responsable actual), para "Pasar a…". */
  companeros: CompaneroArea[]
  /**
   * Nombre del botón de pausa para este tipo de problema, del catálogo.
   * NULL = este tipo no tiene pausa; el flujo es tomar → resolver.
   */
  etiquetaPausa: string | null
}

export default function ControlEstado({
  ticketId, numero, estado, areaNombre, responsableId,
  puedeTomar, puedeMoverEstado, companeros, etiquetaPausa,
}: Props) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [accion, setAccion] = useState<string | null>(null)

  const sinTomar = responsableId === null
  const pausado = estado === 'programado'

  function ejecutar(
    nombre: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    exito: string,
  ) {
    setAccion(nombre)
    startTransition(async () => {
      const res = await fn()
      setAccion(null)
      if (!res.ok) {
        toast.error(res.error)
        router.refresh()
        return
      }
      toast.success(exito)
      router.refresh()
    })
  }

  if (sinTomar) {
    // Sin permiso para tomar no hay acción que ofrecer: el contexto lo da la
    // guía del ticket, no este control.
    if (!puedeTomar) return null
    return (
      <div className="mx-5 md:mx-9 mb-5 border border-[#ECECEC] rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-surface-sidebar">
        <p className="text-[12.5px] text-ink-700">
          Este ticket está en la cola de{' '}
          <span className="font-medium">{areaNombre}</span> y nadie lo ha tomado.
        </p>
        <button
          type="button"
          onClick={() => ejecutar(
            'tomar',
            () => tomarTicket(ticketId, numero),
            `Tomaste el ticket #${numero}`,
          )}
          disabled={pendiente}
          className="flex items-center gap-1.5 bg-navy hover:bg-navy/90 disabled:opacity-50 text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
        >
          <Hand size={13} />
          {accion === 'tomar' ? 'Tomando…' : 'Tomar ticket'}
        </button>
      </div>
    )
  }

  if (!puedeMoverEstado) return null

  return (
    <div className="mx-5 md:mx-9 mb-5 border border-[#ECECEC] rounded-md px-4 py-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Pausa: solo si este tipo de problema la necesita. Un estado que
            nadie va a filtrar no merece existir — para lo demás está el hilo. */}
        {etiquetaPausa && !pausado && (
          <button
            type="button"
            title="Detiene el reloj del SLA: la demora deja de contar contra el área."
            onClick={() => ejecutar(
              'pausar',
              () => cambiarEstado(ticketId, 'programado', undefined, numero),
              `Ticket #${numero}: ${etiquetaPausa}`,
            )}
            disabled={pendiente}
            className="flex items-center gap-1.5 text-[12.5px] font-medium rounded border border-[#ECECEC] px-[14px] py-[6px] text-ink-900 hover:bg-surface-hover hover:border-orange transition-colors disabled:opacity-50"
          >
            <Pause size={12} />
            {accion === 'pausar' ? 'Guardando…' : etiquetaPausa}
          </button>
        )}

        {pausado && (
          <button
            type="button"
            title="Vuelve a poner el reloj en marcha."
            onClick={() => ejecutar(
              'reanudar',
              () => cambiarEstado(ticketId, 'en_revision', undefined, numero),
              `Ticket #${numero} reanudado`,
            )}
            disabled={pendiente}
            className="flex items-center gap-1.5 text-[12.5px] font-medium rounded border border-[#ECECEC] px-[14px] py-[6px] text-ink-900 hover:bg-surface-hover hover:border-orange transition-colors disabled:opacity-50"
          >
            <Play size={12} />
            {accion === 'reanudar' ? 'Guardando…' : 'Reanudar'}
          </button>
        )}
      </div>

      {/* Reasignación: el ticket no es de nadie de por vida. */}
      <div className={`flex flex-wrap items-center gap-2 ${etiquetaPausa || pausado ? 'pt-2 border-t border-[#F5F5F5]' : ''}`}>
        <button
          type="button"
          title="El ticket vuelve a la cola para que otra persona lo tome."
          onClick={() => ejecutar(
            'soltar',
            () => reasignarTicket(ticketId, null, numero),
            `Ticket #${numero} devuelto a la cola de ${areaNombre}`,
          )}
          disabled={pendiente}
          className="flex items-center gap-1.5 text-[12px] font-medium rounded border border-[#ECECEC] px-3 py-[5px] text-ink-500 hover:bg-surface-hover hover:text-ink-900 transition-colors disabled:opacity-50"
        >
          <Undo2 size={12} />
          {accion === 'soltar' ? 'Devolviendo…' : 'Devolver a la cola'}
        </button>

        {companeros.length > 0 && (
          <select
            value=""
            disabled={pendiente}
            onChange={e => {
              const destino = companeros.find(c => c.id === e.target.value)
              if (!destino) return
              ejecutar(
                'pasar',
                () => reasignarTicket(ticketId, destino.id, numero),
                `Ticket #${numero} pasado a ${destino.nombre}`,
              )
            }}
            className="text-[12px] text-ink-500 bg-white border border-[#ECECEC] rounded px-2.5 py-[5px] outline-none focus:border-orange transition-colors disabled:opacity-50"
          >
            <option value="" disabled>
              {accion === 'pasar' ? 'Pasando…' : 'Pasar a…'}
            </option>
            {companeros.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
