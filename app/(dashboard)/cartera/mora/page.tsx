import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import MoraFilters from '@/components/cartera/mora-filters'
import MoraTable, { type MoraCredito } from '@/components/cartera/mora-table'

type MoraResumen = {
  fecha_corte: string
  coordinacion: string | null
  dias_min: number
  creditos: MoraCredito[]
}

type CarteraFiltros = {
  fecha_corte: string
  coordinaciones: string[]
  recuperadores: { codigo: string; nombre: string | null }[]
  ciclos: string[]
}

const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
const fmtNumero = (n: number) => new Intl.NumberFormat('es-MX').format(n)

interface PageProps {
  searchParams: { fecha?: string; coordinacion?: string; dias?: string }
}

export default async function MoraPage({ searchParams }: PageProps) {
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
        <Header title="Bandeja de mora" subtitle="Lista operativa de cobranza." />
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
  const diasMinActual = Math.max(1, Number(searchParams.dias) || 1)

  const [{ data: filtrosData }, { data, error }] = await Promise.all([
    supabase.rpc('cartera_filtros', { p_fecha_corte: fechaActual }),
    supabase.rpc('cartera_mora_operativa', {
      p_fecha_corte: fechaActual,
      p_coordinacion: coordinacionActual,
      p_dias_min: diasMinActual,
    }),
  ])

  if (error) {
    return (
      <div>
        <Header title="Bandeja de mora" subtitle={`Corte ${fechaActual}`} />
        <div className="px-5 md:px-9 pb-12">
          <ErrorBanner mensaje={error.message} />
        </div>
      </div>
    )
  }

  const filtros = filtrosData as unknown as CarteraFiltros
  const resumen = data as unknown as MoraResumen
  const creditos = resumen.creditos ?? []

  const saldoVencidoTotal = creditos.reduce((s, c) => s + (c.saldo_vencido ?? 0), 0)

  return (
    <div>
      <Header
        title="Bandeja de mora"
        subtitle={`Corte ${fechaActual} · ${fmtNumero(creditos.length)} créditos · ${fmtMoneda(saldoVencidoTotal)} vencido`}
        action={
          <Link href="/cartera" className="text-[13px] text-navy hover:underline font-medium">
            Ver snapshot
          </Link>
        }
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <MoraFilters
          fechas={fechas}
          coordinaciones={filtros?.coordinaciones ?? []}
          fechaActual={fechaActual}
          coordinacionActual={coordinacionActual}
          diasMinActual={diasMinActual}
        />

        {creditos.length === 0 ? (
          <EmptyResultado />
        ) : (
          <MoraTable creditos={creditos} />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border border-[#ECECEC] rounded-md p-8 bg-white max-w-2xl">
      <p className="text-[13px] text-ink-900 font-medium">No hay cortes procesados todavía</p>
      <p className="text-[12.5px] text-ink-500 mt-1">
        Sube y procesa un reporte de Yunius para ver la bandeja de mora.
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
      <p className="text-[13px] text-ink-900 font-medium">Sin créditos en mora</p>
      <p className="text-[12.5px] text-ink-500 mt-1">Ningún crédito cumple el filtro de días de mora seleccionado.</p>
    </div>
  )
}

function ErrorBanner({ mensaje }: { mensaje: string }) {
  return (
    <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4">
      <p className="text-[13px] text-[#C62828] font-medium">Error al cargar la bandeja de mora</p>
      <p className="text-[12px] text-[#C62828] mt-0.5">{mensaje}</p>
    </div>
  )
}
