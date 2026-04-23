import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import type { TicketWithStatus } from '@/lib/supabase/types'

interface StatCardProps {
  label: string
  value: number
  href: string
  description: string
}

function StatCard({ label, value, href, description }: StatCardProps) {
  return (
    <Link href={href} className="flex flex-col gap-1 border border-[#ECECEC] rounded-md px-5 py-4 hover:bg-surface-hover transition-colors">
      <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{label}</span>
      <span className="text-[28px] font-semibold text-navy tracking-tight leading-none">{value}</span>
      <span className="text-[12px] text-ink-400">{description}</span>
    </Link>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, nombre_completo')
    .eq('id', user.id)
    .single()

  const { data: rawTickets } = await supabase
    .from('tickets_with_status')
    .select('*')
  const tickets = (rawTickets ?? []) as unknown as TicketWithStatus[]

  const misTickets = tickets.filter(t => t.levantado_por_id === user.id)
  const asignados = tickets.filter(t => t.responsable_id === user.id)

  const misAbiertos = misTickets.filter(t => t.status === 'abierto').length
  const misContestados = misTickets.filter(t => t.status === 'contestado').length
  const asignadosPendientes = asignados.filter(t => t.status === 'abierto').length
  const asignadosTerminados = asignados.filter(t => t.status === 'terminado').length

  const nombre = profile?.nombre_completo?.split(' ')[0] ?? 'Bienvenido'

  return (
    <div>
      <Header
        title={`Hola, ${nombre}`}
        subtitle="Esto es lo que está pasando hoy."
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-8">
        {/* Mis tickets */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Mis tickets</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Abiertos" value={misAbiertos} href="/tickets/mios" description="Esperando respuesta" />
            <StatCard label="Contestados" value={misContestados} href="/tickets/mios" description="Requieren tu respuesta" />
            <StatCard label="Total" value={misTickets.length} href="/tickets/mios" description="Tickets levantados" />
            <StatCard label="Cerrados" value={misTickets.filter(t => t.status === 'cerrado').length} href="/tickets/mios" description="Resueltos" />
          </div>
        </div>

        {/* Asignados — solo responsable/admin */}
        {(profile?.rol === 'responsable' || profile?.rol === 'admin') && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Asignados a mí</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Pendientes" value={asignadosPendientes} href="/tickets/asignados" description="Sin responder" />
              <StatCard label="Terminados" value={asignadosTerminados} href="/tickets/asignados" description="Esperando confirmación" />
              <StatCard label="Total" value={asignados.length} href="/tickets/asignados" description="Tickets asignados" />
              <StatCard label="Cerrados" value={asignados.filter(t => t.status === 'cerrado').length} href="/tickets/asignados" description="Resueltos" />
            </div>
          </div>
        )}

        {/* Acceso rápido */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Acceso rápido</p>
          <Link
            href="/tickets/nuevo"
            className="inline-block bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
          >
            Levantar nuevo ticket
          </Link>
        </div>
      </div>
    </div>
  )
}
