import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

// El pipeline es el tablero desde el que se opera el módulo: toda página a la
// que manda debe saber regresar. Sin esto la navegación es de una sola
// dirección y el flujo se siente cortado a la mitad.
export default function VolverPipeline({ vacanteId }: { vacanteId?: string | null }) {
  const href = vacanteId
    ? `/reclutamiento/pipeline?vacante=${vacanteId}`
    : '/reclutamiento/pipeline'

  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-[12.5px] text-ink-400 transition-colors hover:text-ink-700"
    >
      <ChevronLeft size={13} />
      Pipeline
    </Link>
  )
}
