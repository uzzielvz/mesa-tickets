'use client'

import { Printer } from 'lucide-react'

export default function ImprimirBoton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-3.5 py-2 transition-colors"
    >
      <Printer size={14} /> Imprimir
    </button>
  )
}
