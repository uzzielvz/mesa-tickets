import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TicketWithStatus, ProblemField } from '@/lib/supabase/types'
import Header from '@/components/layout/header'
import StatusBadge from '@/components/tickets/status-badge'
import {
  calcularSla, MODALIDAD_LABEL, PRIORIDAD_CHIP, PRIORIDAD_LABEL, SLA_COLOR,
} from '@/lib/tickets/sla'
import TicketThread from '@/components/tickets/ticket-thread'
import ResponseComposer from '@/components/tickets/response-composer'
import ControlEstado from '@/components/tickets/control-estado'

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

  // El bucket es privado: sin URL firmada el adjunto no se puede abrir.
  // Se firman todos de una vez porque la página se renderiza en cada visita.
  const adjuntos = attachments ?? []
  const urlsAdjuntos: Record<string, string> = {}
  if (adjuntos.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrls(adjuntos.map(a => a.storage_path), 60 * 10)
    for (const f of firmadas ?? []) {
      if (f.path && f.signedUrl) urlsAdjuntos[f.path] = f.signedUrl
    }
  }

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
  const isTerminado = ticket.status === 'resuelto'
  const esResponsable = user.id === ticket.responsable_id
  const esLevantador = user.id === ticket.levantado_por_id

  // Para tomar un ticket de la cola hay que pertenecer al área que lo atiende.
  // La RPC lo revalida del lado del servidor; esto solo decide qué se pinta.
  const { data: perfil } = await supabase
    .from('profiles')
    .select('area_id, rol')
    .eq('id', user.id)
    .single()
  const p = perfil as { area_id: string | null; rol: string } | null
  const esAdmin = p?.rol === 'admin'
  const puedeTomar = esAdmin || (p?.area_id != null && p.area_id === ticket.area_id)
  const sla = calcularSla(ticket, Date.now())
  const chipBase = 'text-[11.5px] font-medium px-2 py-[2px] rounded-full border'

  return (
    <div className="max-w-3xl">
      <Header
        title={`#${ticket.numero} — ${ticket.problema_nombre}`}
        subtitle={
          <span className="flex items-center gap-x-2 gap-y-1 flex-wrap">
            <StatusBadge status={ticket.status} />
            <span className="text-ink-300">·</span>
            <span>{ticket.area_nombre}</span>
          </span>
        }
      />

      {/* Prioridad, tiempo de atención y modalidad — lo que decide qué hacer primero */}
      <div className="mx-5 md:mx-9 mb-4 flex flex-wrap items-center gap-2">
        <span className={`${chipBase} ${PRIORIDAD_CHIP[ticket.prioridad]}`}>
          Prioridad {PRIORIDAD_LABEL[ticket.prioridad]}
        </span>
        <span
          className={`${chipBase} bg-white border-[#ECECEC] ${SLA_COLOR[sla.estado]}`}
        >
          {sla.etiqueta}
        </span>
        <span className={`${chipBase} bg-white border-[#ECECEC] text-ink-700`}>
          {MODALIDAD_LABEL[ticket.modalidad]}
        </span>
      </div>

      <div className="mx-5 md:mx-9 mb-5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
        <span className="text-ink-700">
          <span className="text-ink-400">Levantado por:</span> {ticket.levantado_por_nombre}
        </span>
        <span className="text-ink-700">
          <span className="text-ink-400">Responsable:</span>{' '}
          {ticket.responsable_nombre ?? <span className="text-ink-400">sin asignar</span>}
        </span>
      </div>

      {!isClosed && (
        <ControlEstado
          ticketId={ticket.id}
          numero={ticket.numero}
          estado={ticket.status}
          areaNombre={ticket.area_nombre}
          responsableId={ticket.responsable_id}
          puedeTomar={puedeTomar}
          puedeMoverEstado={esResponsable || esAdmin}
        />
      )}

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
        attachments={adjuntos}
        urlsAdjuntos={urlsAdjuntos}
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
