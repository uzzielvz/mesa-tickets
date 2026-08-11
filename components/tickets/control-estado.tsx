'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Hand } from 'lucide-react'
import { cambiarEstado, tomarTicket } from '@/lib/actions/tickets'
import type { TicketStatus } from '@/lib/supabase/types'

interface Props {
  ticketId: string
  numero: number
  estado: TicketStatus
  areaNombre: string
  /** NULL = sigue en la cola del área. */
  responsableId: string | null
  /** Quien mira pertenece al área que atiende (o es admin). */
  puedeTomar: boolean
  /** Quien mira es el responsable actual (o admin). */
  puedeMoverEstado: boolean
}

// Solo los pasos intermedios: terminar, rechazar y confirmar el cierre ya
// viven en el composer, donde el mensaje al solicitante va junto con la acción.
const PASOS: { estado: TicketStatus; label: string; ayuda: string }[] = [
  {
    estado: 'en_revision',
    label: 'En revisión',
    ayuda: 'Lo estás atendiendo ahora.',
  },
  {
    estado: 'programado',
    label: 'Programado',
    ayuda: 'Validado; entra en la siguiente tanda. Pausa el reloj del SLA.',
  },
]

export default function ControlEstado({
  ticketId, numero, estado, areaNombre, responsableId, puedeTomar, puedeMoverEstado,
}: Props) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [accion, setAccion] = useState<string | null>(null)

  const sinTomar = responsableId === null

  function ejecutar(nombre: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) {
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
    if (!puedeTomar) {
      return (
        <div className="mx-5 md:mx-9 mb-5 border border-[#ECECEC] rounded-md px-4 py-3">
          <p className="text-[12.5px] text-ink-500">
            En la cola de <span className="text-ink-900 font-medium">{areaNombre}</span>.
            Todavía nadie lo ha tomado.
          </p>
        </div>
      )
    }
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

  const disponibles = PASOS.filter(p => p.estado !== estado)
  if (disponibles.length === 0) return null

  return (
    <div className="mx-5 md:mx-9 mb-5 border border-[#ECECEC] rounded-md px-4 py-3">
      <p className="text-[11.5px] text-ink-400 mb-2">Mover el estado</p>
      <div className="flex flex-wrap items-center gap-2">
        {disponibles.map(p => (
          <button
            key={p.estado}
            type="button"
            title={p.ayuda}
            onClick={() => ejecutar(
              p.estado,
              () => cambiarEstado(ticketId, p.estado, undefined, numero),
              `Ticket #${numero}: ${p.label}`,
            )}
            disabled={pendiente}
            className="text-[12.5px] font-medium rounded border border-[#ECECEC] px-[14px] py-[6px] text-ink-900 hover:bg-surface-hover hover:border-orange transition-colors disabled:opacity-50"
          >
            {accion === p.estado ? 'Guardando…' : p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
