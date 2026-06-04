'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  suggestions?: string[]
}

const SUGGESTIONS = [
  { label: '¿Qué son los buckets de PAR?', q: 'Qué son los buckets de PAR y por qué importan' },
  { label: 'Cómo cargo un reporte de cartera', q: 'Cómo cargo un reporte de cartera paso a paso' },
  { label: 'Qué muestra la Bandeja de mora', q: 'Qué es la bandeja de mora y cómo se usa' },
  { label: 'Cómo levantar un ticket', q: 'Cómo y cuándo debo levantar un ticket' },
  { label: 'Legacy Excel vs plataforma', q: 'Cuál es la diferencia entre el Excel legacy y los dashboards nuevos' },
  { label: 'Roles y accesos (acceso_cartera)', q: 'Cómo funcionan los roles y el flag acceso_cartera' },
]

const PILL_CLASS =
  'text-[11.5px] px-3 py-1 rounded-full border border-border text-ink-600 hover:bg-surface-hover hover:border-ink-400/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30'

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-12 h-12 rounded-full bg-navy text-white flex items-center justify-center mb-4">
        <Bot size={22} />
      </div>
      <h2 className="text-[17px] font-semibold text-navy">¿En qué te ayudo?</h2>
      <p className="text-[13px] text-ink-500 mt-1 max-w-md">
        Pregúntame sobre la empresa (cartera, reportes de antigüedad, PAR) o sobre cómo usar la
        plataforma (carga de reportes, dashboards, tickets, roles).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-xl">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.q)}
            className="text-left rounded-md border border-border bg-white px-3.5 py-2.5 text-[13px] text-ink-700 hover:border-ink-400/40 hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Error en el asistente')
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.content || 'Lo siento, no pude generar una respuesta en este momento.',
          sources: data.sources,
          suggestions: data.suggestions,
        },
      ])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Hubo un problema al consultar el asistente. Intenta de nuevo en unos segundos o reformula tu pregunta con palabras clave (PAR, cargar, mora, tickets, roles, legacy...).',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  const hasConversation = messages.length > 0

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Mensajes / empty state */}
      <div className="flex-1 overflow-y-auto py-6 pr-1">
        {!hasConversation ? (
          <EmptyState onPick={sendMessage} />
        ) : (
          <div className="space-y-6">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 mt-0.5 rounded-full bg-navy text-white flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                )}

                <div className={`max-w-[82%] ${m.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`
                      inline-block rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-left
                      ${m.role === 'user'
                        ? 'bg-ink-900 text-white rounded-br-md'
                        : 'bg-white border border-border text-ink-700 rounded-bl-md'
                      }
                    `}
                  >
                    {m.content}
                  </div>

                  {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                    <div className="mt-1.5 text-[10.5px] text-ink-400">
                      Fuentes: {m.sources.join(' · ')}
                    </div>
                  )}

                  {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.suggestions.map((sug, i) => (
                        <button key={i} onClick={() => sendMessage(sug)} className={PILL_CLASS}>
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-7 h-7 mt-0.5 rounded-full bg-surface-hover text-ink-700 border border-border flex items-center justify-center shrink-0">
                    <User size={14} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 mt-0.5 rounded-full bg-navy text-white flex items-center justify-center shrink-0">
                  <Bot size={14} />
                </div>
                <div className="bg-white border border-border rounded-2xl px-4 py-3 text-[13px] text-ink-400 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Pensando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre la empresa, cartera, cómo usar la plataforma, tickets..."
            className="flex-1 rounded-xl border border-border px-4 py-3 text-[14px] focus:outline-none focus:border-navy/60 placeholder:text-ink-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-navy text-white px-5 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-navy/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
          >
            <Send size={17} />
          </button>
        </div>
        <div className="text-[10px] text-ink-400 mt-1.5 pl-1">
          Demo con conocimiento embebido. En producción usaría LLM + RAG sobre documentación y datos en vivo.
        </div>
      </form>
    </div>
  )
}
