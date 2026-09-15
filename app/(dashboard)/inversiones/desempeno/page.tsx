import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Download, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio } from '@/components/viz'
import { fmtPesos, fmtPesosExacto } from '@/components/inversiones/calendario-viz'
import {
  TablaResumen,
  TablaRanking,
  SerieCumplimiento,
  TablaCumplimientoDetalle,
  type FilaTablero,
  type FilaRanking,
  type PuntoCumplimiento,
  type DetalleCumplimiento,
} from '@/components/inversiones/desempeno-viz'
import { etiquetaPeriodo, fechaLarga } from '@/lib/inversiones/periodo'

export const dynamic = 'force-dynamic'

type Vista = 'tablero' | 'estructura' | 'ranking' | 'cumplimiento'
type Nivel = 'gerente_ejecutivo' | 'gerente_inversion' | 'ejecutivo'

interface Resumen {
  corte: string | null
  cortes: { corte: string; periodo_inicio: string; periodo_fin: string }[]
  carga: {
    id: string
    nombre_archivo: string
    periodo_inicio: string
    periodo_fin: string
    created_at: string
    avisos: string[] | null
    hojas_degradadas: string[] | null
  } | null
  vigente: number
  abierto: number
  vencido: number
  crecimiento_neto: number
  inv_vigentes: number
  ejecutivos: number
  movimientos: number
  ranking: number
  cumplimiento: number
  degradadas: string[]
}

interface FilasTablero {
  corte: string | null
  hoja: string
  filas: FilaTablero[]
}

interface FilasRanking {
  corte: string | null
  con_meta: boolean
  nivel: string
  degradado: boolean
  filas: FilaRanking[]
}

interface Cumplimiento {
  corte: string | null
  serie: PuntoCumplimiento[]
  ultimo_mes: string | null
  detalle: DetalleCumplimiento[]
}

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'tablero', label: 'Tablero' },
  { id: 'estructura', label: 'Estructura' },
  { id: 'ranking', label: 'Rankings' },
  { id: 'cumplimiento', label: 'Cumplimiento' },
]

const NIVELES: { id: Nivel; label: string }[] = [
  { id: 'gerente_ejecutivo', label: 'Gerente ejecutivo' },
  { id: 'gerente_inversion', label: 'Gerente inversión' },
  { id: 'ejecutivo', label: 'Ejecutivo' },
]

