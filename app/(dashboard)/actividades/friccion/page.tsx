import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import FiltrosActividades, { etiquetaPeriodo } from '@/components/actividades/filtros'
import {
  Tile, Panel, BannerError, Vacio, LeyendaTipos, colorTipo, etiquetaTipo,
  fmtHoras, fmtNum, fmtPct, fmtDuracion,
} from '@/components/actividades/viz'

interface Friccion {
  periodo: string | null
  kpis: {
    horas: number
    horas_relevantes: number
    pct_relevante: number
    pct_friccion: number
    horas_friccion: number
    personas: number
    registros: number
  }
  por_tipo: { tipo: string; horas: number; pct: number; registros: number }[]
  por_motivo: { motivo: string; tipo: string; horas: number; pct: number; registros: number; personas: number }[]
  detalle: {
    fecha: string; nombre: string; gerencia: string | null; direccion: string | null
    actividad: string | null; motivo: string | null; tipo: string
    comentario: string | null; horas: number
  }[]
  detalle_truncado: boolean
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
    puesto?: string; empleado?: string; categoria?: string; tipo?: string
  }
}

export default async function FriccionPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const args = {
    p_periodo:   searchParams.periodo   ?? null,
    p_direccion: searchParams.direccion ?? null,
    p_gerencia:  searchParams.gerencia  ?? null,
    p_puesto:    searchParams.puesto    ?? null,
    p_empleado:  searchParams.empleado  ?? null,
    p_categoria: searchParams.categoria ?? null,
  }

  // Los filtros los sirve act_resumen (es quien conoce el universo del periodo);
  // esta pantalla solo pide sus propios datos.
  const [{ data: dResumen }, { data, error }] = await Promise.all([
    supabase.rpc('act_resumen', args),
    supabase.rpc('act_friccion', { ...args, p_tipo: searchParams.tipo ?? null }),
  ])

  if (error) {
    return (
      <div>
        <Header title="Fricción" subtitle="Dónde se atora el trabajo." />
        <div className="px-5 md:px-9 pb-12"><BannerError mensaje={error.message} /></div>
      </div>
    )
  }

  const f = data as unknown as Friccion
  const base = dResumen as unknown as Resumen

  if (!f.periodo) {
    return (
      <div>
        <Header title="Fricción" subtitle="Dónde se atora el trabajo." />
        <div className="px-5 md:px-9 pb-12">
          <Vacio mensaje="Todavía no hay periodos cargados." />
        </div>
      </div>
    )
  }

  const { kpis } = f
  const maxMotivo = Math.max(...f.por_motivo.map(m => m.horas), 1)
  const tiposPresentes = f.por_tipo.map(t => t.tipo)

  return (
    <div>
      <Header
        title="Fricción"
        subtitle={`${etiquetaPeriodo(f.periodo)} · ${fmtNum(kpis.registros)} notas de ${kpis.personas} personas`}
        action={
          <Link href="/actividades" className="text-[13px] text-navy hover:underline font-medium">
            Ver tablero
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5">
        <FiltrosActividades
          periodos={base?.periodos ?? [f.periodo]}
          opciones={base?.filtros ?? { direcciones: [], gerencias: [], puestos: [], categorias: [], empleados: [] }}
          actual={{
            periodo: f.periodo,
            direccion: searchParams.direccion ?? null,
            gerencia: searchParams.gerencia ?? null,
            puesto: searchParams.puesto ?? null,
            empleado: searchParams.empleado ?? null,
            categoria: searchParams.categoria ?? null,
          }}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile
            etiqueta="Tiempo en fricción"
            valor={fmtPct(kpis.pct_friccion)}
            acento={kpis.pct_friccion >= 15}
            apoyo={`${fmtDuracion(kpis.horas_friccion)} del periodo`}
          />
          <Tile
            etiqueta="Tiempo con nota"
            valor={fmtPct(kpis.pct_relevante)}
            apoyo={`${fmtHoras(kpis.horas_relevantes)} h de ${fmtHoras(kpis.horas)} h`}
          />
          <Tile etiqueta="Personas que reportaron" valor={fmtNum(kpis.personas)} />
          <Tile etiqueta="Notas registradas" valor={fmtNum(kpis.registros)} />
        </div>

        {/* ── Reparto del tiempo con nota ──
            Escala divergente: positivo ↔ contexto ↔ fricción. No son categorías
            independientes sino un sentimiento ordenado, y el color lo refleja. */}
        <Panel titulo="Reparto del tiempo que dejó nota" nota="% de las horas con nota">
          {f.por_tipo.length === 0 ? (
            <Vacio mensaje="Nadie registró notas en este periodo." />
          ) : (
            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="flex h-8 rounded-[4px] overflow-hidden gap-[2px]">
                {f.por_tipo.map(t => (
                  <div
                    key={t.tipo}
                    className="flex items-center justify-center min-w-0 first:rounded-l-[4px] last:rounded-r-[4px]"
                    style={{ width: `${Math.max(t.pct, 3)}%`, backgroundColor: colorTipo(t.tipo) }}
                    title={`${etiquetaTipo(t.tipo)}: ${fmtDuracion(t.horas)} · ${fmtPct(t.pct)}`}
                  >
                    {t.pct >= 12 && (
                      <span className="text-white text-[11.5px] font-medium tabular-nums px-1 truncate">
                        {fmtPct(t.pct, 0)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <LeyendaTipos tipos={tiposPresentes} />
            </div>
          )}
        </Panel>

        {/* ── Motivos ── */}
        <Panel titulo="Por qué" nota="horas con nota, por motivo">
          {f.por_motivo.length === 0 ? (
            <Vacio mensaje="Sin motivos registrados." />
          ) : (
            <ul className="flex flex-col gap-2.5 px-5 py-4">
              {f.por_motivo.map(m => (
                <li key={m.motivo} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-baseline">
                  <p className="text-[12.5px] text-ink-900 truncate flex items-center gap-2" title={m.motivo}>
                    <span
                      className="w-2 h-2 rounded-[2px] shrink-0"
                      style={{ backgroundColor: colorTipo(m.tipo) }}
                    />
                    {m.motivo}
                  </p>
                  <p className="text-[12.5px] text-ink-900 tabular-nums font-medium whitespace-nowrap">
                    {fmtHoras(m.horas)} h
                    <span className="text-ink-400 font-normal"> · {m.personas} pers.</span>
                  </p>
                  <div className="col-span-2 h-[7px] bg-[#F5F5F5] rounded-[4px] overflow-hidden">
                    <div
                      className="h-full rounded-[4px]"
                      style={{
                        width: `${Math.max((m.horas / maxMotivo) * 100, 0.6)}%`,
                        backgroundColor: colorTipo(m.tipo),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── Comentarios ──
            El único texto del dataset escrito por una persona y no elegido de
            una lista. Es lo que un número nunca va a decir. */}
        <Panel
          titulo="Lo que escribieron"
          nota={f.detalle_truncado ? 'primeras 300 notas' : `${f.detalle.length} notas`}
        >
          {f.detalle.length === 0 ? (
            <Vacio mensaje="Sin notas para este filtro." />
          ) : (
            <ul className="divide-y divide-[#F5F5F5]">
              {f.detalle.map((d, i) => (
                <li key={i} className="px-5 py-3 flex gap-3">
                  <span
                    className="w-[3px] rounded-full shrink-0 mt-0.5"
                    style={{ backgroundColor: colorTipo(d.tipo) }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-ink-900">
                      {d.comentario || <span className="text-ink-400">— sin comentario —</span>}
                    </p>
                    <p className="text-[11.5px] text-ink-400 mt-0.5 truncate">
                      <span className="font-medium text-ink-500">{etiquetaTipo(d.tipo)}</span>
                      {d.motivo && <> · {d.motivo}</>}
                      {' · '}{d.nombre}
                      {d.gerencia && <> · {d.gerencia}</>}
                      {' · '}{fmtDuracion(d.horas)}
                      {' · '}{new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-MX',
                        { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
