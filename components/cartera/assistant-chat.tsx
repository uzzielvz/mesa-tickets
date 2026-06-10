'use client'

import { useState, useRef, useEffect, memo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send,
  Bot,
  Loader2,
  Database,
  Square,
  RotateCcw,
  Sparkles,
} from 'lucide-react'

const SUGGESTIONS = [
  { label: '¿Cómo está la cartera al último corte?', q: 'Dame el resumen de la cartera al último corte' },
  { label: '¿Qué coordinación tiene más riesgo?', q: 'Qué coordinación tiene el PAR>30 más alto al último corte y cómo se compara con las demás' },
  { label: 'Top de morosos', q: 'Cuáles son los créditos con más días de mora al último corte' },
  { label: '¿Qué son los buckets de PAR?', q: 'Qué son los buckets de PAR y por qué importan' },
  { label: 'Cómo cargo un reporte de cartera', q: 'Cómo cargo un reporte de cartera paso a paso' },
  { label: 'Legacy Excel vs plataforma', q: 'Cuál es la diferencia entre el Excel legacy y los dashboards nuevos' },
]

/** Etiquetas amigables para mostrar qué datos consultó el agente. */
const TOOL_LABELS: Record<string, string> = {
  obtenerFechasDisponibles: 'fechas de corte',
  obtenerResumenCartera: 'resumen de cartera',
  obtenerPorCoordinacion: 'cartera por coordinación',
  obtenerPorRecuperador: 'cartera por recuperador',
  obtenerMora: 'bandeja de mora',
  obtenerCohort: 'cohortes',
}

function toolLabel(partType: string) {
  const name = partType.slice('tool-'.length)
  return TOOL_LABELS[name] ?? name
}

/* ---------------------------------- Markdown ---------------------------------- */

