import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import FechaSelector from '@/components/cartera/fecha-selector'

// ── Tipos del contrato del RPC ────────────────────────────────────────────────
type CoordBucket = {
  bucket: string
  label: string
  dias_min: number
  dias_max: number | null
  creditos: number
  saldo: number
}

type CoordRow = {
  coordinacion: string
  creditos: number
  cartera_total: number
  creditos_en_mora: number
  cartera_en_mora: number
  pct_mora: number
  pct_par_30: number
  pct_par_90: number
  par: CoordBucket[]
}

type CoordResumen = {
  fecha_corte: string
  coordinaciones: CoordRow[]
}

// ── Helpers de formato ────────────────────────────────────────────────────────
const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const fmtNumero = (n: number) => new Intl.NumberFormat('es-MX').format(n)

const fmtPct = (n: number) => `${n.toFixed(2)}%`

// Tono semáforo según el indicador PAR (umbrales de microfinanzas).
function tonoPar30(pct: number) {
  if (pct >= 40) return 'bg-[#FFEBEE] text-[#C62828]'
  if (pct >= 25) return 'bg-[#FFF3E0] text-[#E65100]'
  return 'bg-[#E8F5E9] text-[#2E7D32]'
}
function tonoPar90(pct: number) {
  if (pct >= 20) return 'bg-[#FFEBEE] text-[#C62828]'
  if (pct >= 10) return 'bg-[#FFF3E0] text-[#E65100]'
  return 'bg-[#E8F5E9] text-[#2E7D32]'
}

// ── Página ────────────────────────────────────────────────────────────────────
interface PageProps {
  searchParams: { fecha?: string }
}

