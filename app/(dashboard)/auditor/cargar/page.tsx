import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Panel, Vacio } from '@/components/viz'
import CargaAuditor from '@/components/auditor/carga-form'

export const dynamic = 'force-dynamic'

const pesos = (n: number) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fecha = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'

export default async function CargarAuditorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_auditor_carga')
    .eq('id', user!.id)
    .single()
  const p = profile as Record<string, unknown> | null
  if (!(p?.rol === 'admin' || p?.acceso_auditor_carga === true)) redirect('/auditor')

  const { data } = await supabase
    .from('aud_cargas')
    .select('id, secuencia, nombre_archivo, registros, sin_conciliar, monto_sin_conciliar, fecha_min, fecha_max, created_at')
    .order('secuencia', { ascending: false })
    .limit(20)
  const cargas = data ?? []

  return (
    <div>
      <Header
        title="Cargar pagos registrados"
        subtitle="Cada archivo reemplaza la foto anterior; las anteriores quedan en el historial."
        action={<Link href="/auditor" className="text-[13px] text-navy hover:underline font-medium">Volver</Link>}
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <CargaAuditor />
        <Panel titulo="Historial de cargas" nota={cargas.length ? `últimas ${cargas.length}` : undefined}>
          {cargas.length === 0 ? (
            <Vacio mensaje="Todavía no se ha cargado ningún archivo." />
          ) : (
            <ul className="divide-y divide-[#F5F5F5]">
              {cargas.map((c, i) => (
                <li key={c.id} className="px-5 py-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-ink-900 font-mono truncate">
                      {c.nombre_archivo}
                      {i === 0 && <span className="ml-2 font-sans text-[11px] font-medium rounded px-1.5 py-[1px] bg-[#E7EEF9] text-navy">vigente</span>}
                    </p>
                    <p className="text-[12px] text-ink-500 tabular-nums">
                      {c.registros.toLocaleString('es-MX')} depósitos · {fecha(c.fecha_min)} – {fecha(c.fecha_max)} ·{' '}
                      {c.sin_conciliar} sin conciliar ({pesos(c.monto_sin_conciliar)})
                    </p>
                  </div>
                  <p className="text-[11.5px] text-ink-400">
                    {new Date(c.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
