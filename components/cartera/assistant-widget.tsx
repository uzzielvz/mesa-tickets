'use client'

import { useState } from 'react'
import { Bot, X, Sparkles } from 'lucide-react'
import AssistantChat from '@/components/cartera/assistant-chat'

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Panel del chat */}
      <div
        className={`
          fixed bottom-24 right-4 md:right-6 z-50
          w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-9rem)]
          flex flex-col rounded-2xl border border-border bg-white shadow-2xl shadow-navy/10
          origin-bottom-right transition-all duration-200
          ${open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'}
        `}
        role="dialog"
        aria-label="Asistente CrediFlexi"
        aria-hidden={!open}
      >
        {/* Header del panel */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-navy text-white flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-navy leading-tight truncate">
                Asistente CrediFlexi
              </p>
              <p className="text-[10.5px] text-ink-400 leading-tight">Datos en vivo de cartera</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange/10 text-orange-dark border border-orange/20 font-medium shrink-0">
              BETA
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar asistente"
            className="w-7 h-7 rounded-md text-ink-400 hover:text-navy hover:bg-surface-hover flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cuerpo: reusa el chat completo */}
        <div className="flex-1 min-h-0 px-4 pb-3">
          <AssistantChat />
        </div>
      </div>

      {/* Botón flotante (FAB) */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente IA'}
        aria-expanded={open}
        className="
          fixed bottom-6 right-4 md:right-6 z-50
          w-14 h-14 rounded-full bg-navy text-white
          flex items-center justify-center
          shadow-lg shadow-navy/25 hover:shadow-xl hover:shadow-navy/30
          hover:scale-105 active:scale-95 transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 focus-visible:ring-offset-2
        "
      >
        {open ? (
          <X size={22} />
        ) : (
          <span className="relative">
            <Bot size={24} />
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-orange text-white flex items-center justify-center border-2 border-navy">
              <Sparkles size={7} />
            </span>
          </span>
        )}
      </button>
    </>
  )
}
