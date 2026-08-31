import Link from 'next/link'
import { CalendarClock, TrendingUp, Upload, FileClock, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { etiquetaPeriodo } from '@/lib/inversiones/periodo'
import type { TipoReporte } from '@/lib/inversiones/excel'

export const dynamic = 'force-dynamic'

interface CargaFila {
  id: string
  tipo_reporte: TipoReporte
  periodo_inicio: string
  periodo_fin: string
  created_at: string
  estado: string
}

export default async function InversionesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_carga, acceso_inversiones_pagos, acceso_inversiones_desempeno')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  const admin = p?.rol === 'admin'
  const puedeCargar = admin || p?.acceso_inversiones_carga === true
  const vePagos = admin || p?.acceso_inversiones_pagos === true
  const veDesempeno = admin || p?.acceso_inversiones_desempeno === true

  // La última carga de cada reporte. La bitácora la lee cualquiera del módulo,
  // así que esto no filtra nada que la puerta no vaya a dejar pasar después.
  const { data: cargas } = await supabase
    .from('inv_cargas')
    .select('id, tipo_reporte, periodo_inicio, periodo_fin, created_at, estado')
    .order('periodo_fin', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(40)

  const filas = (cargas ?? []) as CargaFila[]
  const ultima = (t: TipoReporte) => filas.find(c => c.tipo_reporte === t)

  const reportes = [
    {
      tipo: 'calendario' as TipoReporte,
      titulo: 'Calendario de Pagos a Fondeadores',
      resumen: 'Cuánto sale, qué día y por qué medio.',
      audiencia: 'Tesorería',
      href: '/inversiones/pagos',
      icono: CalendarClock,
      puede: vePagos,
    },
    {
      tipo: 'tablero' as TipoReporte,
      titulo: 'Tablero Ejecutivo de Cartera',
      resumen: 'Desempeño comercial por gerente y ejecutivo de inversión.',
      audiencia: 'Dirección',
      href: '/inversiones/desempeno',
      icono: TrendingUp,
      puede: veDesempeno,
    },
  ]

  return (
    <div>
      <Header
        title="Inversiones"
        subtitle="Los reportes de fondeo que se generan desde Yunius."
        action={
          puedeCargar ? (
            <Link
              href="/inversiones/cargar"
              className="text-[13px] text-navy hover:underline font-medium"
            >
              Cargar reporte
            </Link>
          ) : undefined
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
          {reportes.map(r => {
            const u = ultima(r.tipo)
            const Icono = r.icono
            const cuerpo = (
              <>
                <div className="flex items-start gap-3">
                  <Icono size={18} className="text-ink-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink-900 leading-snug">
                      {r.titulo}
                    </p>
                    <p className="text-[12.5px] text-ink-500 mt-0.5">{r.resumen}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#F0F0F0] text-[12px]">
                  {u ? (
                    <p className="text-ink-700">
                      Último: <strong className="font-medium">
                        {etiquetaPeriodo(r.tipo, u.periodo_inicio, u.periodo_fin)}
                      </strong>
                      {u.estado === 'pendiente' && (
                        <span className="text-ink-400"> · sin procesar</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-ink-400">Todavía no se ha cargado ninguno.</p>
                  )}
                  <p className="text-ink-400 mt-0.5">Para {r.audiencia}</p>
                </div>
              </>
            )

            return r.puede ? (
              <Link
                key={r.tipo}
                href={r.href}
                className="border border-[#ECECEC] rounded-md bg-white p-4 hover:bg-surface-hover transition-colors"
              >
                {cuerpo}
              </Link>
            ) : (
              <div
                key={r.tipo}
                className="border border-[#ECECEC] rounded-md bg-white p-4 opacity-60"
                title={`No tienes acceso a ${r.titulo}`}
              >
                {cuerpo}
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-400">
                  <Lock size={12} /> Sin acceso
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-4 text-[12.5px]">
          <Link
            href="/inversiones/cargas"
            className="flex items-center gap-1.5 text-navy hover:underline font-medium"
          >
            <FileClock size={14} /> Historial de cargas
          </Link>
          {puedeCargar && (
            <Link
              href="/inversiones/cargar"
              className="flex items-center gap-1.5 text-navy hover:underline font-medium"
            >
              <Upload size={14} /> Cargar un reporte
            </Link>
          )}
        </div>

        {/* Mientras I2/I4 no existan, esto evita que "sin procesar" se lea como falla. */}
        <p className="text-[12px] text-ink-400 border-t border-[#F0F0F0] pt-4 max-w-3xl">
          Por ahora el módulo <strong className="text-ink-500 font-medium">guarda y
          entrega</strong> los reportes con su historial. Las vistas de cada reporte
          llegan en la siguiente entrega; mientras tanto, se descargan desde el
          historial de cargas.
        </p>
      </div>
    </div>
  )
}
