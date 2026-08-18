import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import CargaActividades from '@/components/actividades/carga-form'
import { etiquetaPeriodo } from '@/components/actividades/filtros'

export const dynamic = 'force-dynamic'

export default async function CargarActividadesPage() {
  const supabase = createClient()

  const { data: cargas } = await supabase
    .from('act_cargas')
    .select('id, nombre_archivo, periodos, registros, estado, error_detalle, created_at')
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div>
      <Header
        title="Cargar actividades"
        subtitle="Sube el Excel del periodo para actualizar el tablero."
        action={
          <Link href="/actividades" className="text-[13px] text-navy hover:underline font-medium">
            Ver tablero
          </Link>
        }
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <CargaActividades />

        {cargas && cargas.length > 0 && (
          <section className="border border-[#ECECEC] rounded-md bg-white overflow-hidden max-w-2xl">
            <header className="px-5 py-2.5 border-b border-[#ECECEC] bg-surface-sidebar">
              <h2 className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
                Últimas cargas
              </h2>
            </header>
            <ul className="divide-y divide-[#F5F5F5]">
              {cargas.map(c => (
                <li key={c.id} className="px-5 py-2.5 flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-ink-900 truncate">{c.nombre_archivo}</p>
                    <p className="text-[11.5px] text-ink-500">
                      {(c.periodos as string[] | null)?.map(etiquetaPeriodo).join(', ') || '—'}
                      {' · '}{c.registros} registros
                      {c.estado === 'error' && (
                        <span className="text-[#C62828]"> · falló: {c.error_detalle}</span>
                      )}
                    </p>
                  </div>
                  <time className="text-[11.5px] text-ink-400 whitespace-nowrap">
                    {new Date(c.created_at as string).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
