import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calcularScore, clasificar } from '@/lib/scoring/modelo'
import { puedeEditarAcreditado } from '@/lib/utils/score-permissions'
import ScoreCard from '@/components/score/score-card'
import ScoreDesglose from '@/components/score/score-desglose'
import EvaluacionPromotor from '@/components/score/evaluacion-promotor'
import AcreditadoHistorial from '@/components/score/acreditado-historial'
import AcreditadoAcciones from '@/components/score/acreditado-acciones'
import type { Referencia } from '@/lib/scoring/types'
import { formatDate, formatName } from '@/lib/utils/format'

type AcreditadoRow = {
  id: string
  numero: number
  clave: string
  nombre_completo: string
  ciclo: string
  fecha_nacimiento: string
  tiempo_residencia: number
  antiguedad_negocio: number
  dependientes: number
  antiguedad_telefono: number
  cuenta_banco: number
  casa_habitacion: string
  estado_civil: string
  negocio_domicilio: boolean
  destino_credito: string
  automovil_propio: boolean
  buro_credito: string
  tipo_garantia: string
  tipo_negocio: string
  genero: string
  puntaje_total: number | null
  clasificacion_modelo: string | null
  calificacion_promotor: string | null
  justificacion_promotor: string | null
  capturado_por_id: string
  contador_ediciones: number
  created_at: string
  updated_at: string
  acreditado_referencias: Array<{ calidad: string; nombre_referencia: string | null }>
  capturado: { nombre_completo: string } | null
  promotor: { nombre_completo: string } | null
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  const rol = (profile as { rol: string } | null)?.rol ?? 'usuario'

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
      .select(`
        *,
        acreditado_referencias(calidad, nombre_referencia),
        capturado:profiles!capturado_por_id(nombre_completo),
        promotor:profiles!promotor_id(nombre_completo)
      `)
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
  const puedeEditar = puedeEditarAcreditado(user.id, acreditado.capturado_por_id, rol)

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
  const capturadoNombre = acreditado.capturado
    ? formatName(acreditado.capturado.nombre_completo, '')
    : '—'
  const promotorNombre = acreditado.promotor
    ? formatName(acreditado.promotor.nombre_completo, '')
    : null

  return (
    <div className="flex flex-col gap-5">
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
          <p className="text-[12px] text-ink-500">
            Capturado por: <span className="text-ink-700">{capturadoNombre}</span>
            {promotorNombre && (
              <>
                {' · '}
                Evaluado por: <span className="text-ink-700">{promotorNombre}</span>
              </>
            )}
            {acreditado.contador_ediciones > 0 && (
              <> · {acreditado.contador_ediciones} edición{acreditado.contador_ediciones !== 1 ? 'es' : ''}</>
            )}
          </p>
        </div>
        <AcreditadoAcciones
          acreditadoId={acreditado.id}
          numero={acreditado.numero}
          nombre={acreditado.nombre_completo}
          puedeEditar={puedeEditar}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
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

      {historial.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-[0.4px] font-semibold text-ink-400">Historial de cambios</p>
          <AcreditadoHistorial historial={historial} />
        </div>
      )}
    </div>
  )
}