function qs(base: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(base)) {
    if (v) p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

/**
 * Puerta de Dirección: Tablero, Estructura, Rankings y Cumplimiento tal como
 * el Excel los calculó. Cero recomputo — si una cifra difiere, el bug está en
 * el parseo (I4), no aquí.
 */
export default async function DesempenoPage({
  searchParams,
}: {
  searchParams: {
    corte?: string
    vista?: string
    nivel?: string
    meta?: string
  }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_desempeno')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  if (!(p?.rol === 'admin' || p?.acceso_inversiones_desempeno === true)) {
    redirect('/inversiones')
  }

  const corte = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.corte ?? '')
    ? searchParams.corte!
    : null

  const vista: Vista = VISTAS.some(v => v.id === searchParams.vista)
    ? (searchParams.vista as Vista)
    : 'tablero'

  const nivel: Nivel = NIVELES.some(n => n.id === searchParams.nivel)
    ? (searchParams.nivel as Nivel)
    : 'gerente_ejecutivo'

  const conMeta = searchParams.meta === '1'

  const resumenRes = await supabase.rpc('inv_resumen_tablero', { p_corte: corte })
  const resumen = resumenRes.data as unknown as Resumen | null

  if (!resumen || !resumen.carga) {
    return (
      <div>
        <Header
          title="Desempeño"
          subtitle="Tablero ejecutivo de cartera de inversiones, por corte."
          action={
            <Link href="/inversiones" className="text-[13px] text-navy hover:underline font-medium">
              Volver
            </Link>
          }
        />
        <div className="px-5 md:px-9 pb-12">
          <Vacio mensaje="Todavía no hay ningún tablero procesado. En cuanto se cargue uno, aquí aparece el corte completo." />
        </div>
      </div>
    )
  }

  const avisos = [
    ...(resumen.carga.avisos ?? []),
    ...(resumen.degradadas?.length
      ? [`Sin datos suficientes en: ${resumen.degradadas.join(', ')}`]
      : []),
  ]

  // Carga perezosa: solo el RPC de la vista activa.
  let bloque: ReactNode = null

  if (vista === 'tablero' || vista === 'estructura') {
    const hoja = vista === 'tablero' ? 'Tablero' : 'Tablero_Estructura'
    const { data } = await supabase.rpc('inv_tablero_filas', {
      p_corte: corte,
      p_hoja: hoja,
    })
    const pack = data as unknown as FilasTablero | null
    const filas = pack?.filas ?? []
    bloque = (
      <Panel
        titulo={vista === 'tablero' ? 'Tablero por universo' : 'Estructura comercial'}
        nota={`${filas.length} filas · tal como el archivo`}
      >
        <TablaResumen filas={filas} mostrarUniverso={vista === 'tablero'} />
      </Panel>
    )
  } else if (vista === 'ranking') {
    const { data } = await supabase.rpc('inv_ranking_filas', {
      p_corte: corte,
      p_con_meta: conMeta,
      p_nivel: nivel,
    })
    const pack = data as unknown as FilasRanking | null
    bloque = (
      <Panel
        titulo={conMeta ? 'Ranking con meta' : 'Ranking comercial'}
        nota={pack?.degradado
          ? 'hoja degradada en este corte'
          : `${pack?.filas.length ?? 0} posiciones`}
      >
        {pack?.degradado ? (
          <Vacio mensaje="Este corte no trae datos para rankear (periodo corto o SIN_DATOS en el Excel). Es normal; no es un fallo de la plataforma." />
        ) : (
          <TablaRanking
            filas={pack?.filas ?? []}
            nivel={nivel}
            conMeta={conMeta}
          />
        )}
      </Panel>
    )
  } else {
    const { data } = await supabase.rpc('inv_cumplimiento_serie', { p_corte: corte })
    const pack = data as unknown as Cumplimiento | null
    const mesLabel = pack?.ultimo_mes
      ? fechaLarga(pack.ultimo_mes).replace(/^1 de /, '')
      : null
    bloque = (
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Panel titulo="Cumplimiento mensual agregado" nota="histórico que trae el archivo">
          <SerieCumplimiento serie={pack?.serie ?? []} />
        </Panel>
        <Panel
          titulo="Detalle del último mes"
          nota={mesLabel ?? undefined}
        >
          <TablaCumplimientoDetalle filas={pack?.detalle ?? []} />
        </Panel>
      </div>
    )
  }

  const baseQs = {
    corte: resumen.corte ?? undefined,
    vista,
    nivel: vista === 'ranking' ? nivel : undefined,
    meta: vista === 'ranking' && conMeta ? '1' : undefined,
  }

  return (
    <div>
      <Header
        title="Desempeño"
        subtitle={etiquetaPeriodo(
          'tablero',
          resumen.carga.periodo_inicio,
          resumen.carga.periodo_fin,
        )}
        action={
          <Link href="/inversiones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        {resumen.cortes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {resumen.cortes.map(c => {
              const activo = c.corte === resumen.corte
              return (
                <Link
                  key={c.corte}
                  href={`/inversiones/desempeno${qs({ ...baseQs, corte: c.corte })}`}
                  className={`text-[12px] font-medium rounded px-3 py-[5px] border transition-colors ${
                    activo
                      ? 'border-orange bg-orange/10 text-orange-dark'
                      : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
                  }`}
                >
                  {etiquetaPeriodo('tablero', c.periodo_inicio, c.periodo_fin)}
                </Link>
              )
            })}
          </div>
        )}

        {avisos.length > 0 && (
          <ul className="border border-[#FFE0B2] bg-[#FFF8E1] rounded-md px-4 py-3 flex flex-col gap-1">
            {avisos.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#8A6100]">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile
            etiqueta="Vigente"
            valor={fmtPesos(resumen.vigente)}
            apoyo={`${resumen.inv_vigentes.toLocaleString('es-MX')} inversiones`}
            acento
          />
          <Tile
            etiqueta="Abierto en el periodo"
            valor={fmtPesos(resumen.abierto)}
            apoyo={`${resumen.ejecutivos} ejecutivos`}
          />
          <Tile
            etiqueta="Vencido en el periodo"
            valor={fmtPesos(resumen.vencido)}
          />
          <Tile
            etiqueta="Crecimiento neto"
            valor={fmtPesos(resumen.crecimiento_neto)}
            apoyo={`${resumen.movimientos.toLocaleString('es-MX')} movimientos`}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {VISTAS.map(v => {
            const activo = v.id === vista
            return (
              <Link
                key={v.id}
                href={`/inversiones/desempeno${qs({
                  corte: resumen.corte ?? undefined,
                  vista: v.id,
                  nivel: v.id === 'ranking' ? nivel : undefined,
                  meta: v.id === 'ranking' && conMeta ? '1' : undefined,
                })}`}
                className={`text-[12px] font-medium rounded px-3 py-[5px] border transition-colors ${
                  activo
                    ? 'border-navy bg-navy/5 text-navy'
                    : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
                }`}
              >
                {v.label}
              </Link>
            )
          })}
        </div>

        {vista === 'ranking' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {NIVELES.map(n => {
                const activo = n.id === nivel
                return (
                  <Link
                    key={n.id}
                    href={`/inversiones/desempeno${qs({
                      corte: resumen.corte ?? undefined,
                      vista: 'ranking',
                      nivel: n.id,
                      meta: conMeta ? '1' : undefined,
                    })}`}
                    className={`text-[11.5px] font-medium rounded px-2.5 py-[4px] border transition-colors ${
                      activo
                        ? 'border-orange bg-orange/10 text-orange-dark'
                        : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
                    }`}
                  >
                    {n.label}
                  </Link>
                )
              })}
            </div>
            <Link
              href={`/inversiones/desempeno${qs({
                corte: resumen.corte ?? undefined,
                vista: 'ranking',
                nivel,
                meta: conMeta ? undefined : '1',
              })}`}
              className={`text-[11.5px] font-medium rounded px-2.5 py-[4px] border transition-colors ${
                conMeta
                  ? 'border-orange bg-orange/10 text-orange-dark'
                  : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
              }`}
            >
              {conMeta ? 'Con meta' : 'Sin meta'}
            </Link>
          </div>
        )}

        {bloque}

        <p className="text-[11.5px] text-ink-400">
          Fuente:{' '}
          <span className="font-mono">{resumen.carga.nombre_archivo}</span>
          {' · '}
          vigente {fmtPesosExacto(resumen.vigente)}
          {' · '}
          cargado el{' '}
          {new Date(resumen.carga.created_at).toLocaleDateString('es-MX', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
          })}
          .{' '}
          <a
            href={`/api/inversiones/descargar/${resumen.carga.id}`}
            className="text-navy hover:underline font-medium"
          >
            <Download size={11} className="inline mb-0.5" /> Descargar el archivo original
          </a>
        </p>
      </div>
    </div>
  )
}
