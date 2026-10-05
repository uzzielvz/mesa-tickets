import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Panel, Vacio } from '@/components/viz'
import ResolverSolicitud from '@/components/vacaciones/resolver-solicitud'
import { fechaCorta, hoyMexico } from '@/lib/vacaciones/calendario'
import { ETIQUETA_ESTADO, TONO_ESTADO, type BandejaJefe } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 })

/**
 * "Mi equipo" (VAC-004): el jefe directo autoriza aquí, no por correo. Es la
 * segunda de las tres firmas del formato GYC. Solo ve a quien lo tiene como
 * jefe en la base; eso lo decide `vac_bandeja_jefe`, no esta página.
 */
export default async function MiEquipoPage() {
  const supabase = createClient()
  const { data } = await supabase.rpc('vac_bandeja_jefe', {})
  const b = (data as unknown as BandejaJefe | null) ?? { es_jefe: false, pendientes: [], resueltas: [], equipo: [] }
  const hoy = hoyMexico()

  if (!b.es_jefe) {
    return (
      <div>
        <Header title="Mi equipo" />
        <div className="px-5 md:px-9 pb-12">
          <Panel titulo="No tienes personas a tu cargo">
            <Vacio mensaje="Según la base de Gente y Cultura, nadie te tiene como jefe directo. Si es un error, avísales." />
          </Panel>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Mi equipo" subtitle="Autoriza las vacaciones de tu equipo. Después, Gente y Cultura da el Vo. Bo." />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        <Panel titulo="Por autorizar" nota={`${b.pendientes.length} ${b.pendientes.length === 1 ? 'solicitud' : 'solicitudes'}`}>
          {b.pendientes.length === 0 ? (
            <Vacio mensaje="Nada pendiente. Cuando alguien de tu equipo solicite días, aparece aquí." />
          ) : (
            <ul className="divide-y divide-[#F5F5F5]">
              {b.pendientes.map(s => {
                const faltan = Math.round((new Date(`${s.fecha_inicio}T12:00:00Z`).getTime() - new Date(`${hoy}T12:00:00Z`).getTime()) / 86_400_000)
                return (
                  <li key={s.id} className="px-5 py-3.5 flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] text-ink-900">
                        <span className="font-medium">{s.empleado}</span>
                        <span className="text-ink-500">
                          {' · '}{fmt(s.dias)} {s.tipo === 'flotante' ? (s.dias === 1 ? 'día flotante' : 'días flotantes') : (s.dias === 1 ? 'día' : 'días')}
                          {' · '}{fechaCorta(s.fecha_inicio)}{s.fecha_fin !== s.fecha_inicio && ` – ${fechaCorta(s.fecha_fin)}`}
                        </span>
                      </p>
                      <p className={`text-[11.5px] ${faltan <= 5 ? 'text-[#C62828] font-medium' : 'text-ink-400'}`}>
                        {faltan <= 0 ? 'empieza hoy' : `sale en ${faltan} ${faltan === 1 ? 'día' : 'días'}`}
                      </p>
                    </div>
                    <p className="text-[12px] text-ink-500">
                      {s.puesto && <>{s.puesto} · </>}
                      {s.tipo === 'vacaciones' && <>le quedan {fmt(s.disponibles)} · </>}
                      regresa el {fechaCorta(s.fecha_regreso)}
                      {s.observaciones && <> · “{s.observaciones}”</>}
                    </p>
                    <ResolverSolicitud id={s.id} modo="jefe" />
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <Panel titulo="Mi equipo" nota={`${b.equipo.length} ${b.equipo.length === 1 ? 'persona' : 'personas'}`}>
            <ul className="divide-y divide-[#F5F5F5]">
              {b.equipo.map(p => (
                <li key={p.id} className="px-5 py-2.5 flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-ink-900 truncate">{p.nombre}</span>
                    {p.puesto && <span className="block text-[11px] text-ink-400 truncate">{p.puesto}</span>}
                  </span>
                  <span className="text-[12.5px] tabular-nums text-right whitespace-nowrap">
                    {p.anios >= 1
                      ? <><strong className="font-medium text-ink-900">{fmt(p.restantes)}</strong> <span className="text-ink-400">por tomar</span></>
                      : <span className="text-ink-400">sin derecho aún</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel titulo="Resueltas recientemente">
            {b.resueltas.length === 0 ? (
              <Vacio mensaje="Todavía no has resuelto ninguna." />
            ) : (
              <ul className="divide-y divide-[#F5F5F5]">
                {b.resueltas.map(r => (
                  <li key={r.id} className="px-5 py-2.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[12.5px] text-ink-900">
                      {r.empleado}
                      <span className="text-ink-400"> · {fmt(r.dias)} {r.dias === 1 ? 'día' : 'días'} · {fechaCorta(r.fecha_inicio)}</span>
                    </span>
                    <span className={`text-[11px] font-medium rounded px-2 py-[2px] ${TONO_ESTADO[r.estado]}`}>{ETIQUETA_ESTADO[r.estado]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
