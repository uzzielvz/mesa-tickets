import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import VacanteForm from '@/components/reclutamiento/vacante-form'

export const metadata = { title: 'Nueva vacante — Reclutamiento' }

export default function NuevaVacantePage() {
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
        <span className="text-[12.5px] text-ink-700">Nueva vacante</span>
      </div>

      <h1 className="text-[18px] font-semibold text-ink-900">Nueva vacante</h1>

      <VacanteForm />
    </div>
  )
}