export default async function CoordinacionPage({ searchParams }: PageProps) {
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
        <Header title="Cartera por coordinación" subtitle="Distribución PAR por región." />
        <div className="px-5 md:px-9 pb-12">
          <EmptyState />
        </div>
      </div>
    )
  }

  const fechaActual = searchParams.fecha && fechas.includes(searchParams.fecha)
    ? searchParams.fecha
    : fechas[0]

  const { data, error } = await supabase.rpc('cartera_por_coordinacion', {
    p_fecha_corte: fechaActual,
  })

  if (error) {
    return (
      <div>
        <Header title="Cartera por coordinación" subtitle={`Corte ${fechaActual}`} />
        <div className="px-5 md:px-9 pb-12">
          <ErrorBanner mensaje={error.message} />
        </div>
      </div>
    )
  }

  const resumen = data as unknown as CoordResumen
  const filas = resumen.coordinaciones ?? []

  // Totales de columna (footer de la tabla distribución).
  const buckets = filas[0]?.par.map(b => ({ bucket: b.bucket, label: b.label })) ?? []
  const totalGeneral = filas.reduce(
    (acc, f) => ({
      creditos: acc.creditos + f.creditos,
      cartera: acc.cartera + f.cartera_total,
    }),
    { creditos: 0, cartera: 0 },
  )
  const totalPorBucket = buckets.map((b, i) =>
    filas.reduce((sum, f) => sum + (f.par[i]?.saldo ?? 0), 0),
  )

  return (
    <div>
      <Header
        title="Cartera por coordinación"
        subtitle={`Corte ${fechaActual} · ${filas.length} coordinaciones`}
        action={
          <Link href="/cartera" className="text-[13px] text-navy hover:underline font-medium">
            Ver snapshot
          </Link>
        }
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <FechaSelector fechas={fechas} fechaActual={fechaActual} />

        {filas.length === 0 ? (
          <EmptyResultado />
        ) : (
          <>
            <TablaIndicadores filas={filas} total={totalGeneral} />
            <TablaDistribucion filas={filas} buckets={buckets} totalPorBucket={totalPorBucket} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Tabla 1: indicadores de riesgo por coordinación ───────────────────────────
function TablaIndicadores({
  filas,
  total,
}: {
  filas: CoordRow[]
  total: { creditos: number; cartera: number }
}) {
  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar">
        <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
          Riesgo por coordinación
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[640px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium border-b border-[#F0F0F0]">
              <th className="text-left  px-5 py-2.5 font-medium">Coordinación</th>
              <th className="text-right px-3 py-2.5 font-medium">Créditos</th>
              <th className="text-right px-3 py-2.5 font-medium">Cartera</th>
              <th className="text-right px-3 py-2.5 font-medium">% Mora</th>
              <th className="text-right px-3 py-2.5 font-medium">PAR &gt; 30</th>
              <th className="text-right px-5 py-2.5 font-medium">PAR &gt; 90</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.coordinacion} className="border-b border-[#F5F5F5]">
                <td className="px-5 py-2.5 text-ink-900 font-medium">{f.coordinacion}</td>
                <td className="px-3 py-2.5 text-right text-ink-900 tabular-nums">{fmtNumero(f.creditos)}</td>
                <td className="px-3 py-2.5 text-right text-ink-900 tabular-nums">{fmtMoneda(f.cartera_total)}</td>
                <td className="px-3 py-2.5 text-right text-ink-500 tabular-nums">{fmtPct(f.pct_mora)}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-medium tabular-nums ${tonoPar30(f.pct_par_30)}`}>
                    {fmtPct(f.pct_par_30)}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-medium tabular-nums ${tonoPar90(f.pct_par_90)}`}>
                    {fmtPct(f.pct_par_90)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#ECECEC] bg-surface-sidebar/50">
              <td className="px-5 py-2.5 text-ink-900 font-semibold">Total</td>
              <td className="px-3 py-2.5 text-right text-ink-900 font-semibold tabular-nums">{fmtNumero(total.creditos)}</td>
              <td className="px-3 py-2.5 text-right text-ink-900 font-semibold tabular-nums">{fmtMoneda(total.cartera)}</td>
              <td className="px-3 py-2.5" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Tabla 2: distribución PAR coord × buckets (heatmap por % de fila) ──────────
function TablaDistribucion({
  filas,
  buckets,
  totalPorBucket,
}: {
  filas: CoordRow[]
  buckets: { bucket: string; label: string }[]
  totalPorBucket: number[]
}) {
  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
          Distribución de saldo por bucket
        </p>
        <p className="text-[11.5px] text-ink-400">% de la cartera de cada coordinación</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium border-b border-[#F0F0F0]">
              <th className="text-left px-5 py-2.5 font-medium sticky left-0 bg-white">Coordinación</th>
              {buckets.map(b => (
                <th key={b.bucket} className="text-right px-3 py-2.5 font-medium whitespace-nowrap">{b.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.coordinacion} className="border-b border-[#F5F5F5]">
                <td className="px-5 py-2.5 text-ink-900 font-medium sticky left-0 bg-white whitespace-nowrap">
                  {f.coordinacion}
                </td>
                {f.par.map((b, i) => {
                  const pct = f.cartera_total > 0 ? (b.saldo / f.cartera_total) * 100 : 0
                  return (
                    <td
                      key={b.bucket}
                      className="px-3 py-2.5 text-right tabular-nums"
                      style={celdaHeatmap(b.dias_min, pct)}
                      title={`${fmtMoneda(b.saldo)} · ${b.creditos} créditos`}
                    >
                      {pct >= 0.5 ? fmtPct(pct) : <span className="text-ink-300">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#ECECEC] bg-surface-sidebar/50">
              <td className="px-5 py-2.5 text-ink-900 font-semibold sticky left-0 bg-surface-sidebar">Saldo total</td>
              {totalPorBucket.map((saldo, i) => (
                <td key={i} className="px-3 py-2.5 text-right text-ink-900 font-medium tabular-nums whitespace-nowrap">
                  {fmtMoneda(saldo)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// Fondo de celda: severidad por bucket (navy=corriente, naranja=31-90, rojo=90+),
// intensidad proporcional al % que representa dentro de la coordinación.
function celdaHeatmap(diasMin: number, pct: number): React.CSSProperties {
  if (pct < 0.5) return {}
  const alpha = Math.min(0.85, 0.08 + (pct / 100) * 1.4)
  // navy 26,42,71 · naranja 230,81,0 · rojo 198,40,40
  const rgb = diasMin >= 91 ? '198,40,40' : diasMin >= 31 ? '230,81,0' : '26,42,71'
  return { backgroundColor: `rgba(${rgb},${alpha.toFixed(3)})`, color: alpha > 0.45 ? '#fff' : undefined }
}

// ── Estados ───────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="border border-[#ECECEC] rounded-md p-8 bg-white max-w-2xl">
      <p className="text-[13px] text-ink-900 font-medium">No hay cortes procesados todavía</p>
      <p className="text-[12.5px] text-ink-500 mt-1">
        Sube y procesa un reporte de Yunius para ver la cartera por coordinación.
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
      <p className="text-[13px] text-ink-900 font-medium">Sin datos</p>
      <p className="text-[12.5px] text-ink-500 mt-1">No hay créditos para esta fecha de corte.</p>
    </div>
  )
}

function ErrorBanner({ mensaje }: { mensaje: string }) {
  return (
    <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4">
      <p className="text-[13px] text-[#C62828] font-medium">Error al cargar la cartera por coordinación</p>
      <p className="text-[12px] text-[#C62828] mt-0.5">{mensaje}</p>
    </div>
  )
}
