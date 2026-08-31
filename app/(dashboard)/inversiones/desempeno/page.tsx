import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Download, TrendingUp, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { etiquetaPeriodo } from '@/lib/inversiones/periodo'

export const dynamic = 'force-dynamic'

/**
 * Puerta de Dirección. En I1 solo entrega el archivo: el Tablero, la estructura
 * y los rankings se renderizan en I5, leyendo lo que el archivo ya calculó — sin
 * recomputarlo, para no crear una segunda verdad que discrepe del Excel.
 */
export default async function DesempenoPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_desempeno')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  if (!(p?.rol === 'admin' || p?.acceso_inversiones_desempeno === true)) {
    redirect('/inversiones')
  }

  const { data: cargas } = await supabase
    .from('inv_cargas')
    .select('id, periodo_inicio, periodo_fin, nombre_archivo, hojas_degradadas, created_at')
    .eq('tipo_reporte', 'tablero')
    .order('periodo_fin', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(12)

  const filas = cargas ?? []

  return (
    <div>
      <Header
        title="Desempeño"
        subtitle="Tablero ejecutivo de cartera de inversiones, por corte."
        action={
          <Link href="/inversiones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-5 max-w-2xl">
        {filas.length === 0 ? (
          <p className="text-[13px] text-ink-500">
            Todavía no se ha cargado ningún tablero.
          </p>
        ) : (
          <section className="border border-[#ECECEC] rounded-md bg-white overflow-hidden">
            <header className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar">
              <h2 className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
                Cortes disponibles
              </h2>
            </header>
            <ul className="divide-y divide-[#F5F5F5]">
              {filas.map(c => {
                const degradadas = (c.hojas_degradadas as string[] | null) ?? []
                return (
                  <li key={c.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink-900 font-medium">
                        {etiquetaPeriodo('tablero', c.periodo_inicio as string, c.periodo_fin as string)}
                      </p>
                      <p className="text-[11.5px] text-ink-400 font-mono truncate">
                        {c.nombre_archivo as string}
                      </p>
                      {degradadas.length > 0 && (
                        <p className="flex items-start gap-1.5 text-[11.5px] text-[#8A6100] mt-1">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>Sin datos suficientes en: {degradadas.join(', ')}</span>
                        </p>
                      )}
                    </div>
                    <a
                      href={`/api/inversiones/descargar/${c.id}`}
                      className="flex items-center gap-1 text-[12.5px] text-navy hover:underline font-medium shrink-0"
                    >
                      <Download size={13} /> Descargar
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <div className="border border-[#ECECEC] rounded-md bg-surface-sidebar p-4">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
            <TrendingUp size={15} className="text-ink-400" /> Lo que falta aquí
          </p>
          <p className="mt-2 text-[12.5px] text-ink-500">
            El tablero por gerente, la estructura por ejecutivo, los dos rankings y
            el cumplimiento de metas — tal como el archivo los calcula. Mientras
            tanto, el archivo se descarga completo.
          </p>
        </div>
      </div>
    </div>
  )
}
