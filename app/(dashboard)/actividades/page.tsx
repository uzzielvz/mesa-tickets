import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import FiltrosActividades, { etiquetaPeriodo } from '@/components/actividades/filtros'
import {
  Tile, Barras, Heatmap, Panel, BannerError, Vacio,
  fmtHoras, fmtNum, fmtPct, fmtDuracion,
} from '@/components/actividades/viz'

// ── Contrato del RPC act_resumen ─────────────────────────────────────────────
interface Resumen {
  periodo: string | null
  periodo_anterior: string | null
  periodos: string[]
  filtros: {
    direcciones: string[]
    gerencias: string[]
    puestos: string[]
    categorias: string[]
    empleados: { no_empleado: string; nombre: string }[]
  }
  kpis: {
    horas: number
    registros: number
    colaboradores: number
    gerencias: number
    crecimiento_pct: number | null
    horas_anterior: number | null
    pct_relevante: number
    pct_friccion: number
    pct_seleccionado: number
  }
  por_direccion: { direccion: string; horas: number; pct: number; colaboradores: number; gerencias: number }[]
  por_gerencia: { gerencia: string; direccion: string; horas: number; pct: number; colaboradores: number }[]
  por_categoria: { categoria: string; horas: number; pct: number }[]
  gerencia_categoria: { gerencia: string; categoria: string; horas: number }[]
  por_nivel: { nivel: string; horas: number; pct: number; colaboradores: number }[]
}

interface PageProps {
  searchParams: {
    periodo?: string; direccion?: string; gerencia?: string
    puesto?: string; empleado?: string; categoria?: string
  }
}

