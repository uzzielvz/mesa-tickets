import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import RecuperadorFilters from '@/components/cartera/recuperador-filters'

// ── Tipos del contrato del RPC ────────────────────────────────────────────────
type RecBucket = {
  bucket: string
  label: string
  dias_min: number
  dias_max: number | null
  creditos: number
  saldo: number
}

type RecRow = {
  codigo: string
  nombre: string | null
  coordinacion: string
  creditos: number
  cartera_total: number
  creditos_en_mora: number
  cartera_en_mora: number
  pct_mora: number
  pct_par_30: number
  pct_par_90: number
  par: RecBucket[]
}

type RecResumen = {
  fecha_corte: string
  coordinacion: string | null
  recuperadores: RecRow[]
}

type CarteraFiltros = {
  fecha_corte: string
  coordinaciones: string[]
  recuperadores: { codigo: string; nombre: string | null }[]
  ciclos: string[]
}

// ── Helpers de formato ────────────────────────────────────────────────────────
const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const fmtNumero = (n: number) => new Intl.NumberFormat('es-MX').format(n)

const fmtPct = (n: number) => `${n.toFixed(2)}%`

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
  searchParams: { fecha?: string; coordinacion?: string }
}

export default async function RecuperadorPage({ searchParams }: PageProps) {
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
        <Header title="Cartera por recuperador" subtitle="Distribución PAR por cobrador." />
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

  const [{ data: filtrosData }, { data, error }] = await Promise.all([
    supabase.rpc('cartera_filtros', { p_fecha_corte: fechaActual }),
    supabase.rpc('cartera_por_recuperador', {
      p_fecha_corte: fechaActual,
      p_coordinacion: coordinacionActual,
    }),
  ])

  if (error) {
    return (
      <div>
        <Header title="Cartera por recuperador" subtitle={`Corte ${fechaActual}`} />
        <div className="px-5 md:px-9 pb-12">
          <ErrorBanner mensaje={error.message} />
        </div>
      </div>
    )
  }

  const filtros = filtrosData as unknown as CarteraFiltros
  const resumen = data as unknown as RecResumen
  const filas = resumen.recuperadores ?? []

  const buckets = filas[0]?.par.map(b => ({ bucket: b.bucket, label: b.label })) ?? []
  const totalGeneral = filas.reduce(
    (acc, f) => ({ creditos: acc.creditos + f.creditos, cartera: acc.cartera + f.cartera_total }),
    { creditos: 0, cartera: 0 },
  )
  const totalPorBucket = buckets.map((_, i) => filas.reduce((s, f) => s + (f.par[i]?.saldo ?? 0), 0))

  return (
    <div>
      <Header
        title="Cartera por recuperador"
        subtitle={`Corte ${fechaActual} · ${filas.length} recuperadores${coordinacionActual ? ` · ${coordinacionActual}` : ''}`}
        action={
          <Link href="/cartera/coordinacion" className="text-[13px] text-navy hover:underline font-medium">
            Ver por coordinación
          </Link>
        }
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <RecuperadorFilters
          fechas={fechas}
          coordinaciones={filtros?.coordinaciones ?? []}
          fechaActual={fechaActual}
          coordinacionActual={coordinacionActual}
        />

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

// ── Tabla 1: indicadores de riesgo por recuperador ────────────────────────────
function TablaIndicadores({
  filas,
  total,
}: {
  filas: RecRow[]
  total: { creditos: number; cartera: number }
}) {
  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar">
        <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
          Riesgo por recuperador
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[720px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium border-b border-[#F0F0F0]">
              <th className="text-left  px-5 py-2.5 font-medium">Recuperador</th>
              <th className="text-left  px-3 py-2.5 font-medium">Coordinación</th>
              <th className="text-right px-3 py-2.5 font-medium">Créditos</th>
              <th className="text-right px-3 py-2.5 font-medium">Cartera</th>
              <th className="text-right px-3 py-2.5 font-medium">% Mora</th>
              <th className="text-right px-3 py-2.5 font-medium">PAR &gt; 30</th>
              <th className="text-right px-5 py-2.5 font-medium">PAR &gt; 90</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.codigo} className="border-b border-[#F5F5F5]">
                <td className="px-5 py-2.5">
                  <span className="text-ink-900 font-medium">{f.nombre ?? f.codigo}</span>
                  <span className="text-ink-400 ml-2 text-[11.5px] tabular-nums">{f.codigo}</span>
                </td>
                <td className="px-3 py-2.5 text-ink-500">{f.coordinacion}</td>
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
              <td className="px-5 py-2.5 text-ink-900 font-semibold" colSpan={2}>Total</td>
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

// ── Tabla 2: distribución PAR recuperador × buckets (heatmap por % de fila) ────
function TablaDistribucion({
  filas,
  buckets,
  totalPorBucket,
}: {
  filas: RecRow[]
  buckets: { bucket: string; label: string }[]
  totalPorBucket: number[]
}) {
  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
          Distribución de saldo por bucket
        </p>
        <p className="text-[11.5px] text-ink-400">% de la cartera de cada recuperador</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium border-b border-[#F0F0F0]">
              <th className="text-left px-5 py-2.5 font-medium sticky left-0 bg-white">Recuperador</th>
              {buckets.map(b => (
                <th key={b.bucket} className="text-right px-3 py-2.5 font-medium whitespace-nowrap">{b.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.codigo} className="border-b border-[#F5F5F5]">
                <td className="px-5 py-2.5 text-ink-900 font-medium sticky left-0 bg-white whitespace-nowrap">
                  {f.nombre ?? f.codigo}
                </td>
                {f.par.map(b => {
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
// intensidad proporcional al % que representa dentro del recuperador.
function celdaHeatmap(diasMin: number, pct: number): React.CSSProperties {
  if (pct < 0.5) return {}
  const alpha = Math.min(0.85, 0.08 + (pct / 100) * 1.4)
  const rgb = diasMin >= 91 ? '198,40,40' : diasMin >= 31 ? '230,81,0' : '26,42,71'
  return { backgroundColor: `rgba(${rgb},${alpha.toFixed(3)})`, color: alpha > 0.45 ? '#fff' : undefined }
}

// ── Estados ───────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="border border-[#ECECEC] rounded-md p-8 bg-white max-w-2xl">
      <p className="text-[13px] text-ink-900 font-medium">No hay cortes procesados todavía</p>
      <p className="text-[12.5px] text-ink-500 mt-1">
        Sube y procesa un reporte de Yunius para ver la cartera por recuperador.
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
      <p className="text-[12.5px] text-ink-500 mt-1">No hay recuperadores para este filtro.</p>
    </div>
  )
}

function ErrorBanner({ mensaje }: { mensaje: string }) {
  return (
    <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4">
      <p className="text-[13px] text-[#C62828] font-medium">Error al cargar la cartera por recuperador</p>
      <p className="text-[12px] text-[#C62828] mt-0.5">{mensaje}</p>
    </div>
  )
}
