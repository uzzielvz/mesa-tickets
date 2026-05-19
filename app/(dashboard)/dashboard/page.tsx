import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { formatName } from '@/lib/utils/format'
import { esSoloOperadorScore } from '@/lib/utils/score-permissions'

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
    supabase.from('profiles').select('rol, nombre_completo, acceso_score').eq('id', user.id).single(),
    supabase.from('tickets_with_status').select('status').eq('levantado_por_id', user.id),
    supabase.from('tickets_with_status').select('status').eq('responsable_id', user.id),
  ])

  const accesoScore = (profile as { acceso_score?: boolean } | null)?.acceso_score === true
  const rol = profile?.rol ?? 'usuario'
  const hasScoreAccess = rol === 'admin' || accesoScore
  const soloScore = esSoloOperadorScore(rol, accesoScore)

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
  const misContestados = misTickets.filter(t => t.status === 'contestado').length
  const asignadosPendientes = asignados.filter(t => t.status === 'abierto').length
  const asignadosTerminados = asignados.filter(t => t.status === 'terminado').length

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
        {!soloScore && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Mis tickets</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Abiertos" value={misAbiertos} href="/tickets/mios" description="Esperando respuesta" />
              <StatCard label="Contestados" value={misContestados} href="/tickets/mios" description="Requieren tu respuesta" />
              <StatCard label="Total" value={misTickets.length} href="/tickets/mios" description="Tickets levantados" />
              <StatCard label="Cerrados" value={misTickets.filter(t => t.status === 'cerrado').length} href="/tickets/mios" description="Resueltos" />
            </div>
          </div>
        )}

        {!soloScore && (rol === 'responsable' || rol === 'admin') && (
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
            {!soloScore && (
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
