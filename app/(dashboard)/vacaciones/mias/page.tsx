import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio } from '@/components/viz'
import SolicitarVacaciones from '@/components/vacaciones/solicitar-form'
import CancelarSolicitud from '@/components/vacaciones/cancelar-solicitud'
import { antiguedad, fechaCorta, fechaLarga, hoyMexico } from '@/lib/vacaciones/calendario'
import { ETIQUETA_ESTADO, TONO_ESTADO, type MisVacaciones } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 })

/**
 * "Mis vacaciones" (VAC-004). Lo que pidió Gente y Cultura: entras y la página
 * te dice de entrada cuántos días te quedan, eliges fechas y lo solicitas. Tu
 * jefe lo autoriza aquí mismo y RH da el Vo. Bo.
 *
 * Todo sale de `vac_mis_vacaciones`, que solo devuelve lo de quien pregunta.
 */
export default async function MisVacacionesPage() {
  const supabase = createClient()
  const { data } = await supabase.rpc('vac_mis_vacaciones', {})
  const d = (data as unknown as MisVacaciones | null) ?? { empleado: null }
  const hoy = hoyMexico()

  if (!d.empleado) {
    return (
      <div>
        <Header title="Mis vacaciones" />
        <div className="px-5 md:px-9 pb-12">
          <Panel titulo="Tu correo no está en la base de vacaciones">
            <Vacio mensaje="Pídele a Gente y Cultura que registre tu correo corporativo y tu fecha de ingreso. En cuanto lo hagan, aquí aparecen tus días." />
          </Panel>
        </div>
      </div>
    )
  }

  const e = d.empleado
  const solicitudes = d.solicitudes ?? []
  const movimientos = d.movimientos ?? []
  const disponibles = Math.max(Number(e.restantes_total) - Number(e.dias_en_tramite ?? 0), 0)

  return (
    <div>
      <Header
        title="Mis vacaciones"
        subtitle={[e.puesto, `${antiguedad(e.fecha_ingreso, hoy)} en CrediFlexi`, e.jefe_nombre && `jefe directo: ${e.jefe_nombre}`]
          .filter(Boolean).join(' · ')}
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            etiqueta="Te quedan"
            valor={fmt(disponibles)}
            unidad={disponibles === 1 ? 'día' : 'días'}
            apoyo={Number(e.dias_en_tramite) > 0 ? `${fmt(e.dias_en_tramite)} en trámite` : e.anios >= 1 ? 'listos para usar' : 'aún no cumples un año'}
            acento
          />
          <Tile etiqueta="Próximo aniversario" valor={fechaCorta(e.proximo_aniversario)} apoyo={`ganas ${e.dias_proximo} días`} />
          <Tile etiqueta="Días flotantes" valor={fmt(e.flotantes_anio)} apoyo={`usados en ${hoy.slice(0, 4)}`} />
          <Tile etiqueta="Años de servicio" valor={String(e.anios)} apoyo={`desde el ${fechaLarga(e.fecha_ingreso)}`} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            <Panel titulo="Solicitar">
              <SolicitarVacaciones disponibles={disponibles} tieneDerecho={e.anios >= 1} hoy={hoy} jefe={e.jefe_nombre} />
            </Panel>

            <Panel titulo="Mis solicitudes" nota={solicitudes.length ? String(solicitudes.length) : undefined}>
              {solicitudes.length === 0 ? (
                <Vacio mensaje="Todavía no has solicitado nada por aquí." />
              ) : (
                <ul className="divide-y divide-[#F5F5F5]">
                  {solicitudes.map(s => (
                    <li key={s.id} className="px-5 py-3 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] text-ink-900">
                          <span className="font-medium">
                            {fmt(s.dias)} {s.tipo === 'flotante' ? (s.dias === 1 ? 'día flotante' : 'días flotantes') : (s.dias === 1 ? 'día' : 'días')}
                          </span>
                          <span className="text-ink-500">
                            {' · '}{fechaCorta(s.fecha_inicio)}{s.fecha_fin !== s.fecha_inicio && ` – ${fechaCorta(s.fecha_fin)}`}
                          </span>
                        </p>
                        <span className={`text-[11px] font-medium rounded px-2 py-[2px] ${TONO_ESTADO[s.estado]}`}>
                          {ETIQUETA_ESTADO[s.estado]}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-ink-400">
                        Folio {s.folio} · solicitada el {fechaCorta(s.created_at)}
                        {s.fecha_regreso && s.estado !== 'rechazada' && s.estado !== 'cancelada' && <> · regresas el {fechaCorta(s.fecha_regreso)}</>}
                      </p>
                      {s.jefe_comentario && <p className="text-[12px] text-ink-700">Tu jefe: “{s.jefe_comentario}”</p>}
                      {s.rh_comentario && <p className="text-[12px] text-ink-700">Gente y Cultura: “{s.rh_comentario}”</p>}
                      {(s.estado === 'pendiente_jefe' || s.estado === 'pendiente_rh') && (
                        <div><CancelarSolicitud id={s.id} /></div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="flex flex-col gap-4">
            <Panel titulo="Mis periodos" nota="uno por año de servicio">
              {e.periodos.length === 0 ? (
                <Vacio mensaje={`Tus primeros ${e.dias_proximo} días llegan el ${fechaLarga(e.proximo_aniversario)}.`} />
              ) : (
                <ul className="divide-y divide-[#F5F5F5]">
                  {e.periodos.map(p => (
                    <li key={p.periodo} className="px-5 py-2.5 flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-ink-900">
                        Año {p.periodo}
                        <span className="block text-[11px] text-ink-400">{fechaCorta(p.desde)} – {fechaCorta(p.hasta)}</span>
                      </span>
                      <span className="text-[12.5px] tabular-nums text-ink-700 whitespace-nowrap">
                        {fmt(p.tomados)} de {p.derecho} · <strong className="font-medium text-ink-900">quedan {fmt(p.restantes)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel titulo="Días tomados">
              {movimientos.length === 0 ? (
                <Vacio mensaje="Sin días registrados." />
              ) : (
                <ul className="divide-y divide-[#F5F5F5]">
                  {movimientos.map((m, i) => (
                    <li key={i} className="px-5 py-2.5">
                      <p className="text-[12.5px] text-ink-900">
                        {fmt(m.dias)} {m.tipo === 'flotante' ? (m.dias === 1 ? 'día flotante' : 'días flotantes') : (m.dias === 1 ? 'día' : 'días')}
                        {m.periodo && <span className="text-ink-400"> · año {m.periodo}</span>}
                      </p>
                      <p className="text-[11.5px] text-ink-400 whitespace-pre-line">
                        {m.fecha_inicio
                          ? `${fechaCorta(m.fecha_inicio)}${m.fecha_fin && m.fecha_fin !== m.fecha_inicio ? ` – ${fechaCorta(m.fecha_fin)}` : ''}`
                          : m.fechas_texto ?? 'Registro anterior a la plataforma'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
