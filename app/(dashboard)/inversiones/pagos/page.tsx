import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Tile, Panel, Vacio } from '@/components/viz'
import {
  CurvaSalidas, Secciones, fmtPesos, fmtPesosExacto, type DiaCurva,
} from '@/components/inversiones/calendario-viz'
import { fechaLarga } from '@/lib/inversiones/periodo'

export const dynamic = 'force-dynamic'

interface Resumen {
  periodo: string | null
  periodos: { periodo: string }[]
  carga: {
    id: string
    nombre_archivo: string
    periodo_inicio: string
    periodo_fin: string
    created_at: string
    avisos: string[] | null
  } | null
  filas: number
  total: number
  salidas: number
  capitalizado: number
  revisar: number
  secciones: { seccion: string; pagos: number; monto: number; capitaliza: boolean }[]
}

interface Curva { periodo: string | null; dias: DiaCurva[]; max_salidas: number }

interface Revisar {
  pagos: {
    clave: string
    inversionista: string | null
    fecha_pago: string | null
    dia: number | null
    monto: number
    universo: string | null
    gerente_inversion: string | null
  }[]
  validaciones: {
    clave: string | null
    inversionista: string | null
    universo: string | null
    observacion: string | null
  }[]
}

function mesLargo(periodo: string): string {
  // El periodo es el primer día del mes; se fija mediodía UTC para que la
  // conversión de zona no lo empuje al mes anterior.
  return new Date(`${periodo}T12:00:00Z`).toLocaleDateString('es-MX', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Puerta de Tesorería: qué hay que pagar este mes y qué día.
 *
 * Todo lo agregado viene de RPCs (`inv_resumen_calendario`, `inv_curva_salidas`,
 * `inv_revisar_medio`), no de SQL escrito aquí. Es lo que después se envuelve
 * como tool del chat (RESEARCH §14.7); SQL dentro del componente habría que
 * reescribirlo entonces.
 */
export default async function PagosPage({
  searchParams,
}: {
  searchParams: { periodo?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_pagos')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  if (!(p?.rol === 'admin' || p?.acceso_inversiones_pagos === true)) {
    redirect('/inversiones')
  }

  // Solo se acepta una fecha ISO: lo que venga en el query no entra crudo al RPC.
  const periodo = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.periodo ?? '')
    ? searchParams.periodo!
    : null

  const [resumenRes, curvaRes, revisarRes] = await Promise.all([
    supabase.rpc('inv_resumen_calendario', { p_periodo: periodo }),
    supabase.rpc('inv_curva_salidas', { p_periodo: periodo }),
    supabase.rpc('inv_revisar_medio', { p_periodo: periodo }),
  ])

  const resumen = resumenRes.data as unknown as Resumen | null
  const curva = curvaRes.data as unknown as Curva | null
  const revisar = revisarRes.data as unknown as Revisar | null

  if (!resumen || !resumen.carga) {
    return (
      <div>
        <Header
          title="Pagos a fondeadores"
          subtitle="Calendario mensual de pagos, generado desde Yunius."
          action={
            <Link href="/inversiones" className="text-[13px] text-navy hover:underline font-medium">
              Volver
            </Link>
          }
        />
        <div className="px-5 md:px-9 pb-12">
          <Vacio mensaje="Todavía no hay ningún calendario procesado. En cuanto se cargue uno, aquí aparece el mes completo." />
        </div>
      </div>
    )
  }

  const avisos = resumen.carga.avisos ?? []
  const pctCapitalizado = resumen.total > 0 ? (resumen.capitalizado / resumen.total) * 100 : 0

  return (
    <div>
      <Header
        title="Pagos a fondeadores"
        subtitle={`Calendario de ${mesLargo(resumen.periodo!)}. Generado desde Yunius.`}
        action={
          <Link href="/inversiones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        {/* Selector de mes. Enlaces, no un select: el mes vive en la URL y así
            se puede compartir "el calendario de septiembre" con un link. */}
        {resumen.periodos.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {resumen.periodos.map(x => {
              const activo = x.periodo === resumen.periodo
              return (
                <Link
                  key={x.periodo}
                  href={`/inversiones/pagos?periodo=${x.periodo}`}
                  className={`text-[12px] font-medium rounded px-3 py-[5px] border transition-colors capitalize ${
                    activo
                      ? 'border-orange bg-orange/10 text-orange-dark'
                      : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
                  }`}
                >
                  {mesLargo(x.periodo)}
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
            etiqueta="Sale de caja"
            valor={fmtPesos(resumen.salidas)}
            apoyo="efectivo que hay que tener"
            acento
          />
          <Tile
            etiqueta="Total del periodo"
            valor={fmtPesos(resumen.total)}
            apoyo={`${resumen.filas.toLocaleString('es-MX')} pagos programados`}
          />
          <Tile
            etiqueta="Se capitaliza"
            valor={fmtPesos(resumen.capitalizado)}
            apoyo={`${pctCapitalizado.toFixed(1)}% del total — no sale de caja`}
          />
          <Tile
            etiqueta="Sin medio de pago"
            valor={String(resumen.revisar)}
            apoyo={resumen.revisar > 0 ? 'requieren decisión' : 'todo definido'}
          />
        </div>

        <Panel
          titulo="Salida de efectivo por día"
          nota="no incluye lo que se capitaliza"
        >
          <CurvaSalidas dias={curva?.dias ?? []} max={curva?.max_salidas ?? 0} />
        </Panel>

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <Panel titulo="Por sección" nota={`${resumen.filas} pagos`}>
            <Secciones filas={resumen.secciones} />
          </Panel>

          <Panel
            titulo="Sin medio de pago definido"
            nota={revisar?.pagos.length ? `${revisar.pagos.length} casos` : undefined}
          >
            {!revisar?.pagos.length ? (
              <Vacio mensaje="Todos los pagos del mes tienen medio definido." />
            ) : (
              <ul className="divide-y divide-[#F5F5F5]">
                {revisar.pagos.map(r => (
                  <li key={r.clave} className="px-5 py-2.5 flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12.5px] text-ink-900 truncate">
                        {r.inversionista ?? '—'}
                      </p>
                      <p className="text-[11.5px] text-ink-400 font-mono">
                        {r.clave}
                        {r.fecha_pago && ` · ${fechaLarga(r.fecha_pago)}`}
                        {r.universo && ` · ${r.universo}`}
                      </p>
                    </div>
                    <p className="text-[12.5px] text-ink-900 tabular-nums font-medium whitespace-nowrap">
                      {fmtPesosExacto(r.monto)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <p className="text-[11.5px] text-ink-400">
          Fuente:{' '}
          <span className="font-mono">{resumen.carga.nombre_archivo}</span>, cargado el{' '}
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
