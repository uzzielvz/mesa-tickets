'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { timeAgo } from '@/lib/utils/format'
import { clasificar } from '@/lib/scoring/modelo'

interface Acreditado {
  id: string
  numero: number
  clave: string
  nombre_completo: string
  ciclo: string
  puntaje_total: number | null
  clasificacion_modelo: string | null
  calificacion_promotor: string | null
  created_at: string
  contador_ediciones: number
}

const letraBg: Record<string, string> = {
  A: 'bg-[#dcfce7] text-[#15803d]',
  B: 'bg-[#fef9c3] text-[#a16207]',
  C: 'bg-[#ffedd5] text-[#c2410c]',
  D: 'bg-[#fee2e2] text-[#b91c1c]',
}

export default function AcreditadoList({
  acreditados,
  emptyMessage = 'No hay registros.',
}: {
  acreditados: Acreditado[]
  emptyMessage?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    router.push(`/score/acreditados?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Buscador */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre o clave..."
          className="flex-1 bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all"
        />
        <button
          type="submit"
          className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
        >
          Buscar
        </button>
        {searchParams.get('q') && (
          <button
            type="button"
            onClick={() => { setQ(''); router.push('/score/acreditados') }}
            className="border border-[#ECECEC] text-ink-700 text-[12.5px] font-medium rounded px-3 py-[7px] hover:bg-surface-hover transition-colors"
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Tabla */}
      {acreditados.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-ink-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="border border-[#ECECEC] rounded-md overflow-hidden">
          {/* Header desktop */}
          <div className="hidden md:grid grid-cols-[60px_1fr_80px_100px_100px_100px] px-5 py-2 bg-surface-sidebar border-b border-[#ECECEC]">
            {['#', 'Nombre', 'Clave', 'Score', 'Modelo', 'Promotor'].map(h => (
              <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
            ))}
          </div>

          {acreditados.map((a, i) => {
            const clasif = a.clasificacion_modelo ? clasificar(a.puntaje_total ?? 0) : null
            return (
              <Link
                key={a.id}
                href={`/score/acreditados/${a.numero}`}
                className={`block md:grid md:grid-cols-[60px_1fr_80px_100px_100px_100px] items-center px-5 py-3 hover:bg-surface-hover transition-colors ${i < acreditados.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
              >
                {/* Número */}
                <span className="hidden md:block text-[12px] font-medium text-navy font-mono">
                  {a.numero}
                </span>

                {/* Nombre + mobile info */}
                <div>
                  <div className="flex items-center gap-2 md:hidden mb-0.5">
                    <span className="text-[11px] font-mono text-ink-400">#{a.numero}</span>
                    <span className="text-[11px] text-ink-400">{a.clave}</span>
                    {clasif && (
                      <span className={`text-[10px] font-bold px-1.5 py-px rounded ${letraBg[clasif.letra]}`}>
                        {clasif.letra}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-medium text-ink-900">{a.nombre_completo}</p>
                  <p className="text-[11.5px] text-ink-400">Ciclo {a.ciclo} · {timeAgo(a.created_at)}</p>
                </div>

                {/* Clave */}
                <span className="hidden md:block text-[12.5px] text-ink-700 font-mono">{a.clave}</span>

                {/* Score */}
                <span className="hidden md:block text-[12.5px] font-medium text-navy">
                  {a.puntaje_total !== null ? a.puntaje_total.toFixed(1) : '—'}
                </span>

                {/* Clasificación modelo */}
                <div className="hidden md:block">
                  {clasif ? (
                    <span className={`text-[11px] font-bold px-2 py-1 rounded ${letraBg[clasif.letra]}`}>
                      {clasif.letra} — {clasif.label}
                    </span>
                  ) : <span className="text-ink-400 text-[12px]">—</span>}
                </div>

                {/* Calificación promotor */}
                <div className="hidden md:block">
                  {a.calificacion_promotor ? (
                    <span className={`text-[11px] font-bold px-2 py-1 rounded ${letraBg[a.calificacion_promotor]}`}>
                      {a.calificacion_promotor}
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-400">Pendiente</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
