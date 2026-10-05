import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import { Panel, Vacio } from '@/components/viz'
import CargaAhorros from '@/components/ahorros/carga-form'
import { momento } from '@/lib/ahorros/tipos'

export const dynamic = 'force-dynamic'

/** Una carga que sigue 'en_curso' después de esto ya no va a terminar: la pestaña se cerró. */
const MINUTOS_INCOMPLETA = 30

interface CargaFila {
  id: string
  nombre_archivo: string
  filas_archivo: number
  rechazadas: number
  grupos: string[]
  insertadas: number
  actualizadas: number
  avisos: string[]
  estado: 'en_curso' | 'completa'
  subido_por: string | null
  created_at: string
}

/** Puerta de Data Science: subir el CSV ya cuadrado y ver qué se ha subido. */
export default async function CargarAhorrosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_ahorros_carga')
    .eq('id', user!.id)
    .single()

  const p = profile as Record<string, unknown> | null
  if (!(p?.rol === 'admin' || p?.acceso_ahorros_carga === true)) redirect('/ahorros')

  const { data } = await supabase
    .from('aho_cargas')
    .select('id, nombre_archivo, filas_archivo, rechazadas, grupos, insertadas, actualizadas, avisos, estado, subido_por, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const cargas = (data ?? []) as CargaFila[]

  const ids = Array.from(new Set(cargas.map(c => c.subido_por).filter((x): x is string => !!x)))
  const { data: personas } = ids.length
    ? await supabase.from('profiles').select('id, nombre_completo').in('id', ids)
    : { data: [] as { id: string; nombre_completo: string }[] }
  const nombre = new Map((personas ?? []).map(x => [x.id, x.nombre_completo]))

  const ahora = Date.now()

  return (
    <div>
      <Header
        title="Cargar ahorros"
        subtitle="Sube el CSV con los registros que ya cuadraste. Los asesores los ven en cuanto termina."
        action={
          <Link href="/ahorros" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <CargaAhorros />

        <Panel titulo="Historial de cargas" nota={cargas.length ? `últimas ${cargas.length}` : undefined}>
          {cargas.length === 0 ? (
            <Vacio mensaje="Todavía no se ha cargado ningún archivo." />
          ) : (
            <ul className="divide-y divide-[#F5F5F5]">
              {cargas.map(c => {
                const incompleta =
                  c.estado === 'en_curso' && ahora - new Date(c.created_at).getTime() > MINUTOS_INCOMPLETA * 60_000
                return (
                  <li key={c.id} className="px-5 py-3 flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[12.5px] text-ink-900 font-mono truncate max-w-full">{c.nombre_archivo}</p>
                      <p className="text-[11.5px] text-ink-400">
                        {momento(c.created_at)}
                        {c.subido_por && nombre.get(c.subido_por) && <> · {nombre.get(c.subido_por)}</>}
                      </p>
                    </div>
                    <p className="text-[12px] text-ink-500 tabular-nums">
                      {c.filas_archivo.toLocaleString('es-MX')} registros ·{' '}
                      {(c.grupos?.length ?? 0).toLocaleString('es-MX')} grupo-ciclo ·{' '}
                      {c.insertadas.toLocaleString('es-MX')} nuevos ·{' '}
                      {c.actualizadas.toLocaleString('es-MX')} cambiaron
                      {c.rechazadas > 0 && <> · <span className="text-[#C62828]">{c.rechazadas} sin leer</span></>}
                      {c.estado === 'en_curso' && (
                        <span className={`ml-2 text-[11px] font-medium rounded px-1.5 py-[1px] ${
                          incompleta ? 'bg-[#FFEBEE] text-[#C62828]' : 'bg-[#FFF8E1] text-[#8A6100]'
                        }`}>
                          {incompleta ? 'incompleta' : 'en curso'}
                        </span>
                      )}
                    </p>
                    {c.avisos.length > 0 && (
                      <details className="text-[12px] text-[#8A6100]">
                        <summary className="cursor-pointer select-none">
                          {c.avisos.length} {c.avisos.length === 1 ? 'aviso' : 'avisos'}
                        </summary>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {c.avisos.map((a, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <p className="text-[12px] text-ink-500 max-w-2xl">
          Una carga <strong className="text-ink-700">incompleta</strong> es una pestaña que se cerró a la
          mitad. Lo que alcanzó a entrar se queda; vuelve a subir el mismo archivo para terminarla. No
          duplica nada.
        </p>
      </div>
    </div>
  )
}
