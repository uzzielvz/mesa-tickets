import type { Clasificacion } from '@/lib/scoring/types'

const barColor: Record<string, string> = {
  A: 'bg-[#15803d]',
  B: 'bg-[#a16207]',
  C: 'bg-[#c2410c]',
  D: 'bg-[#b91c1c]',
}

interface Props {
  puntaje: number
  clasificacion: Clasificacion
  size?: 'lg' | 'sm'
}

export default function ScoreCard({ puntaje, clasificacion, size = 'lg' }: Props) {
  const isLg = size === 'lg'

  return (
    <div className="border border-[#ECECEC] rounded-md px-6 py-5 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Puntaje */}
        <div className="flex items-end gap-3">
          <span className={`font-semibold text-navy tracking-tight leading-none ${isLg ? 'text-[52px]' : 'text-[36px]'}`}>
            {puntaje.toFixed(1)}
          </span>
          <span className="text-[14px] text-ink-400 mb-2">/ 100</span>
        </div>

        {/* Badge de clasificación */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${clasificacion.bg}`}>
          <span className={`${isLg ? 'text-[28px]' : 'text-[20px]'} font-bold ${clasificacion.color}`}>
            {clasificacion.letra}
          </span>
          <div>
            <p className={`text-[11px] font-medium uppercase tracking-[0.3px] ${clasificacion.color}`}>
              {clasificacion.label}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor[clasificacion.letra]}`}
          style={{ width: `${Math.min(puntaje, 100)}%` }}
        />
      </div>
    </div>
  )
}
