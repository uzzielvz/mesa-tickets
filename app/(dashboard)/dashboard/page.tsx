import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { formatName } from '@/lib/utils/format'

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

  const [{ data: profile }, { data: rawMios }, { data: rawAsignados }] = await Promise.all([
    supabase.from('profiles').select('rol, nombre_completo, acceso_score, acceso_tickets').eq('id', user.id).single(),
    supabase.from('tickets_with_status').select('status').eq('levantado_por_id', user.id),
    supabase.from('tickets_with_status').select('status').eq('responsable_id', user.id),
  ])

  const accesoScore = (profile as { acceso_score?: boolean } | null)?.acceso_score === true
  const accesoTickets = (profile as { acceso_tickets?: boolean } | null)?.acceso_tickets === true
  const rol = profile?.rol ?? 'usuario'
  const hasScoreAccess = rol === 'admin' || accesoScore
  const hasTicketsAccess = rol === 'admin' || accesoTickets
  const soloScore = hasScoreAccess && !hasTicketsAccess

  let scoreStats = { total: 0, sinEvaluar: 0 }
  if (hasScoreAccess) {
    const { data: acreditados } = await supabase
      .from('acreditados')
      .select('calificacion_promotor')
    const list = acreditados ?? []
    scoreStats = {
      total: list.length,
      sinEvaluar: list.filter(a => !a.calificacion_promotor).length,
    }
  }

  const misTickets = (rawMios ?? []) as { status: string }[]
  const asignados = (rawAsignados ?? []) as { status: string }[]

  const misAbiertos = misTickets.filter(t => t.status === 'abierto').length
  const misEnCurso = misTickets.filter(
    t => t.status === 'en_revision' || t.status === 'programado',
  ).length
  const misPorConfirmar = misTickets.filter(t => t.status === 'resuelto').length
  const asignadosPendientes = asignados.filter(t => t.status === 'abierto').length
  const asignadosEnCurso = asignados.filter(
    t => t.status === 'en_revision' || t.status === 'programado',
  ).length
  const asignadosResueltos = asignados.filter(t => t.status === 'resuelto').length

  const nombre = profile
    ? formatName(profile.nombre_completo, user.email ?? '').split(' ')[0]
    : 'Bienvenido'

  return (
    <div>
      <Header
        title={`Hola, ${nombre}`}
        subtitle={
          soloScore
            ? 'Resumen del módulo Score crediticio.'
            : 'Esto es lo que está pasando hoy.'
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-8">
        {hasTicketsAccess && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Mis tickets</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Abiertos" value={misAbiertos} href="/tickets/mios" description="Aún sin tomar" />
              <StatCard label="En curso" value={misEnCurso} href="/tickets/mios" description="Alguien los atiende" />
              <StatCard label="Por confirmar" value={misPorConfirmar} href="/tickets/mios" description="Confirma si quedó resuelto" />
              <StatCard label="Cerrados" value={misTickets.filter(t => t.status === 'cerrado').length} href="/tickets/mios" description="Resueltos" />
            </div>
          </div>
        )}

        {hasTicketsAccess && (rol === 'responsable' || rol === 'admin') && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Asignados a mí</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Sin empezar" value={asignadosPendientes} href="/tickets/asignados" description="Tomados, sin trabajar" />
              <StatCard label="En curso" value={asignadosEnCurso} href="/tickets/asignados" description="En revisión o programados" />
              <StatCard label="Resueltos" value={asignadosResueltos} href="/tickets/asignados" description="Esperando confirmación" />
              <StatCard label="Cerrados" value={asignados.filter(t => t.status === 'cerrado').length} href="/tickets/asignados" description="Resueltos" />
            </div>
          </div>
        )}

        {hasScoreAccess && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Score crediticio</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard
                label="Acreditados"
                value={scoreStats.total}
                href="/score/acreditados"
                description="Registros capturados"
              />
              <StatCard
                label="Sin evaluar"
                value={scoreStats.sinEvaluar}
                href="/score/acreditados"
                description="Pendientes de promotor"
              />
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Acceso rápido</p>
          <div className="flex flex-wrap gap-2">
            {hasTicketsAccess && (
              <Link
                href="/tickets/nuevo"
                className="inline-block bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
              >
                Levantar nuevo ticket
              </Link>
            )}
            {hasScoreAccess && (
              <Link
                href="/score/acreditados/nuevo"
                className={`inline-block text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors ${
                  soloScore
                    ? 'bg-orange hover:bg-orange-dark text-white'
                    : 'border border-[#ECECEC] text-ink-900 hover:bg-surface-hover'
                }`}
              >
                Nuevo acreditado
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
