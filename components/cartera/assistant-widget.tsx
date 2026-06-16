'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bot, X, Sparkles, Maximize2, Minimize2 } from 'lucide-react'
import AssistantChat from '@/components/cartera/assistant-chat'

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const close = useCallback(() => {
    setOpen(false)
    setExpanded(false)
  }, [])

  useEffect(() => {
    if (!open) setExpanded(false)
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (expanded) {
        setExpanded(false)
      } else {
        close()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, expanded, close])

  useEffect(() => {
    if (!expanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [expanded])

  return (
    <>
      {/* Panel del chat */}
      <div
        className={`
          fixed z-50 flex flex-col bg-white transition-all duration-200
          ${expanded
            ? 'inset-0 w-full h-full rounded-none border-0 shadow-none'
            : `bottom-24 right-4 md:right-6
               w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-9rem)]
               rounded-2xl border border-border shadow-2xl shadow-navy/10
               origin-bottom-right
               ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`
          }
        `}
        role="dialog"
        aria-label="Asistente CrediFlexi"
        aria-hidden={!open}
        aria-modal={expanded}
      >
        {/* Header del panel */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-navy text-white flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-[13px] font-semibold text-navy leading-tight truncate">
                  Asistente CrediFlexi
                </p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange/10 text-orange-dark border border-orange/20 font-medium shrink-0">
                  BETA
                </span>
              </div>
              <p className="text-[10.5px] text-ink-400 leading-tight truncate">
                {expanded ? 'Pantalla completa' : 'Datos en vivo de cartera'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              aria-label={expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
              title={expanded ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
              className="w-8 h-7 rounded-md border border-border bg-surface-hover/40 text-ink-600 hover:text-navy hover:bg-surface-hover flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar asistente"
              className="w-7 h-7 rounded-md text-ink-400 hover:text-navy hover:bg-surface-hover flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Cuerpo: reusa el chat completo */}
        <div className={`flex-1 min-h-0 px-4 pb-3 ${expanded ? 'max-w-4xl w-full mx-auto' : ''}`}>
          <AssistantChat />
        </div>
      </div>

      {/* FAB: oculto en pantalla completa (el header tiene los controles) */}
      {!expanded && (
        <button
          onClick={() => (open ? close() : setOpen(true))}
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
      )}
    </>
  )
}
