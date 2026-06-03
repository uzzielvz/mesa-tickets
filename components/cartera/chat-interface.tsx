'use client'

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react'
import { Send, Loader2, Database } from 'lucide-react'
import type { ToolCallInfo } from '@/app/api/cartera/chat/route'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallInfo[]
  isError?: boolean
}

const SUGERENCIAS = [
  '¿Cuál es el estado general de la cartera?',
  '¿Qué coordinación tiene el PAR 30 más alto?',
  '¿Cuántos créditos están en mora actualmente?',
  '¿Quiénes son los recuperadores con más mora?',
]

const TOOL_LABELS: Record<string, string> = {
  cartera_resumen:          'Resumen',
  cartera_por_coordinacion: 'Por coordinación',
  cartera_por_recuperador:  'Por recuperador',
  cartera_mora_operativa:   'Mora operativa',
}

interface Props {
  fechas: string[]
}

export default function ChatInterface({ fechas }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [fecha, setFecha] = useState(fechas[0] ?? '')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || !fecha) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/cartera/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          fecha_corte: fecha,
        }),
      })
      const json = await res.json()
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: json.reply ?? json.error ?? 'Sin respuesta.',
          toolCalls: json.toolCalls,
          isError: !res.ok,
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Error de conexión. Intenta de nuevo.', isError: true },
      ])
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col border border-border rounded-lg bg-white overflow-hidden">
      {/* Barra superior: selector de fecha */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-sidebar shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-500">Corte:</span>
          {fechas.length > 0 ? (
            <select
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="text-[13px] font-medium text-navy border border-border rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-navy/30"
            >
              {fechas.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] text-ink-400">Sin cortes</span>
          )}
        </div>
        <span className="text-[11px] text-ink-400">Datos directos · LLM pendiente</span>
      </div>

      {/* Área de mensajes */}
      <div
        ref={scrollRef}
        className="overflow-y-auto px-4 py-4 flex flex-col gap-3"
        style={{ minHeight: '300px', maxHeight: 'calc(100vh - 340px)' }}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-[12.5px] text-ink-400">Pregunta sobre tu cartera:</p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  disabled={!fecha}
                  className="text-[12px] text-navy border border-border rounded-full px-3 py-1.5 hover:bg-surface-hover transition-colors disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={[
                'max-w-[90%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-navy text-white'
                  : msg.isError
                    ? 'bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]'
                    : 'bg-surface-sidebar border border-border text-ink-900 font-mono text-[12px]',
              ].join(' ')}
            >
              {msg.content}
            </div>

            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {msg.toolCalls.map((tc, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[10.5px] text-ink-400 border border-border rounded px-1.5 py-0.5 bg-white"
                  >
                    <Database className="w-2.5 h-2.5" />
                    {TOOL_LABELS[tc.name] ?? tc.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-surface-sidebar border border-border rounded-lg px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 text-ink-400 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-white shrink-0">
        {fechas.length === 0 ? (
          <p className="px-4 py-3 text-[12.5px] text-ink-400">
            No hay cortes procesados.{' '}
            <a href="/cartera/cargar" className="text-navy hover:underline">
              Sube un reporte
            </a>{' '}
            para usar el chat.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta algo sobre tu cartera… (Enter para enviar)"
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none text-[13px] text-ink-900 placeholder:text-ink-400 border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-navy/30 max-h-28 overflow-y-auto"
              style={{ minHeight: '38px' }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-navy text-white rounded-md hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
