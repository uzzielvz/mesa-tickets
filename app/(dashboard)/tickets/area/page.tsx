import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { TicketWithStatus } from '@/lib/supabase/types'
import Header from '@/components/layout/header'
import ColaArea from '@/components/tickets/cola-area'
import { calcularSla } from '@/lib/tickets/sla'

export const metadata = { title: 'Cola del área — Tickets' }

export default async function ColaAreaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('area_id, areas(nombre)')
    .eq('id', user.id)
    .single()

  const areaId = (perfil as { area_id: string | null } | null)?.area_id
  const areaNombre =
    (perfil as { areas: { nombre: string } | null } | null)?.areas?.nombre ?? 'tu área'

  // El layout del dashboard ya empuja a /stand-by a quien no tiene área,
  // así que esto solo se ve si el perfil quedó a medias.
  if (!areaId) {
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

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [{ data: rawTickets }, { count: cerradosHoy }] = await Promise.all([
    supabase
      .from('tickets_with_status')
      .select('*')
      .eq('area_id', areaId)
      .not('estado', 'in', '("cerrado","rechazado")')
      .order('created_at', { ascending: true }),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('area_id', areaId)
      .gte('closed_at', hoy.toISOString()),
  ])

  const tickets = (rawTickets ?? []) as unknown as TicketWithStatus[]
  const ahora = Date.now()
  const sinTomar = tickets.filter(t => t.responsable_id === null).length
  const vencidos = tickets.filter(t => calcularSla(t, ahora).estado === 'vencido').length
  const enCurso = tickets.length - sinTomar

  return (
    <div>
      <Header
        title={`Cola de ${areaNombre}`}
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

      <ColaArea tickets={tickets} ahora={ahora} usuarioId={user.id} />
    </div>
  )
}
