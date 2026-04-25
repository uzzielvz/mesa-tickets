'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { DesgloseLine } from '@/lib/scoring/types'

export default function ScoreDesglose({ desglose }: { desglose: DesgloseLine[] }) {
  const [open, setOpen] = useState(false)
  const total = desglose.reduce((s, d) => s + d.puntos, 0)
  const maximo = desglose.reduce((s, d) => s + d.maximo, 0)

  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors"
      >
        <span className="text-[12.5px] font-medium text-ink-900">Desglose por variable</span>
        <ChevronDown size={14} className={`text-ink-400 transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <>
          <div className="border-t border-[#ECECEC]">
            {/* Header */}
            <div className="hidden md:grid grid-cols-[1fr_80px_70px_120px] px-5 py-2 bg-surface-sidebar border-b border-[#ECECEC]">
              {['Variable', 'Puntos', 'Máx', ''].map(h => (
                <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
              ))}
            </div>

            {desglose.map((line, i) => (
              <div
                key={line.variable}
                className={`grid grid-cols-[1fr_auto] md:grid-cols-[1fr_80px_70px_120px] items-center px-5 py-2.5 gap-2 ${i < desglose.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
              >
                <span className="text-[12.5px] text-ink-700">{line.variable}</span>
                <span className="text-[12.5px] font-medium text-navy">{line.puntos.toFixed(2)}</span>
                <span className="hidden md:block text-[12px] text-ink-400">{line.maximo}</span>
                {/* Mini barra */}
                <div className="hidden md:block h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange rounded-full"
                    style={{ width: `${(line.puntos / line.maximo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="grid grid-cols-[1fr_80px] md:grid-cols-[1fr_80px_70px_120px] items-center px-5 py-3 bg-surface-sidebar border-t border-[#ECECEC]">
            <span className="text-[12.5px] font-semibold text-navy">Total</span>
            <span className="text-[13px] font-semibold text-navy">{total.toFixed(2)}</span>
            <span className="hidden md:block text-[12.5px] font-medium text-ink-400">{maximo}</span>
            <div className="hidden md:block h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-navy rounded-full"
                style={{ width: `${(total / maximo) * 100}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
