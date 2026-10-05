import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, AlertTriangle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio, BannerError } from '@/components/viz'
import ResolverSolicitud from '@/components/vacaciones/resolver-solicitud'
import { antiguedad, fechaCorta, hoyMexico, nombreClave, sumarDias } from '@/lib/vacaciones/calendario'
import type { BandejaRh, SaldoEmpleado } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })

/**
 * La base de Gente y Cultura, viva (VAC-001). Lo que antes era un Excel cuyo
 * TODAY() se congelaba al guardarse: aquí la antigüedad y los saldos se
 * calculan contra la fecha real en cada consulta (RPC `vac_saldos`).
 *
 * La plataforma ES la base: el Excel se cargó una sola vez al arrancar
 * (2026-10-04, `vac_importar_base`) y de ahí en adelante todo se registra aquí.
 */
export default async function VacacionesPage({
  searchParams,
}: {
  searchParams: { q?: string; ver?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_vacaciones_rh')
    .eq('id', user!.id)
    .single()
  const p = profile as Record<string, unknown> | null
  // Quien no es de Gente y Cultura entra al módulo por "Mis vacaciones".
  if (!(p?.rol === 'admin' || p?.acceso_vacaciones_rh === true)) redirect('/vacaciones/mias')

  const [{ data, error }, { data: bandejaData }] = await Promise.all([
    supabase.rpc('vac_saldos', {}),
    supabase.rpc('vac_bandeja_rh', {}),
  ])
  const todos = (data as unknown as SaldoEmpleado[] | null) ?? []
  const bandeja = (bandejaData as unknown as BandejaRh | null) ?? { por_vobo: [], esperando_jefe: [] }
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
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5">
        {error && <BannerError mensaje={error.message} />}

        {/* ── Solicitudes: el Vo. Bo. de RH y lo que espera a un jefe ── */}
        {(bandeja.por_vobo.length > 0 || bandeja.esperando_jefe.length > 0) && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
            <Panel titulo="Esperan tu Vo. Bo." nota={`${bandeja.por_vobo.length} ${bandeja.por_vobo.length === 1 ? 'solicitud' : 'solicitudes'}`}>
              {bandeja.por_vobo.length === 0 ? (
                <Vacio mensaje="Nada por revisar. Las que autorice un jefe aparecen aquí." />
              ) : (
                <ul className="divide-y divide-[#F5F5F5]">
                  {bandeja.por_vobo.map(s => (
                    <li key={s.id} className="px-5 py-3.5 flex flex-col gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[13px] text-ink-900">
                          <Link href={`/vacaciones/${s.empleado_id}`} className="font-medium hover:text-navy">{s.empleado}</Link>
                          <span className="text-ink-500">
                            {' · '}{fmt(s.dias)} {s.tipo === 'flotante' ? (s.dias === 1 ? 'día flotante' : 'días flotantes') : (s.dias === 1 ? 'día' : 'días')}
                            {' · '}{fechaCorta(s.fecha_inicio)}{s.fecha_fin !== s.fecha_inicio && ` – ${fechaCorta(s.fecha_fin)}`}
                          </span>
                        </p>
                        <p className="text-[11.5px] text-ink-400">Folio {s.folio} · le quedan {fmt(s.disponibles)}</p>
                      </div>
                      <p className="text-[12px] text-ink-500">
                        {s.jefe ? <>Autorizó {s.jefe}{s.jefe_at && ` el ${fechaCorta(s.jefe_at)}`}</> : 'Sin jefe asignado: llega directo a RH'}
                        {s.jefe_comentario && <> · “{s.jefe_comentario}”</>}
                        {s.observaciones && <> · Nota: {s.observaciones}</>}
                      </p>
                      <ResolverSolicitud id={s.id} modo="rh" />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel titulo="Esperan a su jefe" nota={String(bandeja.esperando_jefe.length)}>
              {bandeja.esperando_jefe.length === 0 ? (
                <Vacio mensaje="Ningún jefe tiene solicitudes pendientes." />
              ) : (
                <ul className="divide-y divide-[#F5F5F5]">
                  {bandeja.esperando_jefe.map(s => (
                    <li key={s.id} className="px-5 py-2.5">
                      <p className="text-[12.5px] text-ink-900">{s.empleado}</p>
                      <p className={`text-[11.5px] ${s.dias_para_inicio <= 5 ? 'text-[#C62828]' : 'text-ink-400'}`}>
                        {s.jefe ?? 'Sin jefe'} · {s.dias_esperando === 0 ? 'desde hoy' : `${s.dias_esperando} ${s.dias_esperando === 1 ? 'día' : 'días'} esperando`}
                        {' · '}sale en {s.dias_para_inicio} {s.dias_para_inicio === 1 ? 'día' : 'días'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}

        {todos.length === 0 ? (
          <Panel titulo="No hay personal registrado">
            <Vacio mensaje="La base de Gente y Cultura no tiene a nadie todavía." />
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile etiqueta="Días por tomar" valor={fmt(pendientes)} apoyo={`entre ${conDerecho.length} personas con derecho`} acento />
              <Tile etiqueta="Personal activo" valor={String(activos.length)} apoyo={`${activos.length - conDerecho.length} aún sin cumplir un año`} />
              <Tile etiqueta="Cumplen años de servicio" valor={String(proximos.length)} apoyo="en los próximos 30 días" />
              <Tile etiqueta="Sin jefe asignado" valor={String(sinJefe)} apoyo={`${sinCorreo} sin correo: no pueden pedir en línea`} />
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
