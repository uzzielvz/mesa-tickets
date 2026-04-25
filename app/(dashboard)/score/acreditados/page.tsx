import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import AcreditadoList from '@/components/score/acreditado-list'

export const metadata = { title: 'Acreditados — Score Crediticio' }

export default async function AcreditadosPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = createClient()
  const q = searchParams.q?.trim() ?? ''

  let query = supabase
    .from('acreditados')
    .select('id, numero, clave, nombre_completo, ciclo, puntaje_total, clasificacion_modelo, calificacion_promotor, created_at, contador_ediciones')
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(`nombre_completo.ilike.%${q}%,clave.ilike.%${q}%`)
  }

  const { data: acreditados } = await query

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">Acreditados</h1>
          <p className="text-[13px] text-ink-400 mt-0.5">
            {acreditados?.length ?? 0} registro{acreditados?.length !== 1 ? 's' : ''}
            {q ? ` · búsqueda: "${q}"` : ''}
          </p>
        </div>
        <Link
          href="/score/acreditados/nuevo"
          className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-4 py-[7px] transition-colors"
        >
          <Plus size={13} />
          Nuevo registro
        </Link>
      </div>

      <AcreditadoList
        acreditados={acreditados ?? []}
        emptyMessage={q ? `Sin resultados para "${q}".` : 'No hay acreditados registrados.'}
      />
    </div>
  )
}
