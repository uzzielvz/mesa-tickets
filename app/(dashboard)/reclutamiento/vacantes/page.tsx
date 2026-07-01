import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import VacanteList from '@/components/reclutamiento/vacante-list'

export const metadata = { title: 'Vacantes — Reclutamiento' }

interface VacanteRow {
  id: string
  titulo: string
  area: string | null
  estado: 'abierta' | 'cerrada'
  created_at: string
  rec_candidatos: { count: number }[]
}

export default async function VacantesPage() {
  const supabase = createClient()

  const { data } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, area, estado, created_at, rec_candidatos(count)')
    .order('created_at', { ascending: false })

  const vacantes = ((data ?? []) as unknown as VacanteRow[]).map(v => ({
    id: v.id,
    titulo: v.titulo,
    area: v.area,
    estado: v.estado,
    created_at: v.created_at,
    candidatos: v.rec_candidatos?.[0]?.count ?? 0,
  }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">Vacantes</h1>
          <p className="text-[13px] text-ink-400 mt-0.5">
            {vacantes.length} vacante{vacantes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/reclutamiento/vacantes/nueva"
          className="flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-4 py-[7px] transition-colors"
        >
          <Plus size={13} />
          Nueva vacante
        </Link>
      </div>

      <VacanteList vacantes={vacantes} />
    </div>
  )
}
