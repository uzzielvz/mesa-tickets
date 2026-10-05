import Link from 'next/link'
import { Search, Upload, AlertTriangle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio, BannerError } from '@/components/viz'
import { antiguedad, fechaCorta, hoyMexico, nombreClave, sumarDias } from '@/lib/vacaciones/calendario'
import type { SaldoEmpleado } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })

/**
 * La base de Gente y Cultura, viva (VAC-001). Lo que antes era un Excel cuyo
 * TODAY() se congelaba al guardarse: aquí la antigüedad y los saldos se
 * calculan contra la fecha real en cada consulta (RPC `vac_saldos`).
 */
export default async function VacacionesPage({
  searchParams,
}: {
  searchParams: { q?: string; ver?: string }
}) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('vac_saldos', {})
  const todos = (data as unknown as SaldoEmpleado[] | null) ?? []
  const hoy = hoyMexico()

  const activos = todos.filter(e => e.activo)
  const q = nombreClave(searchParams.q ?? '')
  const ver = searchParams.ver === 'inactivos' ? 'inactivos' : searchParams.ver === 'pendientes' ? 'pendientes' : 'todos'
  const lista = (ver === 'inactivos' ? todos.filter(e => !e.activo) : activos)
    .filter(e => ver !== 'pendientes' || e.restantes_total > 0)
    .filter(e => !q || nombreClave(e.nombre).includes(q) || nombreClave(e.puesto ?? '').includes(q))

  // ── Hallazgos de la base ──
  const conDerecho = activos.filter(e => e.anios >= 1)
  const pendientes = activos.reduce((a, e) => a + Math.max(Number(e.restantes_total), 0), 0)
  const faltaban = activos.filter(e => !e.en_ciclo1 && e.anios >= 1)
  const sinJefe = activos.filter(e => !e.jefe_id).length
  const sinCorreo = activos.filter(e => !e.email).length
  const proximos = activos
    .filter(e => e.proximo_aniversario >= hoy && e.proximo_aniversario <= sumarDias(hoy, 30))
    .sort((a, b) => a.proximo_aniversario.localeCompare(b.proximo_aniversario))

  return (
    <div>
      <Header
        title="Vacaciones"
        subtitle="La base de Gente y Cultura, con antigüedad y saldos calculados al día de hoy."
        action={
          <Link href="/vacaciones/importar" className="text-[13px] text-navy hover:underline font-medium">
            Importar base
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5">
        {error && <BannerError mensaje={error.message} />}

        {todos.length === 0 ? (
          <Panel titulo="Todavía no hay personal cargado">
            <div className="px-5 py-5 flex flex-col gap-2">
              <p className="text-[12.5px] text-ink-500">
                Se empieza importando la base de Excel de Gente y Cultura. Se puede volver a importar
                sin duplicar a nadie.
              </p>
              <Link href="/vacaciones/importar" className="inline-flex items-center gap-1.5 text-[13px] text-navy font-medium hover:underline">
                <Upload size={14} /> Importar la base
              </Link>
            </div>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile etiqueta="Días por tomar" valor={fmt(pendientes)} apoyo={`entre ${conDerecho.length} personas con derecho`} acento />
              <Tile etiqueta="Personal activo" valor={String(activos.length)} apoyo={`${activos.length - conDerecho.length} aún sin cumplir un año`} />
              <Tile etiqueta="Cumplen años de servicio" valor={String(proximos.length)} apoyo="en los próximos 30 días" />
              <Tile etiqueta="Sin jefe asignado" valor={String(sinJefe)} apoyo={`${sinCorreo} sin correo · se necesitan para la fase 2`} />
            </div>

            {faltaban.length > 0 && (
              <div className="border border-[#FFE0B2] bg-[#FFF8E1] rounded-md px-4 py-3">
                <p className="flex items-start gap-1.5 text-[13px] text-[#8A6100] font-medium">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {faltaban.length} {faltaban.length === 1 ? 'persona no aparecía' : 'personas no aparecían'} en la hoja visible del Excel y ya {faltaban.length === 1 ? 'tiene' : 'tienen'} derecho a vacaciones
                </p>
                <p className="text-[12px] text-[#8A6100] mt-1">
                  {faltaban.map(e => `${e.nombre} (${fmt(e.restantes_total)} días)`).join(' · ')}.
                  Solo estaban en la hoja oculta CICLO 2. Aquí ya cuentan.
                </p>
              </div>
            )}

            <form action="/vacaciones" method="get" className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  name="q"
                  defaultValue={searchParams.q ?? ''}
                  placeholder="Buscar por nombre o puesto"
                  className="bg-white border border-[#ECECEC] rounded pl-8 pr-3 py-1.5 text-[13px] text-ink-900 outline-none focus:border-orange w-64"
                />
              </div>
              {ver !== 'todos' && <input type="hidden" name="ver" value={ver} />}
              {([['todos', 'Todos'], ['pendientes', 'Con días por tomar'], ['inactivos', 'Inactivos']] as const).map(([k, t]) => (
                <Link
                  key={k}
                  href={`/vacaciones?ver=${k}${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''}`}
                  className={`text-[12px] font-medium rounded px-2.5 py-[5px] border transition-colors ${
                    ver === k ? 'border-orange bg-orange/10 text-orange-dark' : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
                  }`}
                >
                  {t}
                </Link>
              ))}
            </form>

            <Panel titulo="Personal" nota={`${lista.length} ${lista.length === 1 ? 'persona' : 'personas'}`}>
              {lista.length === 0 ? (
                <Vacio mensaje="Nadie coincide con la búsqueda." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
                        <th className="px-5 py-2 font-medium">Nombre</th>
                        <th className="px-3 py-2 font-medium">Ingreso</th>
                        <th className="px-3 py-2 font-medium">Antigüedad</th>
                        <th className="px-3 py-2 font-medium text-right">Periodo actual</th>
                        <th className="px-3 py-2 font-medium text-right">Por tomar</th>
                        <th className="px-3 py-2 font-medium">Próximo aniversario</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(e => {
                        const actual = e.periodos[e.periodos.length - 1]
                        return (
                          <tr key={e.id} className="border-b border-[#F5F5F5] last:border-0 hover:bg-surface-hover">
                            <td className="px-5 py-2.5">
                              <Link href={`/vacaciones/${e.id}`} className="text-ink-900 font-medium hover:text-navy">
                                {e.nombre}
                              </Link>
                              {e.puesto && <p className="text-[11.5px] text-ink-400">{e.puesto}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">{fechaCorta(e.fecha_ingreso)}</td>
                            <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">{antiguedad(e.fecha_ingreso, hoy)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-ink-700 whitespace-nowrap">
                              {actual ? `${fmt(actual.tomados)} de ${actual.derecho}` : <span className="text-ink-400">sin derecho aún</span>}
                            </td>
                            <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                              e.restantes_total < 0 ? 'text-[#C62828]' : e.restantes_total > 0 ? 'text-ink-900' : 'text-ink-400'
                            }`}>
                              {fmt(e.restantes_total)}
                            </td>
                            <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">
                              {fechaCorta(e.proximo_aniversario)}
                              <span className="text-ink-400"> · +{e.dias_proximo}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <Link href={`/vacaciones/${e.id}`} aria-label={`Ver a ${e.nombre}`}>
                                <ArrowRight size={14} className="text-ink-400" />
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <p className="text-[11.5px] text-ink-400">
              &ldquo;Periodo actual&rdquo; es el último año de servicio cumplido: días tomados de los que da la ley.
              &ldquo;Por tomar&rdquo; suma todos los periodos. Calculado al {fechaCorta(hoy)}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
