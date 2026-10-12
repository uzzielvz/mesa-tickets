import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import ListaAvisos from '@/components/notificaciones/lista-avisos'
import { COLUMNAS_AVISO, type Aviso } from '@/lib/notificaciones/tipos'

export const dynamic = 'force-dynamic'

/**
 * Todos los avisos de quien está en sesión (NTF-001), lo que la campana
 * enseña resumido. La RLS solo deja ver los suyos. Por ahora avisa Vacaciones.
 */
export default async function AvisosPage() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notificaciones')
    .select(COLUMNAS_AVISO)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <Header title="Avisos" subtitle="Lo que pasa con tus solicitudes y lo que te toca resolver." />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-4">
        {error && (
          <p className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md px-4 py-3 text-[12.5px] text-[#C62828]">
            No se pudieron cargar los avisos: {error.message}
          </p>
        )}
        <ListaAvisos avisos={(data ?? []) as Aviso[]} />
      </div>
    </div>
  )
}
