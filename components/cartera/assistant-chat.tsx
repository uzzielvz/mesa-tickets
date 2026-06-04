'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, BookOpen } from 'lucide-react'

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
  { label: 'Diferencia legacy Excel vs plataforma', q: 'Cuál es la diferencia entre el Excel legacy y los dashboards nuevos' },
  { label: 'Qué es el Asistente / Chat IA', q: 'Para qué sirve este Chat IA y qué podrá hacer en el futuro' },
  { label: 'Roles y accesos (acceso_cartera)', q: 'Cómo funcionan los roles y el flag acceso_cartera' },
]

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hola. Soy el Asistente CrediFlexi (demo). Puedo ayudarte con dudas sobre la empresa (cartera, reportes de antigüedad, PAR, etc.) y sobre cómo usar la plataforma mea-tickets (carga de reportes, dashboards, tickets, roles).\n\nEscribe tu pregunta o usa una de las sugerencias de abajo.',
    },
  ])
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

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: Message & { suggestions?: string[] } = {
        role: 'assistant',
        content: data.content || 'Lo siento, no pude generar una respuesta en este momento.',
        sources: data.sources,
        suggestions: data.suggestions,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Hubo un problema al consultar el asistente. Intenta de nuevo en unos segundos o reformula tu pregunta con palabras clave (PAR, cargar, mora, tickets, roles, legacy...).',
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

  function useSuggestion(q: string) {
    sendMessage(q)
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#ECECEC]">
        <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center">
          <Bot size={18} />
        </div>
        <div>
          <div className="font-medium text-[15px]">Asistente CrediFlexi</div>
          <div className="text-[11px] text-ink-400">Demo • Conocimiento de empresa + plataforma</div>
        </div>
        <div className="ml-auto text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
          MODO DEMO
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-2">
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
                  inline-block rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap
                  ${m.role === 'user'
                    ? 'bg-[#2c2c2c] text-white rounded-br-md'
                    : 'bg-white border border-[#ECECEC] text-ink-700 rounded-bl-md'
                  }
                `}
              >
                {m.content}
              </div>

              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.sources.map((s, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] text-ink-400 bg-surface px-2 py-0.5 rounded border border-[#EDEDED]"
                    >
                      <BookOpen size={11} /> {s}
                    </div>
                  ))}
                </div>
              )}

              {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => useSuggestion(sug)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-[#D1D5DB] hover:bg-white text-ink-600 transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {m.role === 'user' && (
              <div className="w-7 h-7 mt-0.5 rounded-full bg-ink-200 text-ink-700 flex items-center justify-center shrink-0">
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
            <div className="bg-white border border-[#ECECEC] rounded-2xl px-4 py-3 text-[13px] text-ink-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Pensando...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length < 3 && (
        <div className="pb-3">
          <div className="text-[10.5px] uppercase tracking-[0.5px] text-ink-400 mb-2">Sugerencias rápidas</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => useSuggestion(s.q)}
                className="text-[12px] px-3 py-1 rounded-full border border-[#E6E6E6] hover:bg-surface-hover hover:border-[#D9D9D9] transition-colors text-ink-600"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-3 border-t border-[#ECECEC]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre la empresa, cartera, cómo usar la plataforma, tickets..."
            className="flex-1 rounded-xl border border-[#E6E6E6] px-4 py-3 text-[14px] focus:outline-none focus:border-navy/60 placeholder:text-ink-300"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-navy text-white px-5 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1f1f1f] transition-colors"
          >
            <Send size={17} />
          </button>
        </div>
        <div className="text-[10px] text-ink-300 mt-1.5 pl-1">
          Demo con conocimiento embebido. En producción usaría LLM + RAG sobre documentación + datos en vivo.
        </div>
      </form>
    </div>
  )
}
