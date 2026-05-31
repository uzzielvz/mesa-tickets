import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import DashboardFilters from '@/components/cartera/dashboard-filters'

// ── Tipos del contrato de los RPCs ────────────────────────────────────────────
type CarteraTotales = {
  creditos: number
  cartera_total: number
  creditos_en_mora: number
  cartera_en_mora: number
  pct_mora: number
}

type CarteraBucket = {
  bucket: string
  label: string
  dias_min: number
  dias_max: number | null
  creditos: number
  saldo: number
  pct_saldo: number
}

type CarteraIndicadores = {
  pct_par_30: number
  pct_par_90: number
}

type CarteraResumen = {
  fecha_corte: string
  filtros_aplicados: {
    coordinacion: string | null
    codigo_recuperador: string | null
    ciclo: string | null
  }
  totales: CarteraTotales
  par: CarteraBucket[]
  indicadores: CarteraIndicadores
}

type CarteraFiltros = {
  fecha_corte: string
  coordinaciones: string[]
  recuperadores: { codigo: string; nombre: string | null }[]
  ciclos: string[]
}

// ── Helpers de formato ────────────────────────────────────────────────────────
const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)

const fmtNumero = (n: number) =>
  new Intl.NumberFormat('es-MX').format(n)

const fmtPct = (n: number) => `${n.toFixed(2)}%`

// ── Página ────────────────────────────────────────────────────────────────────
interface PageProps {
  searchParams: {
    fecha?: string
    coordinacion?: string
    recuperador?: string
    ciclo?: string
  }
}

