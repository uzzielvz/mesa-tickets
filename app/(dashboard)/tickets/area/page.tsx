import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { TicketWithStatus } from '@/lib/supabase/types'
import Header from '@/components/layout/header'
import ColaArea from '@/components/tickets/cola-area'

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

  const { data: rawTickets } = await supabase
    .from('tickets_with_status')
    .select('*')
    .eq('area_id', areaId)
    .not('estado', 'in', '("cerrado","rechazado")')
    .order('created_at', { ascending: true })

  const tickets = (rawTickets ?? []) as unknown as TicketWithStatus[]
  const sinTomar = tickets.filter(t => t.responsable_id === null).length

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
      <ColaArea tickets={tickets} ahora={Date.now()} usuarioId={user.id} />
    </div>
  )
}
