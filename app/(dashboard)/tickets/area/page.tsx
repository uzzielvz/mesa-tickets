import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { TicketWithStatus } from '@/lib/supabase/types'
import Header from '@/components/layout/header'
import ColaArea from '@/components/tickets/cola-area'
import { calcularSla } from '@/lib/tickets/sla'

export const metadata = { title: 'Cola del área — Tickets' }

interface PageProps {
  /** `?area=<uuid>` para ver una cola concreta, `?area=todas` para todas. Solo aplica a supervisores. */
  searchParams: { area?: string }
}

export default async function ColaAreaPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('area_id, rol, supervisa_tickets, areas(nombre)')
    .eq('id', user.id)
    .single()

  const p = perfil as {
    area_id: string | null
    rol: string
    supervisa_tickets: boolean
    areas: { nombre: string } | null
  } | null

  const areaPropia = p?.area_id ?? null
  // Supervisar la mesa es ortogonal al rol: lo da el flag, y el admin del
  // sistema lo tiene implícito porque la RLS ya lo deja leer todo.
  const supervisa = p?.rol === 'admin' || p?.supervisa_tickets === true

  // Áreas disponibles solo para quien supervisa; al resto no le sirven.
  const { data: rawAreas } = supervisa
    ? await supabase.from('areas').select('id, nombre').eq('activo', true).order('nombre')
    : { data: null }
  const areas = (rawAreas ?? []) as { id: string; nombre: string }[]

  // Qué cola se está viendo.
  const pedida = searchParams.area
  const verTodas = supervisa && (pedida === 'todas' || (!pedida && !areaPropia))
  const areaVista = verTodas
    ? null
    : (supervisa && pedida && pedida !== 'todas' ? pedida : areaPropia)

  if (!verTodas && !areaVista) {
    return (
      <div>
        <Header title="Cola del área" />
        <div className="mx-5 md:mx-9 py-10 text-center border border-[#ECECEC] rounded-md">
          <p className="text-[13px] text-ink-400">
            Tu usuario todavía no tiene un área asignada.
          </p>
        </div>
      </div>
    )
  }

  const nombreVista = verTodas
    ? 'todas las áreas'
    : (areas.find(a => a.id === areaVista)?.nombre ?? p?.areas?.nombre ?? 'tu área')

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Con `verTodas` no se filtra por área: la RLS ya limita lo que cada quien
  // puede leer, así que el supervisor obtiene todo y el resto nunca llega aquí.
  let qTickets = supabase
    .from('tickets_with_status')
    .select('*')
    .not('estado', 'in', '("cerrado","rechazado")')
    .order('created_at', { ascending: true })
  let qCerrados = supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .gte('closed_at', hoy.toISOString())

  if (!verTodas && areaVista) {
    qTickets = qTickets.eq('area_id', areaVista)
    qCerrados = qCerrados.eq('area_id', areaVista)
  }

  const [{ data: rawTickets }, { count: cerradosHoy }] = await Promise.all([qTickets, qCerrados])

  const tickets = (rawTickets ?? []) as unknown as TicketWithStatus[]
  const ahora = Date.now()
  const sinTomar = tickets.filter(t => t.responsable_id === null).length
  const vencidos = tickets.filter(t => calcularSla(t, ahora).estado === 'vencido').length
  const enCurso = tickets.length - sinTomar

  const chip = (activo: boolean) =>
    `text-[12px] font-medium rounded-full border px-2.5 py-[3px] transition-colors ${
      activo ? 'bg-navy text-white border-navy'
              : 'bg-white text-ink-500 border-[#ECECEC] hover:bg-surface-hover'
    }`

  return (
    <div>
      <Header
        title={verTodas ? 'Colas de la mesa' : `Cola de ${nombreVista}`}
        subtitle={
          sinTomar > 0
            ? `${sinTomar} sin tomar · ${tickets.length} activos en total`
            : `${tickets.length} activos, todos con responsable`
        }
        action={
          <Link
            href="/tickets/nuevo"
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
          >
            Nuevo ticket
          </Link>
        }
      />

      {/* Selector de área — solo para quien supervisa la mesa. Para el resto
          la pantalla es exactamente la de antes, sin ruido. */}
      {supervisa && areas.length > 0 && (
        <div className="mx-5 md:mx-9 mb-4 flex flex-wrap items-center gap-1.5">
          <Link href="/tickets/area?area=todas" className={chip(verTodas)}>
            Todas
          </Link>
          {areas.map(a => (
            <Link key={a.id} href={`/tickets/area?area=${a.id}`} className={chip(a.id === areaVista)}>
              {a.nombre}
            </Link>
          ))}
        </div>
      )}

      {/* La salud del área de un vistazo. "Vencidos" en rojo solo cuando
          existe: en verde permanente sería ruido; en rojo permanente, alarma. */}
      <div className="mx-5 md:mx-9 mb-2 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Sin tomar', value: sinTomar, alerta: false },
          { label: 'Vencidos', value: vencidos, alerta: vencidos > 0 },
          { label: 'En curso', value: enCurso, alerta: false },
          { label: 'Cerrados hoy', value: cerradosHoy ?? 0, alerta: false },
        ].map(s => (
          <div
            key={s.label}
            className={`border rounded-md px-4 py-3 ${
              s.alerta ? 'border-red-200 bg-red-50/50' : 'border-[#ECECEC]'
            }`}
          >
            <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium block mb-1">
              {s.label}
            </span>
            <span
              className={`text-[24px] font-semibold tracking-tight leading-none ${
                s.alerta ? 'text-red-700' : 'text-navy'
              }`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <ColaArea
        tickets={tickets}
        ahora={ahora}
        usuarioId={user.id}
        mostrarArea={verTodas}
      />
    </div>
  )
}