const MarkdownMessage = memo(function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="text-[13.5px] leading-relaxed text-ink-700 space-y-2.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2.5">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-navy">{children}</strong>,
          ul: ({ children }) => <ul className="my-2.5 space-y-1.5 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 space-y-1.5 pl-5 list-decimal marker:text-ink-400">{children}</ol>,
          li: ({ children }) => (
            <li className="flex gap-2 [ol_&]:block [ol_&]:pl-0">
              <span className="text-orange mt-[1px] shrink-0 select-none [ol_&]:hidden">›</span>
              <span className="min-w-0">{children}</span>
            </li>
          ),
          h1: ({ children }) => <h3 className="text-[14px] font-semibold text-navy mt-4 mb-1.5">{children}</h3>,
          h2: ({ children }) => <h3 className="text-[14px] font-semibold text-navy mt-4 mb-1.5">{children}</h3>,
          h3: ({ children }) => <h4 className="text-[13.5px] font-semibold text-navy mt-3 mb-1">{children}</h4>,
          a: ({ href, children }) => (
            <a href={href} className="text-navy underline decoration-orange/50 underline-offset-2 hover:decoration-orange">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-surface-hover border border-border px-1.5 py-0.5 text-[12px] font-mono text-navy">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[12.5px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-hover">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-navy text-[11.5px] uppercase tracking-wide border-b border-border whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 border-b border-border/60 last:border-b-0 text-ink-700 whitespace-nowrap">
              {children}
            </td>
          ),
          tr: ({ children }) => <tr className="last:[&>td]:border-b-0">{children}</tr>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-orange/60 pl-3 my-2.5 text-ink-500 italic">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})

/* --------------------------------- Empty state --------------------------------- */

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl bg-navy text-white flex items-center justify-center shadow-lg shadow-navy/20">
          <Bot size={26} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange text-white flex items-center justify-center border-2 border-white">
          <Sparkles size={10} />
        </div>
      </div>
      <h2 className="text-[18px] font-semibold text-navy">¿En qué te ayudo?</h2>
      <p className="text-[13px] text-ink-500 mt-1.5 max-w-md leading-relaxed">
        Pregúntame sobre la cartera con datos en vivo (PAR, mora, coordinaciones, recuperadores) o
        sobre cómo usar la plataforma (carga de reportes, dashboards, tickets, roles).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-7 w-full max-w-xl">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.q)}
            className="group text-left rounded-lg border border-border bg-white px-3.5 py-2.5 text-[13px] text-ink-700 hover:border-orange/40 hover:bg-orange/[0.03] hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
          >
            <span className="text-orange/70 mr-1.5 group-hover:text-orange transition-colors">›</span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------ Chat ------------------------------------ */

export default function AssistantChat() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/assistant' }),
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus()
  }, [isLoading])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    sendMessage({ text: trimmed })
    setInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  const hasConversation = messages.length > 0
  const lastMessage = messages[messages.length - 1]

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Barra superior de la conversación */}
      {hasConversation && (
        <div className="flex items-center justify-end pt-2 pb-1">
          <button
            onClick={() => {
              stop()
              setMessages([])
              setInput('')
            }}
            className="flex items-center gap-1.5 text-[11.5px] text-ink-400 hover:text-navy px-2 py-1 rounded-md hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
          >
            <RotateCcw size={12} />
            Nueva conversación
          </button>
        </div>
      )}

      {/* Mensajes / empty state */}
      <div className="flex-1 overflow-y-auto py-4 pr-1">
        {!hasConversation ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="space-y-7">
            {messages.map((m, idx) => {
              const isLast = idx === messages.length - 1
              const text = m.parts
                .filter(p => p.type === 'text')
                .map(p => (p as { type: 'text'; text: string }).text)
                .join('')

              const toolParts = m.parts.filter(p => p.type.startsWith('tool-'))
              const toolsDone = Array.from(
                new Set(
                  toolParts
                    .filter(p => {
                      const state = (p as { state?: string }).state
                      return state === 'output-available' || state === 'output-error'
                    })
                    .map(p => toolLabel(p.type))
                )
              )
              const toolsPending = Array.from(
                new Set(
                  toolParts
                    .filter(p => {
                      const state = (p as { state?: string }).state
                      return state !== 'output-available' && state !== 'output-error'
                    })
                    .map(p => toolLabel(p.type))
                )
              )

              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy text-white px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-sm">
                      {text}
                    </div>
                  </div>
                )
              }

              return (
                <div key={m.id} className="flex gap-3">
                  <div className="w-7 h-7 mt-0.5 rounded-lg bg-navy text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bot size={14} />
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    {/* Tools consultadas (terminadas) */}
                    {toolsDone.length > 0 && (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        {toolsDone.map(t => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full bg-surface-hover border border-border px-2 py-0.5 text-[10.5px] text-ink-500"
                          >
                            <Database size={9} className="text-orange" />
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tool ejecutándose en vivo */}
                    {isLast && isLoading && toolsPending.length > 0 && (
                      <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-ink-500">
                        <Loader2 size={12} className="animate-spin text-orange" />
                        Consultando {toolsPending.join(', ')}…
                      </div>
                    )}

                    {text ? (
                      <MarkdownMessage text={text} />
                    ) : (
                      isLast &&
                      isLoading &&
                      toolsPending.length === 0 && (
                        <div className="flex items-center gap-2 text-[13px] text-ink-400 py-1">
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-ink-400/60 animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-ink-400/60 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-ink-400/60 animate-bounce [animation-delay:300ms]" />
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            })}

            {/* Esperando primera respuesta del servidor */}
            {status === 'submitted' && lastMessage?.role === 'user' && (
              <div className="flex gap-3">
                <div className="w-7 h-7 mt-0.5 rounded-lg bg-navy text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot size={14} />
                </div>
                <div className="flex items-center gap-2 text-[13px] text-ink-400 pt-1.5">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-400/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-400/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-400/60 animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex gap-3">
                <div className="w-7 h-7 mt-0.5 rounded-lg bg-navy text-white flex items-center justify-center shrink-0">
                  <Bot size={14} />
                </div>
                <div className="bg-[#FFEBEE] border border-[#FFCDD2] rounded-xl px-4 py-3 text-[13px] text-[#C62828]">
                  Hubo un problema al consultar el asistente. Intenta de nuevo en unos segundos.
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-3 border-t border-border">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-2 py-1.5 shadow-sm focus-within:border-navy/50 focus-within:ring-2 focus-within:ring-navy/10 transition-all">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre la cartera, los dashboards, tickets, roles..."
            className="flex-1 bg-transparent px-2.5 py-2 text-[14px] focus:outline-none placeholder:text-ink-400"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              title="Detener respuesta"
              className="w-9 h-9 rounded-lg bg-ink-900 text-white flex items-center justify-center hover:bg-ink-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-navy/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
            >
              <Send size={15} />
            </button>
          )}
        </div>
        <div className="text-[10px] text-ink-400 mt-1.5 pl-1">
          Consulta datos en vivo de cartera (seudonimizados). Verifica cifras críticas en los dashboards.
        </div>
      </form>
    </div>
  )
}
