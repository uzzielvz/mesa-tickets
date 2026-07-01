import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import VacanteForm from '@/components/reclutamiento/vacante-form'

export const metadata = { title: 'Editar vacante — Reclutamiento' }

export default async function EditarVacantePage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data } = await supabase
    .from('rec_vacantes')
    .select('id, titulo, area, descripcion, estado')
    .eq('id', params.id)
    .single()

  if (!data) notFound()

  const vacante = data as {
    id: string
    titulo: string
    area: string | null
    descripcion: string | null
    estado: 'abierta' | 'cerrada'
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/reclutamiento/vacantes"
          className="flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700 transition-colors"
        >
          <ChevronLeft size={13} />
          Vacantes
        </Link>
        <span className="text-ink-300 text-[12.5px]">/</span>
        <span className="text-[12.5px] text-ink-700">{vacante.titulo}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[18px] font-semibold text-ink-900">Editar vacante</h1>
        <Link
          href={`/reclutamiento/candidatos?vacante=${vacante.id}`}
          className="text-[12.5px] font-medium text-navy hover:underline"
        >
          Ver candidatos
        </Link>
      </div>

      <VacanteForm initialData={vacante} />
    </div>
  )
}
