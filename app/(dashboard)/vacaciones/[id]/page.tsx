import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio } from '@/components/viz'
import DatosEmpleado from '@/components/vacaciones/datos-form'
import RegistrarDias from '@/components/vacaciones/registrar-form'
import AnularMovimiento from '@/components/vacaciones/anular-boton'
import { antiguedad, fechaCorta, fechaLarga, hoyMexico } from '@/lib/vacaciones/calendario'
import type { Movimiento, SaldoEmpleado } from '@/lib/vacaciones/tipos'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 })

export default async function EmpleadoVacacionesPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound()

  const supabase = createClient()
  const [{ data: saldo }, { data: movs }, { data: jefes }] = await Promise.all([
    supabase.rpc('vac_saldos', { p_empleado: params.id }),
    supabase
      .from('vac_movimientos')
      .select('*')
      .eq('empleado_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vac_empleados')
      .select('id, nombre')
      .eq('activo', true)
      .neq('id', params.id)
      .order('nombre'),
  ])

  const e = ((saldo as unknown as SaldoEmpleado[] | null) ?? [])[0]
  if (!e) notFound()

  const movimientos = (movs ?? []) as Movimiento[]
  const hoy = hoyMexico()

  return (
    <div>
      <Header
        title={e.nombre}
        subtitle={[e.puesto, `ingreso ${fechaLarga(e.fecha_ingreso)}`, antiguedad(e.fecha_ingreso, hoy)].filter(Boolean).join(' · ')}
        action={
          <Link href="/vacaciones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        {!e.activo && (
          <p className="text-[12.5px] text-ink-500 border border-[#ECECEC] bg-surface-sidebar rounded-md px-4 py-2.5">
            Marcado como inactivo: no aparece en la lista principal.
          </p>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile etiqueta="Días por tomar" valor={fmt(e.restantes_total)} apoyo={e.anios >= 1 ? 'suma de todos los periodos' : 'aún no cumple un año'} acento />
          <Tile etiqueta="Años de servicio" valor={String(e.anios)} apoyo={`${fmt(e.dias_trabajados)} días trabajados`} />
          <Tile etiqueta="Próximo aniversario" valor={fechaCorta(e.proximo_aniversario)} apoyo={`gana ${e.dias_proximo} días`} />
          <Tile etiqueta="Días flotantes" valor={fmt(e.flotantes_anio)} apoyo={`tomados en ${hoy.slice(0, 4)}`} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            <Panel titulo="Periodos" nota="un periodo por año de servicio cumplido">
              {e.periodos.length === 0 ? (
                <Vacio mensaje={`Todavía no cumple su primer año. El ${fechaLarga(e.proximo_aniversario)} gana ${e.dias_proximo} días.`} />
              ) : (
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
                      <th className="px-5 py-2 font-medium">Año de servicio</th>
                      <th className="px-3 py-2 font-medium">Periodo</th>
                      <th className="px-3 py-2 font-medium text-right">Derecho</th>
                      <th className="px-3 py-2 font-medium text-right">Tomados</th>
                      <th className="px-5 py-2 font-medium text-right">Restantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.periodos.map(p => (
                      <tr key={p.periodo} className="border-b border-[#F5F5F5] last:border-0">
                        <td className="px-5 py-2.5 text-ink-900 font-medium">Año {p.periodo}</td>
                        <td className="px-3 py-2.5 text-ink-500 whitespace-nowrap">{fechaCorta(p.desde)} – {fechaCorta(p.hasta)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{p.derecho}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{fmt(p.tomados)}</td>
                        <td className={`px-5 py-2.5 text-right tabular-nums font-medium ${p.restantes < 0 ? 'text-[#C62828]' : p.restantes > 0 ? 'text-ink-900' : 'text-ink-400'}`}>
                          {fmt(p.restantes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel titulo="Registrar días">
              <RegistrarDias empleadoId={e.id} periodos={e.periodos} />
            </Panel>

            <Panel titulo="Historial" nota={`${movimientos.filter(m => !m.anulado_at).length} registros vigentes`}>
              {movimientos.length === 0 ? (
                <Vacio mensaje="Sin días registrados." />
              ) : (
                <ul className="divide-y divide-[#F5F5F5]">
                  {movimientos.map(m => (
                    <li key={m.id} className={`px-5 py-3 flex flex-col gap-0.5 ${m.anulado_at ? 'opacity-50' : ''}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className={`text-[12.5px] text-ink-900 ${m.anulado_at ? 'line-through' : ''}`}>
                          <span className="font-medium">
                            {fmt(m.dias)} {m.tipo === 'flotante' ? (m.dias === 1 ? 'día flotante' : 'días flotantes') : (m.dias === 1 ? 'día de vacaciones' : 'días de vacaciones')}
                          </span>
                          {m.periodo && <span className="text-ink-500"> · año {m.periodo}</span>}
                          {m.fecha_inicio && (
                            <span className="text-ink-500">
                              {' · '}{fechaCorta(m.fecha_inicio)}{m.fecha_fin && m.fecha_fin !== m.fecha_inicio && ` – ${fechaCorta(m.fecha_fin)}`}
                            </span>
                          )}
                        </p>
                        <span className="flex items-center gap-3">
                          {m.origen === 'registro_rh' && !m.anulado_at && (
                            <a
                              href={`/formato/vacaciones/${m.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11.5px] text-navy font-medium hover:underline"
                            >
                              <Printer size={12} /> Formato
                            </a>
                          )}
                          {!m.anulado_at && <AnularMovimiento id={m.id} />}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-ink-400">
                        {m.origen === 'importado' ? 'Importado del Excel' : `Folio ${m.folio} · registrado ${fechaCorta(m.created_at)}`}
                        {m.anulado_at && ` · anulado ${fechaCorta(m.anulado_at)}`}
                      </p>
                      {m.fechas_texto && (
                        <p className="text-[11.5px] text-ink-500 whitespace-pre-line">{m.fechas_texto}</p>
                      )}
                      {m.observaciones && <p className="text-[11.5px] text-ink-500">{m.observaciones}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel titulo="Datos para el formato y la fase 2">
            <DatosEmpleado
              datos={{
                id: e.id, puesto: e.puesto, area: e.area, numero_empleado: e.numero_empleado,
                email: e.email, jefe_id: e.jefe_id, activo: e.activo,
              }}
              posiblesJefes={(jefes ?? []) as { id: string; nombre: string }[]}
            />
          </Panel>
        </div>
      </div>
    </div>
  )
}
