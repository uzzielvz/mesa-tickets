'use client'

import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { leyendaEstado, pesos, type EstadoConciliacion, type FilaConciliacion } from '@/lib/auditor/tipos'

const sinCeros = (s: string) => s.replace(/^0+(?=\d)/, '')
const fecha = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Color por estado: semántico, aparte del acento de la marca. */
const TONO: Record<EstadoConciliacion, string> = {
  listo: 'bg-[#E8F5E9] text-[#2E7D32]',
  sin_registro: 'bg-[#FFEBEE] text-[#C62828]',
  diferencia: 'bg-[#FFF8E1] text-[#8A6100]',
  un_registro: 'bg-[#E7EEF9] text-[#1A3B70]',
}

/**
 * Una fila por grupo, ciclo y fecha de depósito. Si ese día hubo más de un
 * depósito, la fila se despliega para ver cada uno y la suma. Sin gerente ni
 * promotor: "al promotor no le interesa ni su gerente ni su promotor" (Felix).
 */
export default function TablaConciliacion({ filas }: { filas: FilaConciliacion[] }) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const alternar = (k: string) =>
    setAbiertas(prev => {
      const s = new Set(prev)
      if (s.has(k)) s.delete(k); else s.add(k)
      return s
    })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-[0.3px] text-ink-400 border-b border-[#ECECEC]">
            <th className="pl-5 pr-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Grupo</th>
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Ciclo</th>
            <th className="px-3 py-2 font-medium">Semana</th>
            <th className="px-3 py-2 font-medium text-right">Depositado</th>
            <th className="px-3 py-2 font-medium text-right">Registrado</th>
            <th className="pl-3 pr-5 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const k = `${f.grupo_id}-${f.ciclo}-${f.fecha_deposito}`
            const varios = f.n_depositos > 1
            const abierta = abiertas.has(k)
            return (
              <Fragment key={k}>
                <tr
                  onClick={varios ? () => alternar(k) : undefined}
                  className={`border-b border-[#F5F5F5] ${varios ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
                >
                  <td className="pl-5 pr-3 py-2.5 text-ink-700 whitespace-nowrap">
                    {varios ? (
                      <button
                        type="button"
                        aria-expanded={abierta}
                        aria-label={`${abierta ? 'Ocultar' : 'Ver'} los ${f.n_depositos} depósitos`}
                        className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30 rounded"
                        onClick={e => { e.stopPropagation(); alternar(k) }}
                      >
                        <ChevronRight size={13} className={`text-ink-400 transition-transform ${abierta ? 'rotate-90' : ''}`} />
                        {fecha(f.fecha_deposito)}
                      </button>
                    ) : (
                      <span className="pl-[17px]">{fecha(f.fecha_deposito)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-ink-900 font-medium tabular-nums">{sinCeros(f.grupo_id)}</td>
                  <td className="px-3 py-2.5 text-ink-700">{f.nombre_grupo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-ink-700 tabular-nums">{sinCeros(f.ciclo)}</td>
                  <td className="px-3 py-2.5 text-ink-700 tabular-nums">{f.semanas.length ? f.semanas.join(', ') : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 font-medium whitespace-nowrap">
                    {pesos(Number(f.monto_depositado))}
                    {varios && <span className="block text-[11px] text-ink-400 font-normal">{f.n_depositos} depósitos</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-700 whitespace-nowrap">
                    {f.n_registros > 0 ? pesos(Number(f.monto_registrado)) : '—'}
                    {f.n_registros > 1 && <span className="block text-[11px] text-ink-400">{f.n_registros} registros</span>}
                  </td>
                  <td className="pl-3 pr-5 py-2.5">
                    <span className={`inline-block text-[11.5px] font-medium rounded px-2 py-[2px] whitespace-nowrap ${TONO[f.estado]}`}>
                      {leyendaEstado({ estado: f.estado, diferencia: Number(f.diferencia) })}
                    </span>
                  </td>
                </tr>
                {varios && abierta && (
                  <tr className="border-b border-[#F5F5F5] bg-surface-sidebar">
                    <td colSpan={8} className="pl-12 pr-5 py-2.5">
                      <ul className="flex flex-col gap-1 max-w-sm">
                        {f.depositos.map((d, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-4 text-[12px] text-ink-700 tabular-nums">
                            <span>Depósito {i + 1}{d.periodo !== null && <span className="text-ink-400"> · semana {d.periodo}</span>}</span>
                            <span>{pesos(Number(d.monto))}</span>
                          </li>
                        ))}
                        <li className="flex items-baseline justify-between gap-4 text-[12px] text-ink-900 font-medium border-t border-[#E6E6E3] pt-1 tabular-nums">
                          <span>Suma</span>
                          <span>{pesos(Number(f.monto_depositado))}</span>
                        </li>
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
