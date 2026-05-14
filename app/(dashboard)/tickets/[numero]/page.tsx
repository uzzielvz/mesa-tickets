import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TicketWithStatus, ProblemField } from '@/lib/supabase/types'
import Header from '@/components/layout/header'
import StatusBadge from '@/components/tickets/status-badge'
import TicketThread from '@/components/tickets/ticket-thread'
import ResponseComposer from '@/components/tickets/response-composer'

// Etiquetas para datos legacy (tickets viejos sin entrada en `datos`)
const LEGACY_LABELS: Record<string, string> = {
  grupo: 'Grupo',
  cliente: 'Cliente',
  ciclo_cliente: 'Ciclo',
}

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

  const [{ data: rawResponses }, { data: attachments }, { data: catalogo }] = await Promise.all([
    supabase
      .from('ticket_responses')
      .select('*, profiles(nombre_completo, rol)')
      .eq('ticket_id', ticket.id)
      .order('orden', { ascending: true }),
    supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticket.id),
    supabase
      .from('problem_catalog')
      .select('campos')
      .eq('id', ticket.problem_catalog_id)
      .single(),
  ])
  const campos = ((catalogo?.campos as ProblemField[] | null) ?? [])

  // Construir lista label/valor combinando datos dinámicos + legacy.
  // Los datos dinámicos toman prioridad; los legacy solo se muestran si
  // su key no está ya cubierta por un campo dinámico.
  const datosUI: { label: string; value: string }[] = []
  const datosObj = ticket.datos ?? {}
  for (const c of campos) {
    const v = datosObj[c.key]
    if (v) datosUI.push({ label: c.label, value: String(v) })
  }
  for (const [k, v] of Object.entries(datosObj)) {
    if (campos.some(c => c.key === k)) continue
    if (v) datosUI.push({ label: LEGACY_LABELS[k] ?? k, value: String(v) })
  }
  const legacyPairs: [string | null, string][] = [
    [ticket.grupo, 'Grupo'],
    [ticket.cliente, 'Cliente'],
    [ticket.ciclo_cliente, 'Ciclo'],
  ]
  for (const [val, label] of legacyPairs) {
    if (!val) continue
    const key = label === 'Grupo' ? 'grupo' : label === 'Cliente' ? 'cliente' : 'ciclo_cliente'
    if (datosObj[key]) continue
    datosUI.push({ label, value: val })
  }
  const responses = rawResponses as unknown as Array<{
    id: string; ticket_id: string; orden: number; autor_id: string
    contenido: string; tipo: string; created_at: string
    profiles: { nombre_completo: string; rol: string } | null
  }>

  const canRespond =
    user.id === ticket.levantado_por_id || user.id === ticket.responsable_id
  const isRechazado = ticket.status === 'rechazado'
  const isClosed = ticket.status === 'cerrado' || isRechazado
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
            <span>Levantado por: {ticket.levantado_por_nombre}</span>
            <span className="text-ink-400">·</span>
            <span>Responsable: {ticket.responsable_nombre}</span>
          </span>
        }
      />

      {datosUI.length > 0 && (
        <div className="mx-5 md:mx-9 mb-6 bg-surface-sidebar border border-[#ECECEC] rounded-md px-4 py-3 flex flex-wrap gap-x-6 gap-y-1">
          {datosUI.map((d, i) => (
            <span key={i} className="text-[12.5px] text-ink-700">
              <span className="text-ink-400">{d.label}:</span> {d.value}
            </span>
          ))}
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

      {isClosed && !isRechazado && (
        <div className="mx-5 md:mx-9 mt-6 pb-12">
          <p className="text-[12.5px] text-ink-400 text-center py-4 border border-[#ECECEC] rounded-md">
            Este ticket está cerrado.
          </p>
        </div>
      )}

      {isRechazado && (
        <div className="mx-5 md:mx-9 mt-6 pb-12">
          <p className="text-[12.5px] text-red-700 text-center py-4 border border-red-200 bg-red-50/50 rounded-md">
            Esta solicitud fue rechazada por el responsable.
          </p>
        </div>
      )}
    </div>
  )
}
