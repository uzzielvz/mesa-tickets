import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import FechaSelector from '@/components/cartera/fecha-selector'
import FronteraSelector from '@/components/cartera/frontera-selector'

// Frontera por defecto: 1-abr-2026 (las hojas legacy "Marzo"/"Abril" parten aquí).
const FRONTERA_DEFAULT = '2026-04-01'
const esFechaISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

// ── Tipos del contrato del RPC cartera_cohort ─────────────────────────────────
type CohorteBucket = {
  bucket: string
  label: string
  dias_min: number
  dias_max: number | null
  creditos: number
  saldo: number
  pct_saldo: number
}

type Cohorte = {
  clave: 'antes' | 'desde'
  etiqueta: string
  totales: {
    creditos: number
    cartera_total: number
    creditos_en_mora: number
    cartera_en_mora: number
    pct_mora: number
  }
  indicadores: { pct_par_30: number; pct_par_90: number }
  par: CohorteBucket[]
}

type CarteraCohort = {
  fecha_corte: string
  frontera: string
  sin_fecha: number
  cohortes: Cohorte[]
}

// ── Helpers de formato ────────────────────────────────────────────────────────
const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
const fmtNumero = (n: number) => new Intl.NumberFormat('es-MX').format(n)
const fmtPct = (n: number) => `${n.toFixed(2)}%`

interface PageProps {
  searchParams: { fecha?: string; frontera?: string }
}