export default async function CarteraPage({ searchParams }: PageProps) {
  const supabase = createClient()

  // 1. Fechas de corte disponibles (uploads procesados).
  const { data: uploads } = await supabase
    .from('cartera_uploads')
    .select('fecha_corte')
    .eq('estado', 'procesado')
    .order('fecha_corte', { ascending: false })

  const fechas = Array.from(new Set((uploads ?? []).map(u => u.fecha_corte as string)))

  if (fechas.length === 0) {
    return (
      <div>
        <Header
          title="Cartera Individual"
          subtitle="Snapshot ejecutivo de cartera y distribución PAR."
        />
        <div className="px-5 md:px-9 pb-12">
          <EmptyState />
        </div>
      </div>
    )
  }

  const fechaActual = searchParams.fecha && fechas.includes(searchParams.fecha)
    ? searchParams.fecha
    : fechas[0]

  const coordinacionActual = searchParams.coordinacion?.trim() || null
  const recuperadorActual  = searchParams.recuperador?.trim() || null
  const cicloActual        = searchParams.ciclo?.trim() || null

  // 2. Catálogos para los dropdowns + resumen, en paralelo.
  const [{ data: filtrosData, error: filtrosErr }, { data: resumenData, error: resumenErr }] =
    await Promise.all([
      supabase.rpc('cartera_filtros', { p_fecha_corte: fechaActual }),
      supabase.rpc('cartera_resumen', {
        p_fecha_corte: fechaActual,
        p_coordinacion: coordinacionActual,
        p_codigo_recuperador: recuperadorActual,
        p_ciclo: cicloActual,
      }),
    ])

  if (filtrosErr || resumenErr) {
    return (
      <div>
        <Header title="Cartera Individual" subtitle={`Corte ${fechaActual}`} />
        <div className="px-5 md:px-9 pb-12">
          <ErrorBanner mensaje={filtrosErr?.message || resumenErr?.message || 'Error desconocido'} />
        </div>
      </div>
    )
  }

  const filtros = filtrosData as unknown as CarteraFiltros
  const resumen = resumenData as unknown as CarteraResumen

  const hayFiltro = !!(coordinacionActual || recuperadorActual || cicloActual)

  return (
    <div>
      <Header
        title="Cartera Individual"
        subtitle={`Corte ${fechaActual}${hayFiltro ? ' · filtrado' : ''}`}
        action={
          <Link
            href="/cartera/cargar"
            className="text-[13px] text-navy hover:underline font-medium"
          >
            Cargar reporte
          </Link>
        }
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <DashboardFilters
          fechas={fechas}
          coordinaciones={filtros.coordinaciones ?? []}
          recuperadores={filtros.recuperadores ?? []}
          ciclos={filtros.ciclos ?? []}
          fechaActual={fechaActual}
          coordinacionActual={coordinacionActual}
          recuperadorActual={recuperadorActual}
          cicloActual={cicloActual}
        />

        {resumen.totales.creditos === 0 ? (
          <EmptyResultado />
        ) : (
          <>
            <SeccionTotales totales={resumen.totales} indicadores={resumen.indicadores} />
            <SeccionPAR par={resumen.par ?? []} carteraTotal={resumen.totales.cartera_total} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes (server, presentacionales) ────────────────────────────────

function SeccionTotales({
  totales,
  indicadores,
}: {
  totales: CarteraTotales
  indicadores: CarteraIndicadores
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <Metric label="Cartera total"      value={fmtMoneda(totales.cartera_total)} hint={`${fmtNumero(totales.creditos)} créditos`} />
      <Metric label="Cartera en mora"    value={fmtMoneda(totales.cartera_en_mora)} hint={`${fmtNumero(totales.creditos_en_mora)} créditos`} />
      <Metric label="% Mora"             value={fmtPct(totales.pct_mora)} hint="Saldo en mora / cartera total" tone="warn" />
      <Metric label="PAR > 30"           value={fmtPct(indicadores.pct_par_30)} hint="Saldo con mora ≥ 31 días" tone="warn" />
      <Metric label="PAR > 90"           value={fmtPct(indicadores.pct_par_90)} hint="Saldo con mora ≥ 91 días" tone="alert" />
      <Metric label="Saldo promedio"     value={fmtMoneda(totales.creditos > 0 ? totales.cartera_total / totales.creditos : 0)} hint="Cartera total / créditos" />
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warn' | 'alert'
}) {
  const valueColor =
    tone === 'alert' ? 'text-[#C62828]' :
    tone === 'warn'  ? 'text-[#E65100]' :
    'text-navy'

  return (
    <div className="border border-[#ECECEC] rounded-md p-4 bg-white flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{label}</p>
      <p className={`text-[20px] font-semibold tracking-[-0.4px] ${valueColor}`}>{value}</p>
      {hint && <p className="text-[11.5px] text-ink-400">{hint}</p>}
    </div>
  )
}

function SeccionPAR({ par, carteraTotal }: { par: CarteraBucket[]; carteraTotal: number }) {
  const maxPct = Math.max(0, ...par.map(p => p.pct_saldo))

  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
          Distribución PAR
        </p>
        <p className="text-[11.5px] text-ink-400">
          Total: {fmtMoneda(carteraTotal)}
        </p>
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
            <th className="text-left  px-5 py-2.5 font-medium">Bucket</th>
            <th className="text-right px-3 py-2.5 font-medium">Créditos</th>
            <th className="text-right px-3 py-2.5 font-medium">Saldo</th>
            <th className="text-right px-5 py-2.5 font-medium w-[35%]">% del total</th>
          </tr>
        </thead>
        <tbody>
          {par.map((b, i) => (
            <tr
              key={b.bucket}
              className={i < par.length - 1 ? 'border-t border-[#F5F5F5]' : 'border-t border-[#F5F5F5]'}
            >
              <td className="px-5 py-2.5">
                <span className="text-ink-900 font-medium">{b.label}</span>
                <span className="text-ink-400 ml-2 text-[11.5px]">
                  {b.dias_max == null ? `${b.dias_min}+ d` : b.dias_min === b.dias_max ? `${b.dias_min} d` : `${b.dias_min}–${b.dias_max} d`}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right text-ink-900 tabular-nums">{fmtNumero(b.creditos)}</td>
              <td className="px-3 py-2.5 text-right text-ink-900 tabular-nums">{fmtMoneda(b.saldo)}</td>
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-2 justify-end">
                  <div className="flex-1 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden max-w-[160px]">
                    <div
                      className={b.dias_min >= 31 ? 'h-full bg-[#E65100]' : 'h-full bg-navy'}
                      style={{ width: maxPct > 0 ? `${(b.pct_saldo / maxPct) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-ink-900 tabular-nums w-12 text-right">{fmtPct(b.pct_saldo)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-[#ECECEC] rounded-md p-8 bg-white max-w-2xl">
      <p className="text-[13px] text-ink-900 font-medium">No hay cortes procesados todavía</p>
      <p className="text-[12.5px] text-ink-500 mt-1">
        Sube y procesa un reporte de Yunius para ver el snapshot ejecutivo.
      </p>
      <Link
        href="/cartera/cargar"
        className="inline-block mt-4 bg-navy text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-navy/90 transition-colors"
      >
        Cargar reporte
      </Link>
    </div>
  )
}

function EmptyResultado() {
  return (
    <div className="border border-[#ECECEC] rounded-md p-6 bg-white">
      <p className="text-[13px] text-ink-900 font-medium">Sin resultados</p>
      <p className="text-[12.5px] text-ink-500 mt-1">
        Ningún crédito coincide con los filtros aplicados para esta fecha de corte.
      </p>
    </div>
  )
}

function ErrorBanner({ mensaje }: { mensaje: string }) {
  return (
    <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4">
      <p className="text-[13px] text-[#C62828] font-medium">Error al cargar el snapshot</p>
      <p className="text-[12px] text-[#C62828] mt-0.5">{mensaje}</p>
    </div>
  )
}
