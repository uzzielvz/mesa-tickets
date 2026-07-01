'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { timeAgo } from '@/lib/utils/format'

interface Vacante {
  id: string
  titulo: string
  area: string | null
  estado: 'abierta' | 'cerrada'
  created_at: string
  candidatos: number
}

export default function VacanteList({ vacantes }: { vacantes: Vacante[] }) {
  const [q, setQ] = useState('')
  const [soloAbiertas, setSoloAbiertas] = useState(false)

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase()
    return vacantes.filter(v => {
      if (soloAbiertas && v.estado !== 'abierta') return false
      if (!term) return true
      return (
        v.titulo.toLowerCase().includes(term) ||
        (v.area ?? '').toLowerCase().includes(term)
      )
    })
  }, [vacantes, q, soloAbiertas])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por título o área..."
          className="flex-1 min-w-[200px] max-w-sm bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all"
        />
        <label className="flex items-center gap-2 text-[12.5px] text-ink-500 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={soloAbiertas}
            onChange={e => setSoloAbiertas(e.target.checked)}
            className="accent-navy"
          />
          Solo abiertas
        </label>
      </div>

      {filtradas.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-ink-400">
            {vacantes.length === 0 ? 'No hay vacantes registradas.' : 'Sin resultados.'}
          </p>
        </div>
      ) : (
        <div className="border border-[#ECECEC] rounded-md overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_180px_110px_110px] px-5 py-2 bg-surface-sidebar border-b border-[#ECECEC]">
            {['Vacante', 'Área', 'Candidatos', 'Estado'].map(h => (
              <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
            ))}
          </div>

          {filtradas.map((v, i) => (
            <Link
              key={v.id}
              href={`/reclutamiento/vacantes/${v.id}/editar`}
              className={`block md:grid md:grid-cols-[1fr_180px_110px_110px] items-center px-5 py-3 hover:bg-surface-hover transition-colors ${i < filtradas.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
            >
              <div>
                <p className="text-[13px] font-medium text-ink-900">{v.titulo}</p>
                <p className="text-[11.5px] text-ink-400">
                  {timeAgo(v.created_at)}
                  <span className="md:hidden"> · {v.candidatos} candidato{v.candidatos !== 1 ? 's' : ''}</span>
                </p>
              </div>
              <span className="hidden md:block text-[12.5px] text-ink-700">{v.area ?? '—'}</span>
              <span className="hidden md:block text-[12.5px] text-ink-700">{v.candidatos}</span>
              <div className="hidden md:block">
                <span className={`inline-flex items-center gap-1.5 text-[11.5px] ${v.estado === 'abierta' ? 'text-ink-700' : 'text-ink-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${v.estado === 'abierta' ? 'bg-navy' : 'bg-ink-300'}`} />
                  {v.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
