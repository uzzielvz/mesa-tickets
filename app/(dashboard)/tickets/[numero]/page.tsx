import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TicketWithStatus } from '@/lib/supabase/types'
import Header from '@/components/layout/header'
import StatusBadge from '@/components/tickets/status-badge'
import TicketThread from '@/components/tickets/ticket-thread'
import ResponseComposer from '@/components/tickets/response-composer'

export default async function TicketDetailPage({ params }: { params: { numero: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const numero = parseInt(params.numero)
  if (isNaN(numero)) notFound()

  const { data: rawTicket } = await supabase
    .from('tickets_with_status')
    .select('*')
    .eq('numero', numero)
    .single()

  if (!rawTicket) notFound()
  const ticket = rawTicket as unknown as TicketWithStatus

  const { data: responses } = await supabase
    .from('ticket_responses')
    .select('*, profiles(nombre_completo, rol)')
    .eq('ticket_id', ticket.id)
    .order('orden', { ascending: true })

  const { data: attachments } = await supabase
    .from('ticket_attachments')
    .select('*')
    .eq('ticket_id', ticket.id)

  const canRespond =
    user.id === ticket.levantado_por_id || user.id === ticket.responsable_id
  const isClosed = ticket.status === 'cerrado'
  const isTerminado = ticket.status === 'terminado'
  const esResponsable = user.id === ticket.responsable_id
  const esLevantador = user.id === ticket.levantado_por_id

  return (
    <div className="max-w-3xl">
      <Header
        title={`#${ticket.numero} — ${ticket.problema_nombre}`}
        subtitle={
          <span className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={ticket.status} />
            <span className="text-ink-400">·</span>
            <span>{ticket.area_nombre}</span>
            <span className="text-ink-400">·</span>
            <span>Responsable: {ticket.responsable_nombre}</span>
          </span>
        }
      />

      {/* Metadata del ticket */}
      {(ticket.grupo || ticket.cliente || ticket.ciclo_cliente) && (
        <div className="mx-5 md:mx-9 mb-6 bg-surface-sidebar border border-[#ECECEC] rounded-md px-4 py-3 flex flex-wrap gap-x-6 gap-y-1">
          {ticket.grupo && (
            <span className="text-[12.5px] text-ink-700">
              <span className="text-ink-400">Grupo:</span> {ticket.grupo}
            </span>
          )}
          {ticket.cliente && (
            <span className="text-[12.5px] text-ink-700">
              <span className="text-ink-400">Cliente:</span> {ticket.cliente}
            </span>
          )}
          {ticket.ciclo_cliente && (
            <span className="text-[12.5px] text-ink-700">
              <span className="text-ink-400">Ciclo:</span> {ticket.ciclo_cliente}
            </span>
          )}
        </div>
      )}

      {/* Hilo de respuestas */}
      <TicketThread
        responses={responses ?? []}
        attachments={attachments ?? []}
        levantadoPorId={ticket.levantado_por_id}
      />

      {/* Composer */}
      {canRespond && !isClosed && (
        <div className="mx-5 md:mx-9 mt-6 pb-12">
          <ResponseComposer
            ticketId={ticket.id}
            userId={user.id}
            esResponsable={esResponsable}
            esLevantador={esLevantador}
            isTerminado={isTerminado}
          />
        </div>
      )}

      {isClosed && (
        <div className="mx-5 md:mx-9 mt-6 pb-12">
          <p className="text-[12.5px] text-ink-400 text-center py-4 border border-[#ECECEC] rounded-md">
            Este ticket está cerrado.
          </p>
        </div>
      )}
    </div>
  )
}
