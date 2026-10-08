import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Panel, Vacio } from '@/components/viz'
import CargaAuditor from '@/components/auditor/carga-form'
import CargaDepositos from '@/components/auditor/carga-depositos'

export const dynamic = 'force-dynamic'

const fecha = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'
const momento = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

/**
 * Las dos fuentes del Auditor (AUD-003):
 *   · Depósitos del banco (reporte de Yunius): la BASE de la conciliación.
 *   · Pagos registrados por el promotor: contra lo que se comparan.
 * Cada carga es una foto completa; la vigente es la última que entró completa.
 */
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

  const [{ data: dep }, { data: reg }] = await Promise.all([
    supabase
      .from('aud_dep_cargas')
      .select('id, secuencia, nombre_archivo, insertadas, no_conciliados, fecha_min, fecha_max, estado, created_at')
      .order('secuencia', { ascending: false })
      .limit(10),
    supabase
      .from('aud_cargas')
      .select('id, secuencia, nombre_archivo, registros, fecha_min, fecha_max, created_at')
      .order('secuencia', { ascending: false })
      .limit(10),
  ])
  const cargasDep = dep ?? []
  const cargasReg = reg ?? []
  const vigenteDep = cargasDep.find(c => c.estado === 'completa')?.id

  return (
    <div>
      <Header
        title="Cargar archivos del Auditor"
        subtitle="Cada archivo reemplaza la foto anterior de su tipo; las anteriores quedan en el historial."
        action={<Link href="/auditor" className="text-[13px] text-navy hover:underline font-medium">Volver</Link>}
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-navy">1. Depósitos del banco</h2>
            <p className="text-[12.5px] text-ink-500">
              El reporte de Yunius. Su columna <span className="font-mono text-[11.5px]">Conciliado</span> decide qué está pendiente.
            </p>
          </div>
          <CargaDepositos />
          <Panel titulo="Historial de depósitos" nota={cargasDep.length ? `últimas ${cargasDep.length}` : undefined}>
            {cargasDep.length === 0 ? (
              <Vacio mensaje="Todavía no se ha cargado ningún reporte de depósitos." />
            ) : (
              <ul className="divide-y divide-[#F5F5F5]">
                {cargasDep.map(c => (
                  <li key={c.id} className="px-5 py-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12.5px] text-ink-900 font-mono truncate">
                        {c.nombre_archivo}
                        {c.id === vigenteDep && <span className="ml-2 font-sans text-[11px] font-medium rounded px-1.5 py-[1px] bg-[#E7EEF9] text-navy">vigente</span>}
                        {c.estado === 'en_curso' && <span className="ml-2 font-sans text-[11px] font-medium rounded px-1.5 py-[1px] bg-[#FFEBEE] text-[#C62828]">incompleta</span>}
                      </p>
                      <p className="text-[12px] text-ink-500 tabular-nums">
                        {c.insertadas.toLocaleString('es-MX')} movimientos · {fecha(c.fecha_min)} – {fecha(c.fecha_max)} · {c.no_conciliados} no conciliados
                      </p>
                    </div>
                    <p className="text-[11.5px] text-ink-400">{momento(c.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-navy">2. Pagos registrados</h2>
            <p className="text-[12.5px] text-ink-500">Lo que registraron los promotores. También se puede subir desde Python.</p>
          </div>
          <CargaAuditor />
          <Panel titulo="Historial de pagos registrados" nota={cargasReg.length ? `últimas ${cargasReg.length}` : undefined}>
            {cargasReg.length === 0 ? (
              <Vacio mensaje="Todavía no se ha cargado ningún archivo." />
            ) : (
              <ul className="divide-y divide-[#F5F5F5]">
                {cargasReg.map((c, i) => (
                  <li key={c.id} className="px-5 py-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12.5px] text-ink-900 font-mono truncate">
                        {c.nombre_archivo}
                        {i === 0 && <span className="ml-2 font-sans text-[11px] font-medium rounded px-1.5 py-[1px] bg-[#E7EEF9] text-navy">vigente</span>}
                      </p>
                      <p className="text-[12px] text-ink-500 tabular-nums">
                        {c.registros.toLocaleString('es-MX')} registros · {fecha(c.fecha_min)} – {fecha(c.fecha_max)}
                      </p>
                    </div>
                    <p className="text-[11.5px] text-ink-400">{momento(c.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </div>
  )
}
