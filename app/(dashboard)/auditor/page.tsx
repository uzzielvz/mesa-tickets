import Link from 'next/link'
import { Search, Upload, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio, BannerError } from '@/components/viz'
import type { PendientesAuditor } from '@/lib/auditor/tipos'

export const dynamic = 'force-dynamic'

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const pesos = (n: number) => MXN.format(n)
const sinCeros = (s: string) => s.replace(/^0+(?=\d)/, '')
const fecha = (iso: string | null) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '—'

/**
 * Auditor de depósitos (AUD-001). Lo que hoy Charly le explica a cada promotor
 * por teléfono: qué depósitos registró que no cuadran con lo que entró al banco.
 *
 * Esta versión enseña los de toda la cartera. Cuando el archivo traiga la
 * columna PROMOTOR, cada promotor verá solo los suyos.
 */
export default async function AuditorPage({ searchParams }: { searchParams: { grupo?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_auditor_carga')
    .eq('id', user!.id)
    .single()
  const p = profile as Record<string, unknown> | null
  const puedeCargar = p?.rol === 'admin' || p?.acceso_auditor_carga === true

  const grupo = (searchParams.grupo ?? '').replace(/\D/g, '').slice(0, 6)
  const { data, error } = await supabase.rpc('aud_pendientes', { p_grupo: grupo || null })
  const d = data as unknown as PendientesAuditor | null

  return (
    <div>
      <Header
        title="Depósitos sin conciliar"
        subtitle="Lo que los promotores registraron en Yunius y no cuadra con lo que entró al banco."
        action={puedeCargar ? (
          <Link href="/auditor/cargar" className="text-[13px] text-navy hover:underline font-medium">
            Cargar archivo
          </Link>
        ) : undefined}
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        {error && <BannerError mensaje={error.message} />}

        {!d?.carga ? (
          <Panel titulo="Todavía no hay ningún archivo cargado">
            <div className="px-5 py-5 flex flex-col gap-2">
              <p className="text-[12.5px] text-ink-500">
                En cuanto se suba el archivo de pagos registrados de Yunius, aquí aparecen los depósitos sin conciliar.
              </p>
              {puedeCargar && (
                <Link href="/auditor/cargar" className="inline-flex items-center gap-1.5 text-[13px] text-navy font-medium hover:underline">
                  <Upload size={14} /> Cargar el archivo
                </Link>
              )}
            </div>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile etiqueta="Sin conciliar" valor={String(d.sin_conciliar)} apoyo={`de ${d.registros.toLocaleString('es-MX')} depósitos registrados`} acento />
              <Tile etiqueta="Monto sin conciliar" valor={pesos(d.monto_sin_conciliar)} apoyo={`en ${d.grupos_pendientes} grupos`} />
              <Tile etiqueta="Periodo del archivo" valor={fecha(d.carga.fecha_max)} apoyo={`desde ${fecha(d.carga.fecha_min)}`} />
              <Tile etiqueta="Resueltos" valor={String(d.resueltos_desde_anterior)} apoyo="desde la carga anterior" />
            </div>

            {d.con_promotor === 0 && (
              <p className="flex items-start gap-1.5 text-[12px] text-ink-500 border border-[#ECECEC] bg-surface-sidebar rounded-md px-3.5 py-2.5">
                <Info size={13} className="mt-0.5 shrink-0 text-ink-400" />
                <span>
                  El archivo todavía no dice de qué promotor es cada grupo, así que esta vista es de toda la cartera.
                  En cuanto traiga la columna <span className="font-mono">PROMOTOR</span> con su correo, cada promotor
                  podrá entrar y ver solo lo suyo.
                </span>
              </p>
            )}

            <form action="/auditor" method="get" className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  name="grupo"
                  defaultValue={grupo ? sinCeros(grupo) : ''}
                  placeholder="Filtrar por grupo"
                  inputMode="numeric"
                  className="bg-white border border-[#ECECEC] rounded pl-8 pr-3 py-1.5 text-[13px] text-ink-900 outline-none focus:border-orange w-48"
                />
              </div>
              {grupo && (
                <Link href="/auditor" className="text-[12.5px] text-ink-500 hover:text-ink-900">Quitar filtro</Link>
              )}
            </form>

            <Panel titulo="Por conciliar" nota={`${d.pendientes.length} ${d.pendientes.length === 1 ? 'depósito' : 'depósitos'}`}>
              {d.pendientes.length === 0 ? (
                <Vacio mensaje={grupo ? `El grupo ${sinCeros(grupo)} no tiene depósitos sin conciliar.` : 'Todo está conciliado.'} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
                        <th className="px-5 py-2 font-medium">Depósito</th>
                        <th className="px-3 py-2 font-medium">Grupo</th>
                        <th className="px-3 py-2 font-medium">Ciclo · semana</th>
                        <th className="px-3 py-2 font-medium text-right">Monto</th>
                        {d.con_promotor > 0 && <th className="px-5 py-2 font-medium">Promotor</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {d.pendientes.map((x, i) => (
                        <tr key={`${x.grupo_id}-${x.fecha_deposito}-${i}`} className="border-b border-[#F5F5F5] last:border-0">
                          <td className="px-5 py-2.5 text-ink-700 whitespace-nowrap">{fecha(x.fecha_deposito)}</td>
                          <td className="px-3 py-2.5">
                            <Link href={`/auditor?grupo=${sinCeros(x.grupo_id)}`} className="text-ink-900 font-medium hover:text-navy">
                              {sinCeros(x.grupo_id)}
                            </Link>
                            {x.nombre_grupo && <span className="text-ink-500"> · {x.nombre_grupo}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-ink-700 tabular-nums">
                            {sinCeros(x.ciclo)}{x.periodo !== null && <span className="text-ink-400"> · sem {x.periodo}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-medium">{pesos(x.monto)}</td>
                          {d.con_promotor > 0 && <td className="px-5 py-2.5 text-ink-500">{x.promotor ?? '—'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <p className="text-[11.5px] text-ink-400">
              Archivo vigente: <span className="font-mono">{d.carga.nombre_archivo}</span>, cargado el{' '}
              {new Date(d.carga.created_at).toLocaleString('es-MX', {
                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
              })}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
