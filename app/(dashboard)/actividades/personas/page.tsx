import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import FiltrosActividades, { etiquetaPeriodo } from '@/components/actividades/filtros'
import {
  Barras, Panel, BannerError, Vacio,
  fmtHoras, fmtNum, fmtPct, fmtDuracion,
} from '@/components/actividades/viz'

interface Detalle {
  periodo: string | null
  periodo_anterior: string | null
  horas_visibles: number
  actividades: {
    actividad: string; categoria: string | null; horas: number; pct: number
    colaboradores: number; gerencias: number; registros: number
  }[]
  personas: {
    no_empleado: string; nombre: string; puesto: string | null
    gerencia: string | null; direccion: string | null
    horas: number; pct: number; registros: number; actividades: number
    horas_anterior: number | null; crecimiento_pct: number | null
    pct_friccion: number
  }[]
}

interface Resumen {
  periodo: string | null
  periodos: string[]
  filtros: {
    direcciones: string[]; gerencias: string[]; puestos: string[]
    categorias: string[]; empleados: { no_empleado: string; nombre: string }[]
  }
}

interface PageProps {
  searchParams: {
    periodo?: string; direccion?: string; gerencia?: string
    puesto?: string; empleado?: string; categoria?: string; ver?: string
  }
}

/** El tablero original fijaba Top 5. Aquí el corte es de la pantalla y se puede abrir. */
const TOP_POR_DEFECTO = 10

export default async function PersonasPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const args = {
    p_periodo:   searchParams.periodo   ?? null,
    p_direccion: searchParams.direccion ?? null,
    p_gerencia:  searchParams.gerencia  ?? null,
    p_puesto:    searchParams.puesto    ?? null,
    p_empleado:  searchParams.empleado  ?? null,
    p_categoria: searchParams.categoria ?? null,
  }

  const [{ data: dResumen }, { data, error }] = await Promise.all([
    supabase.rpc('act_resumen', args),
    supabase.rpc('act_detalle', args),
  ])

  if (error) {
    return (
      <div>
        <Header title="Personas y actividades" subtitle="Quién dedica su tiempo a qué." />
        <div className="px-5 md:px-9 pb-12"><BannerError mensaje={error.message} /></div>
      </div>
    )
  }

  const d = data as unknown as Detalle
  const base = dResumen as unknown as Resumen

  if (!d.periodo) {
    return (
      <div>
        <Header title="Personas y actividades" subtitle="Quién dedica su tiempo a qué." />
        <div className="px-5 md:px-9 pb-12">
          <Vacio mensaje="Todavía no hay periodos cargados." />
        </div>
      </div>
    )
  }

  const verTodas = searchParams.ver === 'todas'
  const actividades = verTodas ? d.actividades : d.actividades.slice(0, TOP_POR_DEFECTO)
  const paramsRestantes = new URLSearchParams(
    Object.entries(searchParams).filter(([k, v]) => k !== 'ver' && v) as [string, string][],
  )

  return (
    <div>
      <Header
        title="Personas y actividades"
        subtitle={`${etiquetaPeriodo(d.periodo)} · ${d.personas.length} personas · ${d.actividades.length} actividades`}
        action={
          <Link href="/actividades" className="text-[13px] text-navy hover:underline font-medium">
            Ver tablero
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5">
        <FiltrosActividades
          periodos={base?.periodos ?? [d.periodo]}
          opciones={base?.filtros ?? { direcciones: [], gerencias: [], puestos: [], categorias: [], empleados: [] }}
          actual={{
            periodo: d.periodo,
            direccion: searchParams.direccion ?? null,
            gerencia: searchParams.gerencia ?? null,
            puesto: searchParams.puesto ?? null,
            empleado: searchParams.empleado ?? null,
            categoria: searchParams.categoria ?? null,
          }}
        />

        <Panel
          titulo="En qué se va el tiempo"
          nota={verTodas
            ? `${d.actividades.length} actividades`
            : `las ${Math.min(TOP_POR_DEFECTO, d.actividades.length)} más pesadas de ${d.actividades.length}`}
        >
          <Barras
            filas={actividades.map(a => ({
              etiqueta: a.actividad,
              valor: a.horas,
              pct: a.pct,
              apoyo: `${a.colaboradores} personas · ${a.gerencias} gerencias · ${a.registros} registros`,
            }))}
          />
          {d.actividades.length > TOP_POR_DEFECTO && (
            <div className="px-5 pb-4">
              <Link
                href={`?${paramsRestantes.toString()}${verTodas ? '' : `${paramsRestantes.toString() ? '&' : ''}ver=todas`}`}
                className="text-[12.5px] text-navy hover:underline font-medium"
              >
                {verTodas ? '← Ver solo las más pesadas' : `Ver las ${d.actividades.length} actividades →`}
              </Link>
            </div>
          )}
        </Panel>

        {/* ── Personas ──
            Una tabla, no una gráfica: con 30 filas y cinco medidas por fila, un
            gráfico de barras obligaría a leer cinco gráficos. Y ordenar por
            horas ya cuenta la historia sin pintar nada. */}
        <Panel titulo="Por persona" nota="ordenado por horas registradas">
          {d.personas.length === 0 ? (
            <Vacio mensaje="Sin personas para este filtro." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] min-w-[680px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-400 font-medium border-b border-[#F0F0F0]">
                    <th className="text-left  px-5 py-2 font-medium">Persona</th>
                    <th className="text-right px-3 py-2 font-medium">Horas</th>
                    <th className="text-right px-3 py-2 font-medium">% del total</th>
                    <th className="text-right px-3 py-2 font-medium">vs anterior</th>
                    <th className="text-right px-3 py-2 font-medium">Actividades</th>
                    <th className="text-right px-5 py-2 font-medium">Fricción</th>
                  </tr>
                </thead>
                <tbody>
                  {d.personas.map(p => (
                    <tr key={p.no_empleado} className="border-b border-[#F5F5F5] hover:bg-surface-hover transition-colors">
                      <td className="px-5 py-2">
                        <p className="text-ink-900 font-medium truncate max-w-[240px]" title={p.nombre}>
                          {p.nombre}
                        </p>
                        <p className="text-[11.5px] text-ink-400 truncate max-w-[240px]">
                          {[p.puesto, p.gerencia].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right text-ink-900 tabular-nums" title={fmtDuracion(p.horas)}>
                        {fmtHoras(p.horas)}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-500 tabular-nums">{fmtPct(p.pct)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <Variacion pct={p.crecimiento_pct} />
                      </td>
                      <td className="px-3 py-2 text-right text-ink-500 tabular-nums">{fmtNum(p.actividades)}</td>
                      <td className="px-5 py-2 text-right tabular-nums">
                        {p.pct_friccion > 0 ? (
                          <span className={p.pct_friccion >= 25 ? 'text-[#D9531F] font-medium' : 'text-ink-500'}>
                            {fmtPct(p.pct_friccion, 0)}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

/** "—" cuando no hay periodo anterior: es honesto y no se confunde con 0%. */
function Variacion({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-ink-400">—</span>
  if (Math.abs(pct) < 0.05) return <span className="text-ink-500">0%</span>
  return (
    <span className={pct > 0 ? 'text-[#1C5CAB]' : 'text-[#D9531F]'}>
      {pct > 0 ? '↑' : '↓'} {fmtPct(Math.abs(pct), 0)}
    </span>
  )
}
