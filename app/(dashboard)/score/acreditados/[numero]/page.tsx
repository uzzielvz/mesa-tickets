import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calcularScore, clasificar } from '@/lib/scoring/modelo'
import ScoreCard from '@/components/score/score-card'
import ScoreDesglose from '@/components/score/score-desglose'
import EvaluacionPromotor from '@/components/score/evaluacion-promotor'
import AcreditadoHistorial from '@/components/score/acreditado-historial'
import type { Referencia } from '@/lib/scoring/types'
import type { Database } from '@/lib/supabase/types'
import { formatDate } from '@/lib/utils/format'

type AcreditadoRow = Database['public']['Tables']['acreditados']['Row'] & {
  acreditado_referencias: Array<{ calidad: string; nombre_referencia: string | null }>
}

type HistorialRow = {
  id: string
  campo: string
  valor_antes: string | null
  valor_despues: string | null
  created_at: string
  profiles: { nombre_completo: string; email: string } | null
}

export default async function AcreditadoDetailPage({
  params,
}: {
  params: { numero: string }
}) {
  const supabase = createClient()
  const numeroInt = parseInt(params.numero)
  if (isNaN(numeroInt)) notFound()

  // Fetch acreditado ID first, then parallel fetch details + historial
  const { data: base } = await supabase
    .from('acreditados')
    .select('id')
    .eq('numero', numeroInt)
    .single()

  if (!base) notFound()

  const acreditadoId = (base as { id: string }).id

  const [{ data: rawAcreditado }, { data: rawHistorial }] = await Promise.all([
    supabase
      .from('acreditados')
      .select('*, acreditado_referencias(calidad, nombre_referencia)')
      .eq('id', acreditadoId)
      .single(),
    supabase
      .from('acreditado_historial')
      .select('id, campo, valor_antes, valor_despues, created_at, profiles(nombre_completo, email)')
      .eq('acreditado_id', acreditadoId)
      .order('created_at', { ascending: false }),
  ])

  if (!rawAcreditado) notFound()

  const acreditado = rawAcreditado as unknown as AcreditadoRow
  const historial = (rawHistorial ?? []) as unknown as HistorialRow[]
  const refs = (acreditado.acreditado_referencias ?? []) as Referencia[]

  // Recalcular desglose (puntaje_total en DB es la fuente de verdad)
  const scoreResult = calcularScore(
    {
      fecha_nacimiento: acreditado.fecha_nacimiento,
      tiempo_residencia: acreditado.tiempo_residencia,
      antiguedad_negocio: acreditado.antiguedad_negocio,
      dependientes: acreditado.dependientes,
      antiguedad_telefono: acreditado.antiguedad_telefono,
      cuenta_banco: acreditado.cuenta_banco,
      casa_habitacion: acreditado.casa_habitacion,
      estado_civil: acreditado.estado_civil,
      negocio_domicilio: acreditado.negocio_domicilio,
      destino_credito: acreditado.destino_credito,
      automovil_propio: acreditado.automovil_propio,
      buro_credito: acreditado.buro_credito,
      tipo_garantia: acreditado.tipo_garantia,
      tipo_negocio: acreditado.tipo_negocio,
      genero: acreditado.genero,
    },
    refs
  )

  const clasificacion = clasificar(acreditado.puntaje_total ?? scoreResult.puntaje)

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb + acciones */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <Link
            href="/score/acreditados"
            className="flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700 transition-colors"
          >
            <ChevronLeft size={13} />
            Acreditados
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-[18px] font-semibold text-ink-900">{acreditado.nombre_completo}</h1>
            <span className="text-[12px] font-mono text-ink-400">{acreditado.clave}</span>
          </div>
          <p className="text-[12px] text-ink-400">
            Ciclo {acreditado.ciclo} · Registro #{acreditado.numero} · {formatDate(acreditado.created_at)}
          </p>
        </div>
        <Link
          href={`/score/acreditados/${acreditado.numero}/editar`}
          className="flex items-center gap-1.5 border border-[#ECECEC] text-ink-700 text-[12.5px] font-medium rounded px-4 py-[7px] hover:bg-surface-hover transition-colors"
        >
          <Pencil size={12} />
          Editar
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Columna izquierda */}
        <div className="flex-1 flex flex-col gap-4">
          <ScoreCard
            puntaje={acreditado.puntaje_total ?? scoreResult.puntaje}
            clasificacion={clasificacion}
          />
          <ScoreDesglose desglose={scoreResult.desglose} />
          <EvaluacionPromotor
            acreditadoId={acreditado.id}
            calificacion_actual={acreditado.calificacion_promotor}
            justificacion_actual={acreditado.justificacion_promotor}
          />
        </div>

        {/* Columna derecha — datos */}
        <div className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-[0.4px] font-semibold text-ink-400">Datos del perfil</p>
          <div className="border border-[#ECECEC] rounded-md overflow-hidden">
            {([
              ['Fecha de nacimiento', acreditado.fecha_nacimiento],
              ['Estado civil', acreditado.estado_civil],
              ['Género', acreditado.genero],
              ['Dependientes', String(acreditado.dependientes)],
              ['Casa habitación', acreditado.casa_habitacion],
              ['Residencia', `${acreditado.tiempo_residencia} años`],
              ['Tipo de negocio', acreditado.tipo_negocio],
              ['Antigüedad negocio', `${acreditado.antiguedad_negocio} años`],
              ['Destino crédito', acreditado.destino_credito],
              ['Tipo de garantía', acreditado.tipo_garantia],
              ['Buró de crédito', acreditado.buro_credito],
              ['Cuenta bancaria', `${acreditado.cuenta_banco} años`],
              ['Teléfono', `${acreditado.antiguedad_telefono} años`],
              ['Negocio en domicilio', acreditado.negocio_domicilio ? 'Sí' : 'No'],
              ['Automóvil propio', acreditado.automovil_propio ? 'Sí' : 'No'],
            ] as [string, string][]).map(([label, value], i, arr) => (
              <div
                key={label}
                className={`flex items-center justify-between px-4 py-2.5 gap-3 ${i < arr.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
              >
                <span className="text-[12px] text-ink-500 shrink-0">{label}</span>
                <span className="text-[12.5px] font-medium text-ink-900 text-right">{value}</span>
              </div>
            ))}
          </div>

          {refs.length > 0 && (
            <>
              <p className="text-[11px] uppercase tracking-[0.4px] font-semibold text-ink-400 mt-1">Referencias</p>
              <div className="border border-[#ECECEC] rounded-md overflow-hidden">
                {refs.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-2.5 gap-3 ${i < refs.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                  >
                    <span className="text-[12.5px] text-ink-700 truncate">{r.nombre_referencia || `Referencia ${i + 1}`}</span>
                    <span className="text-[11.5px] font-medium text-ink-500 shrink-0">{r.calidad}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Historial */}
      {historial.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-[0.4px] font-semibold text-ink-400">Historial de cambios</p>
          <AcreditadoHistorial historial={historial} />
        </div>
      )}
    </div>
  )
}
