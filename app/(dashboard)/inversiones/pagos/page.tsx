import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { etiquetaPeriodo } from '@/lib/inversiones/periodo'

export const dynamic = 'force-dynamic'

/**
 * Puerta de Tesorería. En I1 solo entrega el archivo: las vistas —la curva de
 * salidas por día y la lista de "revisar medio de pago"— llegan en I3.
 *
 * La guarda es real desde ahora a propósito: es lo que permite comprobar, antes
 * de que haya contenido que proteger, que quien solo tiene acceso a desempeño no
 * entra aquí.
 */
export default async function PagosPage() {
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

  const { data: cargas } = await supabase
    .from('inv_cargas')
    .select('id, periodo_inicio, periodo_fin, nombre_archivo, created_at')
    .eq('tipo_reporte', 'calendario')
    .order('periodo_inicio', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(12)

  const filas = cargas ?? []

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

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5 max-w-2xl">
        {filas.length === 0 ? (
          <p className="text-[13px] text-ink-500">
            Todavía no se ha cargado ningún calendario.
          </p>
        ) : (
          <section className="border border-[#ECECEC] rounded-md bg-white overflow-hidden">
            <header className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar">
              <h2 className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
                Calendarios disponibles
              </h2>
            </header>
            <ul className="divide-y divide-[#F5F5F5]">
              {filas.map(c => (
                <li key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink-900 font-medium capitalize">
                      {etiquetaPeriodo('calendario', c.periodo_inicio as string, c.periodo_fin as string)}
                    </p>
                    <p className="text-[11.5px] text-ink-400 font-mono truncate">
                      {c.nombre_archivo as string}
                    </p>
                  </div>
                  <a
                    href={`/api/inversiones/descargar/${c.id}`}
                    className="flex items-center gap-1 text-[12.5px] text-navy hover:underline font-medium shrink-0"
                  >
                    <Download size={13} /> Descargar
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="border border-[#ECECEC] rounded-md bg-surface-sidebar p-4">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
            <CalendarClock size={15} className="text-ink-400" /> Lo que falta aquí
          </p>
          <p className="mt-2 text-[12.5px] text-ink-500">
            La curva de salidas por día —separando efectivo de transferencia, y sin
            contar lo que se capitaliza al plazo— y la lista de pagos sin medio
            definido. Mientras tanto, el archivo se descarga completo.
          </p>
        </div>
      </div>
    </div>
  )
}
