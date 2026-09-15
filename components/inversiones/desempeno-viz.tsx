/**
 * Visualización del Tablero de Desempeño (I5).
 *
 * Presentacional, sin estado: recibe lo que ya agregó el RPC. No recalcula
 * rankings ni totales — regla 1 de §9.2. Reusa tokens de `viz.tsx` y el
 * formateo de pesos de calendario-viz.
 */

import { Barras, type FilaBarra } from '@/components/viz'
import { fmtPesos, fmtPesosExacto } from '@/components/inversiones/calendario-viz'

export type FilaTablero = {
  universo: string | null
  nivel: string
  orden: number
  gerente_ejecutivo: string | null
  gerente_inversion: string | null
  ejecutivo: string | null
  generacion: string | null
  tipo_colaborador: string | null
  origen: string | null
  ejecutivos: number | null
  inv_vigentes: number | null
  vigente: number | null
  abierto: number | null
  vencido: number | null
  crecimiento_neto: number | null
}

export type FilaRanking = {
  posicion: number | null
  gerente_ejecutivo: string | null
  gerente_inversion: string | null
  ejecutivo: string | null
  produccion_ponderada: number | null
  clientes_nuevos: number | null
  retencion_vencimientos: number | null
  saldo_vigente_corte: number | null
  crecimiento_neto: number | null
  meta_periodo: number | null
  colocacion_para_meta: number | null
  cumplimiento_meta: number | null
  puntaje: number | null
  puntaje_sin_meta: number | null
  puntaje_meta: number | null
  lectura: string | null
}

export type PuntoCumplimiento = {
  mes: string
  meta: number
  colocacion: number
  cumplimiento_pct: number | null
  cumplieron: number
  evaluados: number
}

export type DetalleCumplimiento = {
  gerente_ejecutivo: string | null
  gerente_inversion: string | null
  ejecutivo: string | null
  meta_mensual: number | null
  nueva: number | null
  renovacion: number | null
  incremento: number | null
  colocacion_total: number | null
  cumplimiento_pct: number | null
  cumplio: boolean | null
}

function nombreFila(f: FilaTablero): string {
  if (f.nivel === 'total') return f.universo === 'TOTALES' ? 'Totales' : (f.universo ?? 'Total')
  return f.ejecutivo ?? f.gerente_inversion ?? f.gerente_ejecutivo ?? '—'
}

function nombreRanking(f: FilaRanking, nivel: string): string {
  if (nivel === 'ejecutivo') return f.ejecutivo ?? '—'
  if (nivel === 'gerente_inversion') return f.gerente_inversion ?? '—'
  return f.gerente_ejecutivo ?? '—'
}

