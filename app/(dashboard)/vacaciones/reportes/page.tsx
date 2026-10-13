import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio, BannerError } from '@/components/viz'
import CalendarioAusencias from '@/components/vacaciones/calendario-ausencias'
import FueraPorSemana from '@/components/vacaciones/fuera-por-semana'
import { fechaCorta, fechaLarga, hoyMexico } from '@/lib/vacaciones/calendario'
import { duracion, leerAgrupar } from '@/lib/vacaciones/seguimiento'
import { DIAS_ANIVERSARIO, DIAS_TIEMPOS, cargarSeguimiento } from '@/lib/vacaciones/seguimiento-carga'

export const dynamic = 'force-dynamic'

const SEMANAS = [4, 8, 12] as const

const chip = (activo: boolean) =>
  `text-[12px] font-medium rounded px-2.5 py-[5px] border transition-colors ${
    activo ? 'border-orange bg-orange/10 text-orange-dark' : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
  }`

/**
 * Reportes de Gente y Cultura (VAC-009): quién estará fuera, quién gana días
 * pronto y cuánto tarda cada paso del proceso. Lo mismo sale en el Excel de
 * seguimiento y en el informe ejecutivo en PDF.
 */
export default async function ReportesVacacionesPage({
  searchParams,
}: {
  searchParams: { semanas?: string; agrupar?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('rol, acceso_vacaciones_rh').eq('id', user!.id).single()
  const p = profile as Record<string, unknown> | null
  if (!(p?.rol === 'admin' || p?.acceso_vacaciones_rh === true)) redirect('/vacaciones/mias')

  const hoy = hoyMexico()
  const n = SEMANAS.find(s => String(s) === searchParams.semanas) ?? 8
  const agrupar = leerAgrupar(searchParams.agrupar) === 'area' ? 'area' : 'jefe'
  const datos = await cargarSeguimiento(supabase, hoy, n, agrupar)
  const { error, semanas, calendario, grupos, porSemana, personasFuera, aniversarios, resumen: r } = datos
  const anio = hoy.slice(0, 4)
  const url = (cambios: Record<string, string>) => {
    const q = new URLSearchParams({ semanas: String(n), agrupar, ...cambios })
    return `/vacaciones/reportes?${q.toString()}`
  }

  return (
    <div>
      <Header
        title="Reportes de vacaciones"
        subtitle={`Calculado al ${fechaLarga(hoy)}, con la fecha real.`}
        action={
          <div className="flex flex-wrap gap-2 justify-end">
            <a
              href="/api/vacaciones/informe"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-3.5 py-1.5"
            >
              <FileText size={14} /> Informe ejecutivo (PDF)
            </a>
            <a
              href={`/api/vacaciones/reporte?tipo=seguimiento&semanas=${n}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-navy border border-[#ECECEC] hover:bg-surface-hover rounded px-3.5 py-1.5"
            >
              <Download size={14} /> Excel de seguimiento
            </a>
          </div>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5">
        {error && <BannerError mensaje={error.message} />}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            etiqueta="Fuera esta semana"
            valor={String(porSemana[0].aprobadas + porSemana[0].tramite)}
            apoyo={porSemana[0].tramite > 0 ? `${porSemana[0].tramite} todavía en trámite` : `semana del ${porSemana[0].semana.etiqueta}`}
            acento
          />
          <Tile etiqueta={`Con días fuera en ${n} semanas`} valor={String(personasFuera)} apoyo={`${calendario.ausencias.length} ausencias registradas o pedidas`} />
          <Tile etiqueta="Cumplen años de servicio" valor={String(aniversarios.length)} apoyo={`en los próximos ${DIAS_ANIVERSARIO} días`} />
          <Tile
            etiqueta="Solicitudes atoradas"
            valor={String(r.atoradas.length)}
            apoyo={r.pendientes > 0 ? `de ${r.pendientes} pendientes · 2+ días hábiles` : 'nada pendiente'}
          />
        </div>

        {/* ── Calendario ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium mr-1">Ventana</span>
          {SEMANAS.map(s => (
            <Link key={s} href={url({ semanas: String(s) })} className={chip(s === n)}>{s} semanas</Link>
          ))}
          <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium ml-3 mr-1">Agrupar por</span>
          <Link href={url({ agrupar: 'jefe' })} className={chip(agrupar === 'jefe')}>Jefe</Link>
          <Link href={url({ agrupar: 'area' })} className={chip(agrupar === 'area')}>Área</Link>
        </div>

        <Panel titulo="Personas fuera por semana" nota={`del ${fechaCorta(semanas[0].inicio)} al ${fechaCorta(semanas[semanas.length - 1].fin)}`}>
          <FueraPorSemana datos={porSemana} />
        </Panel>

        <Panel titulo="Calendario de ausencias" nota={`${personasFuera} ${personasFuera === 1 ? 'persona' : 'personas'} · lunes a viernes`}>
          <CalendarioAusencias grupos={grupos} semanas={semanas} festivos={calendario.festivos} hoy={hoy} />
        </Panel>

        {/* ── Aniversarios ── */}
        <Panel titulo="Aniversarios próximos" nota={`próximos ${DIAS_ANIVERSARIO} días`}>
          {aniversarios.length === 0 ? (
            <Vacio mensaje={`Nadie cumple años de servicio en los próximos ${DIAS_ANIVERSARIO} días.`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
                    <th className="px-5 py-2 font-medium">Persona</th>
                    <th className="px-3 py-2 font-medium">Jefe directo</th>
                    <th className="px-3 py-2 font-medium">Aniversario</th>
                    <th className="px-3 py-2 font-medium text-right">Cumple</th>
                    <th className="px-3 py-2 font-medium text-right">Gana</th>
                    <th className="px-5 py-2 font-medium text-right">Hoy tiene por tomar</th>
                  </tr>
                </thead>
                <tbody>
                  {aniversarios.map(a => (
                    <tr key={a.id} className="border-b border-[#F5F5F5] last:border-0 hover:bg-surface-hover">
                      <td className="px-5 py-2.5">
                        <Link href={`/vacaciones/${a.id}`} className="text-ink-900 font-medium hover:text-navy">{a.nombre}</Link>
                        {a.puesto && <p className="text-[11.5px] text-ink-400">{a.puesto}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-700">{a.jefe ?? '—'}</td>
                      <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">
                        {fechaCorta(a.fecha)}
                        <span className="text-ink-400"> · {a.faltan === 0 ? 'hoy' : `en ${a.faltan} ${a.faltan === 1 ? 'día' : 'días'}`}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{a.cumple} {a.cumple === 1 ? 'año' : 'años'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-medium">+{a.gana}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-ink-700">{a.porTomar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ── Tiempos ── */}
        <Panel titulo="Tiempos de respuesta" nota={`solicitudes de los últimos ${DIAS_TIEMPOS} días y todo lo pendiente`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 pt-4">
            <Tile etiqueta="Respuesta del jefe" valor={duracion(r.medianaJefe)} apoyo={`mediana de ${r.respondidasJefe} ${r.respondidasJefe === 1 ? 'respuesta' : 'respuestas'}`} />
            <Tile etiqueta="Vo. Bo. de Gente y Cultura" valor={duracion(r.medianaRh)} apoyo={`mediana de ${r.respondidasRh}`} />
            <Tile etiqueta="Pendientes ahora" valor={String(r.pendientes)} apoyo="con el jefe o con Gente y Cultura" />
            <Tile etiqueta="Atoradas" valor={String(r.atoradas.length)} apoyo="2 días hábiles o más en el mismo paso" />
          </div>

          <p className="px-5 pt-5 pb-1.5 text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Por jefe</p>
          {r.porJefe.length === 0 ? (
            <Vacio mensaje="Todavía no hay solicitudes en este periodo." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
                    <th className="px-5 py-2 font-medium">Jefe</th>
                    <th className="px-3 py-2 font-medium text-right">Solicitudes</th>
                    <th className="px-3 py-2 font-medium text-right">Respondidas</th>
                    <th className="px-3 py-2 font-medium text-right">Rechazadas</th>
                    <th className="px-3 py-2 font-medium text-right">Mediana</th>
                    <th className="px-3 py-2 font-medium text-right">La más lenta</th>
                    <th className="px-5 py-2 font-medium text-right">Pendientes</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porJefe.map(j => (
                    <tr key={j.jefe} className="border-b border-[#F5F5F5] last:border-0">
                      <td className="px-5 py-2.5 text-ink-900">{j.jefe}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{j.solicitudes}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{j.respondidas}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{j.rechazadas}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-medium">{duracion(j.mediana)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{duracion(j.maxima)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-ink-700">
                        {j.pendientes}
                        {j.esperaMaxima !== null && j.pendientes > 0 && (
                          <span className="text-ink-400"> · {j.esperaMaxima} {j.esperaMaxima === 1 ? 'día hábil' : 'días hábiles'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="px-5 pt-5 pb-1.5 text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Atoradas</p>
          {r.atoradas.length === 0 ? (
            <Vacio mensaje="Ninguna solicitud lleva 2 días hábiles o más esperando." />
          ) : (
            <ul className="divide-y divide-[#F5F5F5] pb-2">
              {r.atoradas.map(t => (
                <li key={t.folio} className="px-5 py-2.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-ink-900">
                    {t.empleado}
                    <span className="text-ink-500">
                      {' · '}{t.paso === 'jefe' ? `espera a ${t.jefe ?? 'su jefe'}` : 'espera el Vo. Bo. de Gente y Cultura'}
                    </span>
                  </span>
                  <span className="text-[11.5px] text-ink-400">
                    Folio {t.folio} · {t.espera_habil} días hábiles esperando · sale el {fechaCorta(t.fecha_inicio)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── Por rango ── */}
        <Panel titulo="Reporte de solicitudes y días tomados">
          <form action="/api/vacaciones/reporte" method="get" className="px-5 py-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tipo" value="periodo" />
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Del</span>
              <input
                type="date" name="desde" defaultValue={`${anio}-01-01`} required
                className="bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Al</span>
              <input
                type="date" name="hasta" defaultValue={`${anio}-12-31`} required
                className="bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-3.5 py-1.5"
            >
              <Download size={13} /> Descargar Excel
            </button>
            <p className="w-full text-[11.5px] text-ink-400">
              Las solicitudes en cualquier estado y los días tomados que caen, aunque sea en parte, dentro del rango, con
              quién autorizó y a qué hora. Rango máximo: dos años.
            </p>
          </form>
        </Panel>
      </div>
    </div>
  )
}