export default async function ActividadesPage({ searchParams }: PageProps) {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('act_resumen', {
    p_periodo:   searchParams.periodo   ?? null,
    p_direccion: searchParams.direccion ?? null,
    p_gerencia:  searchParams.gerencia  ?? null,
    p_puesto:    searchParams.puesto    ?? null,
    p_empleado:  searchParams.empleado  ?? null,
    p_categoria: searchParams.categoria ?? null,
  })

  if (error) {
    return (
      <div>
        <Header title="Actividades" subtitle="Tablero directivo de uso del tiempo." />
        <div className="px-5 md:px-9 pb-12"><BannerError mensaje={error.message} /></div>
      </div>
    )
  }

  const r = data as unknown as Resumen

  if (!r.periodo) return <SinDatos />

  const { kpis } = r
  const filtrado = kpis.pct_seleccionado < 99.95

  // El heatmap cruza gerencias contra categorías. Las categorías se ordenan por
  // peso global (no alfabéticamente) para que la columna más pesada quede a la
  // izquierda y el patrón se lea sin recorrer la tabla entera.
  const columnas = r.por_categoria.map(c => c.categoria)
  const filasHeat = r.por_gerencia.map(g => g.gerencia)
  const valores = new Map<string, Map<string, number>>()
  for (const celda of r.gerencia_categoria) {
    if (!valores.has(celda.gerencia)) valores.set(celda.gerencia, new Map())
    valores.get(celda.gerencia)!.set(celda.categoria, celda.horas)
  }

  return (
    <div>
      <Header
        title="Actividades"
        subtitle={`${etiquetaPeriodo(r.periodo)} · ${fmtNum(kpis.registros)} registros`}
        action={
          <Link href="/actividades/cargar" className="text-[13px] text-navy hover:underline font-medium">
            Cargar periodo
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5">
        <FiltrosActividades
          periodos={r.periodos}
          opciones={r.filtros}
          actual={{
            periodo: r.periodo,
            direccion: searchParams.direccion ?? null,
            gerencia: searchParams.gerencia ?? null,
            puesto: searchParams.puesto ?? null,
            empleado: searchParams.empleado ?? null,
            categoria: searchParams.categoria ?? null,
          }}
        />

        {/* Cuánto del periodo estás viendo. Va aquí y no como tarjeta: describe
            el filtro, no al negocio. */}
        {filtrado && (
          <p className="text-[12px] text-ink-500 -mt-2">
            Viendo <span className="font-medium text-ink-900">{fmtPct(kpis.pct_seleccionado)}</span> de
            las horas registradas en {etiquetaPeriodo(r.periodo)}.
          </p>
        )}

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <Tile
            etiqueta="Horas registradas"
            valor={fmtHoras(kpis.horas)}
            unidad="h"
            delta={kpis.crecimiento_pct}
            apoyo={r.periodo_anterior
              ? `${etiquetaPeriodo(r.periodo_anterior)}: ${fmtHoras(kpis.horas_anterior ?? 0)} h`
              : undefined}
          />
          <Tile
            etiqueta="Colaboradores"
            valor={fmtNum(kpis.colaboradores)}
            apoyo={kpis.colaboradores > 0
              ? `${fmtDuracion(kpis.horas / kpis.colaboradores)} por persona`
              : undefined}
          />
          <Tile
            etiqueta="Gerencias"
            valor={fmtNum(kpis.gerencias)}
            apoyo={`${r.por_direccion.length} direcciones`}
          />
          <Tile
            etiqueta="Tiempo relevante"
            valor={fmtPct(kpis.pct_relevante)}
            apoyo="del tiempo dejó una nota"
          />
          <Tile
            etiqueta="Tiempo en fricción"
            valor={fmtPct(kpis.pct_friccion)}
            acento={kpis.pct_friccion >= 15}
            apoyo={`≈ ${fmtDuracion(kpis.horas * kpis.pct_friccion / 100)}`}
          />
        </div>

        {/* ── Dónde se va el tiempo ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel titulo="Por dirección" nota="% del tiempo visible">
            <Barras
              filas={r.por_direccion.map(d => ({
                etiqueta: d.direccion,
                valor: d.horas,
                pct: d.pct,
                apoyo: `${d.colaboradores} colaboradores · ${d.gerencias} gerencias`,
              }))}
            />
          </Panel>

          <Panel titulo="Por gerencia" nota="% del tiempo visible">
            <Barras
              filas={r.por_gerencia.map(g => ({
                etiqueta: g.gerencia,
                valor: g.horas,
                pct: g.pct,
                apoyo: `${g.direccion} · ${g.colaboradores} colaboradores`,
              }))}
            />
          </Panel>
        </div>

        {/* ── En qué tipo de trabajo ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel titulo="Por categoría de trabajo" nota="% del tiempo visible">
            <Barras
              filas={r.por_categoria.map(c => ({
                etiqueta: capitalizar(c.categoria),
                valor: c.horas,
                pct: c.pct,
              }))}
            />
          </Panel>

          <Panel titulo="Por nivel jerárquico" nota="% del tiempo visible">
            {r.por_nivel.length === 0 ? (
              <Vacio mensaje="Sin nivel jerárquico en los registros." />
            ) : (
              <Barras
                filas={r.por_nivel.map(n => ({
                  etiqueta: capitalizar(n.nivel ?? 'Sin nivel'),
                  valor: n.horas,
                  pct: n.pct,
                  apoyo: `${n.colaboradores} colaboradores`,
                }))}
              />
            )}
          </Panel>
        </div>

        {/* ── El cruce ── */}
        <Panel
          titulo="Mezcla de trabajo por gerencia"
          nota="% del tiempo de cada gerencia · pasa el cursor para el detalle"
        >
          <Heatmap
            filas={filasHeat}
            columnas={columnas}
            valores={valores}
            tituloFila="Gerencia"
          />
        </Panel>
      </div>
    </div>
  )
}

/** "SUPERVISION Y LIDERAZGO" → "Supervisión y liderazgo" no se puede sin diccionario;
 *  al menos se baja el grito de las mayúsculas sostenidas. */
function capitalizar(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function SinDatos() {
  return (
    <div>
      <Header title="Actividades" subtitle="Tablero directivo de uso del tiempo." />
      <div className="px-5 md:px-9 pb-12">
        <div className="border border-[#ECECEC] rounded-md p-8 bg-white max-w-2xl">
          <p className="text-[13px] text-ink-900 font-medium">Todavía no hay periodos cargados</p>
          <p className="text-[12.5px] text-ink-500 mt-1">
            Sube el Excel de actividades para ver en qué se va el tiempo del equipo.
          </p>
          <Link
            href="/actividades/cargar"
            className="inline-block mt-4 bg-navy text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-navy/90 transition-colors"
          >
            Cargar Excel
          </Link>
        </div>
      </div>
    </div>
  )
}
