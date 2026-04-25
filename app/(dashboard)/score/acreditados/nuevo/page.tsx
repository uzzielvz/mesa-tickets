import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import AcreditadoForm from '@/components/score/acreditado-form'

export const metadata = { title: 'Nuevo acreditado — Score Crediticio' }

export default function NuevoAcreditadoPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/score/acreditados"
          className="flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700 transition-colors"
        >
          <ChevronLeft size={13} />
          Acreditados
        </Link>
        <span className="text-ink-300 text-[12.5px]">/</span>
        <span className="text-[12.5px] text-ink-700">Nuevo registro</span>
      </div>

      <h1 className="text-[18px] font-semibold text-ink-900">Nuevo acreditado</h1>

      <AcreditadoForm />
    </div>
  )
}