/** Tabla del Tablero (por universo) o de Estructura. */
export function TablaResumen({
  filas,
  mostrarUniverso,
}: {
  filas: FilaTablero[]
  mostrarUniverso?: boolean
}) {
  if (filas.length === 0) {
    return <p className="px-5 py-8 text-[13px] text-ink-400 text-center">Sin filas en esta hoja.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-[#ECECEC] text-[10.5px] uppercase tracking-[0.3px] text-ink-400">
            {mostrarUniverso && <th className="px-4 py-2 font-medium">Universo</th>}
            <th className="px-4 py-2 font-medium">Nombre</th>
            <th className="px-4 py-2 font-medium text-right">Vigente</th>
            <th className="px-4 py-2 font-medium text-right">Abierto</th>
            <th className="px-4 py-2 font-medium text-right">Vencido</th>
            <th className="px-4 py-2 font-medium text-right">Crec. neto</th>
            <th className="px-4 py-2 font-medium text-right">Inv.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F5F5F5]">
          {filas.map((f, i) => {
            const esTotal = f.nivel === 'total'
            return (
              <tr
                key={`${f.orden}-${i}`}
                className={esTotal ? 'bg-surface-sidebar' : undefined}
              >
                {mostrarUniverso && (
                  <td className="px-4 py-2 text-[11.5px] text-ink-400 font-mono">
                    {f.universo ?? '—'}
                  </td>
                )}
                <td className={`px-4 py-2 text-[12.5px] ${esTotal ? 'font-semibold text-ink-900' : 'text-ink-900'}`}>
                  {nombreFila(f)}
                </td>
                <td className="px-4 py-2 text-[12.5px] text-ink-900 tabular-nums text-right font-medium">
                  {fmtPesosExacto(f.vigente ?? 0)}
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-500 tabular-nums text-right">
                  {fmtPesos(f.abierto ?? 0)}
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-500 tabular-nums text-right">
                  {fmtPesos(f.vencido ?? 0)}
                </td>
                <td className={`px-4 py-2 text-[12px] tabular-nums text-right font-medium ${
                  (f.crecimiento_neto ?? 0) >= 0 ? 'text-[#1C5CAB]' : 'text-[#D9531F]'
                }`}>
                  {fmtPesos(f.crecimiento_neto ?? 0)}
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-400 tabular-nums text-right">
                  {f.inv_vigentes?.toLocaleString('es-MX') ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Ranking comercial o con meta — columnas según el modo. */
export function TablaRanking({
  filas,
  nivel,
  conMeta,
}: {
  filas: FilaRanking[]
  nivel: string
  conMeta: boolean
}) {
  if (filas.length === 0) {
    return (
      <p className="px-5 py-8 text-[13px] text-ink-400 text-center">
        Sin filas de ranking para este nivel.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="border-b border-[#ECECEC] text-[10.5px] uppercase tracking-[0.3px] text-ink-400">
            <th className="px-4 py-2 font-medium w-10">#</th>
            <th className="px-4 py-2 font-medium">Nombre</th>
            <th className="px-4 py-2 font-medium text-right">Puntaje</th>
            {conMeta && (
              <th className="px-4 py-2 font-medium text-right">Cumpl. meta</th>
            )}
            <th className="px-4 py-2 font-medium text-right">Prod. pond.</th>
            <th className="px-4 py-2 font-medium text-right">Vigente</th>
            <th className="px-4 py-2 font-medium">Lectura</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F5F5F5]">
          {filas.map((f, i) => (
            <tr key={`${f.posicion}-${i}`}>
              <td className="px-4 py-2 text-[12.5px] text-ink-400 tabular-nums font-mono">
                {f.posicion ?? '—'}
              </td>
              <td className="px-4 py-2 text-[12.5px] text-ink-900 font-medium">
                {nombreRanking(f, nivel)}
              </td>
              <td className="px-4 py-2 text-[13px] text-navy tabular-nums text-right font-semibold">
                {f.puntaje != null ? f.puntaje.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '—'}
              </td>
              {conMeta && (
                <td className="px-4 py-2 text-[12px] text-ink-500 tabular-nums text-right">
                  {f.cumplimiento_meta != null
                    ? `${(f.cumplimiento_meta * (f.cumplimiento_meta <= 2 ? 100 : 1)).toFixed(1)}%`
                    : '—'}
                </td>
              )}
              <td className="px-4 py-2 text-[12px] text-ink-500 tabular-nums text-right">
                {fmtPesos(f.produccion_ponderada ?? 0)}
              </td>
              <td className="px-4 py-2 text-[12px] text-ink-500 tabular-nums text-right">
                {fmtPesos(f.saldo_vigente_corte ?? 0)}
              </td>
              <td className="px-4 py-2 text-[11.5px] text-ink-400 max-w-[180px] truncate">
                {f.lectura ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Barras de cumplimiento mensual agregado (meta vs colocación). */
export function SerieCumplimiento({ serie }: { serie: PuntoCumplimiento[] }) {
  if (serie.length === 0) {
    return <p className="px-5 py-8 text-[13px] text-ink-400 text-center">Sin histórico de cumplimiento.</p>
  }

  const filas: FilaBarra[] = serie.map(p => {
    const [a, m] = p.mes.split('-').map(Number)
    const etiqueta = new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString('es-MX', {
      month: 'short', year: '2-digit', timeZone: 'UTC',
    })
    const pct = p.cumplimiento_pct != null
      ? (p.cumplimiento_pct <= 2 ? p.cumplimiento_pct * 100 : p.cumplimiento_pct)
      : 0
    return {
      etiqueta,
      valor: pct,
      apoyo: `${fmtPesos(p.colocacion)} / ${fmtPesos(p.meta)}`,
    }
  })

  const max = Math.max(...filas.map(f => f.valor), 100)

  return (
    <div className="px-2 py-2">
      <Barras filas={filas} max={max} sufijo="%" />
    </div>
  )
}

export function TablaCumplimientoDetalle({ filas }: { filas: DetalleCumplimiento[] }) {
  if (filas.length === 0) {
    return <p className="px-5 py-8 text-[13px] text-ink-400 text-center">Sin detalle del mes.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="border-b border-[#ECECEC] text-[10.5px] uppercase tracking-[0.3px] text-ink-400">
            <th className="px-4 py-2 font-medium">Ejecutivo</th>
            <th className="px-4 py-2 font-medium text-right">Meta</th>
            <th className="px-4 py-2 font-medium text-right">Colocación</th>
            <th className="px-4 py-2 font-medium text-right">%</th>
            <th className="px-4 py-2 font-medium text-center">¿Cumplió?</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F5F5F5]">
          {filas.map((f, i) => {
            const pct = f.cumplimiento_pct != null
              ? (f.cumplimiento_pct <= 2 ? f.cumplimiento_pct * 100 : f.cumplimiento_pct)
              : null
            return (
              <tr key={i}>
                <td className="px-4 py-2 text-[12.5px] text-ink-900">
                  <span className="font-medium">{f.ejecutivo ?? '—'}</span>
                  {f.gerente_inversion && (
                    <span className="block text-[11px] text-ink-400">{f.gerente_inversion}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-[12px] text-ink-500 tabular-nums text-right">
                  {fmtPesos(f.meta_mensual ?? 0)}
                </td>
                <td className="px-4 py-2 text-[12.5px] text-ink-900 tabular-nums text-right font-medium">
                  {fmtPesosExacto(f.colocacion_total ?? 0)}
                </td>
                <td className="px-4 py-2 text-[12px] tabular-nums text-right font-medium text-ink-900">
                  {pct != null ? `${pct.toFixed(1)}%` : '—'}
                </td>
                <td className="px-4 py-2 text-center text-[12px]">
                  {f.cumplio == null ? '—' : f.cumplio ? (
                    <span className="text-[#1C5CAB] font-medium">Sí</span>
                  ) : (
                    <span className="text-[#D9531F] font-medium">No</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