export default async function CohortPage({ searchParams }: PageProps) {
  const supabase = createClient()

  const { data: uploads } = await supabase
    .from('cartera_uploads')
    .select('fecha_corte')
    .eq('estado', 'procesado')
    .order('fecha_corte', { ascending: false })

  const fechas = Array.from(new Set((uploads ?? []).map(u => u.fecha_corte as string)))

  if (fechas.length === 0) {
    return (
      <div>
        <Header title="Cohortes" subtitle="Comparativo por fecha de inicio de ciclo." />
        <div className="px-5 md:px-9 pb-12">
          <EmptyState />
        </div>
      </div>
    )
  }

  const fechaActual = searchParams.fecha && fechas.includes(searchParams.fecha)
    ? searchParams.fecha
    : fechas[0]

  const fronteraActual = searchParams.frontera && esFechaISO(searchParams.frontera)
    ? searchParams.frontera
    : FRONTERA_DEFAULT

  const { data, error } = await supabase.rpc('cartera_cohort', {
    p_fecha_corte: fechaActual,
    p_frontera: fronteraActual,
  })

  if (error) {
    return (
      <div>
        <Header title="Cohortes" subtitle={`Corte ${fechaActual}`} />
        <div className="px-5 md:px-9 pb-12">
          <ErrorBanner mensaje={error.message} />
        </div>
      </div>
    )
  }

  const cohort = data as unknown as CarteraCohort
  const cohortes = cohort.cohortes ?? []
  const totalCreditos = cohortes.reduce((s, c) => s + c.totales.creditos, 0)

  return (
    <div>
      <Header
        title="Cohortes"
        subtitle={`Corte ${fechaActual} · partido por inicio de ciclo (frontera ${cohort.frontera})`}
        action={
          <Link href="/cartera" className="text-[13px] text-navy hover:underline font-medium">
            Ver snapshot
          </Link>
        }
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-4">
          <FechaSelector fechas={fechas} fechaActual={fechaActual} />
          <FronteraSelector fronteraActual={fronteraActual} fronteraDefault={FRONTERA_DEFAULT} />
        </div>

        {totalCreditos === 0 ? (
          <EmptyResultado />
        ) : (
          <>
            <p className="text-[12px] text-ink-400">
              {fmtNumero(totalCreditos)} créditos clasificados por su fecha de inicio de ciclo respecto al {cohort.frontera}.
              {cohort.sin_fecha > 0 && (
                <span className="text-[#E65100]"> {fmtNumero(cohort.sin_fecha)} sin fecha de inicio (no clasificados).</span>
              )}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {cohortes.map(c => (
                <CohortePanel key={c.clave} cohorte={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Panel por cohorte ─────────────────────────────────────────────────────────
function CohortePanel({ cohorte }: { cohorte: Cohorte }) {
  const { totales, indicadores, par } = cohorte
  const maxPct = Math.max(0, ...par.map(p => p.pct_saldo))
  const tonoBorde = cohorte.clave === 'desde' ? 'border-t-navy' : 'border-t-[#94A3B8]'

  return (
    <div className={`border border-[#ECECEC] border-t-2 ${tonoBorde} rounded-md bg-white overflow-hidden`}>
      <div className="px-5 py-3 border-b border-[#ECECEC] bg-surface-sidebar">
        <p className="text-[14px] text-ink-900 font-semibold tracking-[-0.2px]">{cohorte.etiqueta}</p>
        <p className="text-[11.5px] text-ink-400 mt-0.5">
          {fmtNumero(totales.creditos)} créditos · {fmtMoneda(totales.cartera_total)}
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-3 divide-x divide-[#F0F0F0] border-b border-[#F0F0F0]">
        <Mini label="% Mora" value={fmtPct(totales.pct_mora)} tone="warn" />
        <Mini label="PAR > 30" value={fmtPct(indicadores.pct_par_30)} tone="warn" />
        <Mini label="PAR > 90" value={fmtPct(indicadores.pct_par_90)} tone="alert" />
      </div>

      {/* Distribución PAR */}
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-400 font-medium">
            <th className="text-left  px-5 py-2 font-medium">Bucket</th>
            <th className="text-right px-3 py-2 font-medium">Créditos</th>
            <th className="text-right px-3 py-2 font-medium">Saldo</th>
            <th className="text-right px-5 py-2 font-medium w-[30%]">%</th>
          </tr>
        </thead>
        <tbody>
          {par.map(b => (
            <tr key={b.bucket} className="border-t border-[#F5F5F5]">
              <td className="px-5 py-2 text-ink-900 font-medium">{b.label}</td>
              <td className="px-3 py-2 text-right text-ink-900 tabular-nums">{fmtNumero(b.creditos)}</td>
              <td className="px-3 py-2 text-right text-ink-900 tabular-nums">{fmtMoneda(b.saldo)}</td>
              <td className="px-5 py-2">
                <div className="flex items-center gap-2 justify-end">
                  <div className="flex-1 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden max-w-[120px]">
                    <div
                      className={b.dias_min >= 31 ? 'h-full bg-[#E65100]' : 'h-full bg-navy'}
                      style={{ width: maxPct > 0 ? `${(b.pct_saldo / maxPct) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-ink-900 tabular-nums w-11 text-right">{fmtPct(b.pct_saldo)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone: 'warn' | 'alert' }) {
  const color = tone === 'alert' ? 'text-[#C62828]' : 'text-[#E65100]'
  return (
    <div className="px-4 py-3 flex flex-col gap-0.5">
      <p className="text-[10.5px] uppercase tracking-[0.3px] text-ink-400 font-medium">{label}</p>
      <p className={`text-[17px] font-semibold tracking-[-0.3px] ${color}`}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-[#ECECEC] rounded-md p-8 bg-white max-w-2xl">
      <p className="text-[13px] text-ink-900 font-medium">No hay cortes procesados todavía</p>
      <p className="text-[12.5px] text-ink-500 mt-1">
        Sube y procesa un reporte de Yunius para ver los cohortes.
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
      <p className="text-[13px] text-ink-900 font-medium">Sin créditos</p>
      <p className="text-[12.5px] text-ink-500 mt-1">No hay créditos para esta fecha de corte.</p>
    </div>
  )
}

function ErrorBanner({ mensaje }: { mensaje: string }) {
  return (
    <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4">
      <p className="text-[13px] text-[#C62828] font-medium">Error al cargar los cohortes</p>
      <p className="text-[12px] text-[#C62828] mt-0.5">{mensaje}</p>
    </div>
  )
}
