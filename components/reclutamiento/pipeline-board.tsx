'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, XCircle } from 'lucide-react'
import { timeAgo } from '@/lib/utils/format'
import { transicionarCandidato } from '@/lib/actions/reclutamiento'
import {
  ETAPAS, ETAPA_LABEL, MOTIVOS_DESCARTE, MOTIVO_DESCARTE_LABEL,
} from '@/lib/schemas/reclutamiento'
import type { RecEtapa, RecMotivoDescarte } from '@/lib/supabase/types'
import type { PipelineCandidato } from '@/app/(dashboard)/reclutamiento/pipeline/page'

interface Vacante {
  id: string
  titulo: string
  estado: 'abierta' | 'cerrada'
}

// Siguiente etapa forward según el DAG (la RPC es la autoridad; esto es solo UX).
const SIGUIENTE_ETAPA: Partial<Record<RecEtapa, RecEtapa>> = {
  postulado: 'en_revision',
  en_revision: 'viable',
  viable: 'entrevistas_agendadas',
  entrevistas_agendadas: 'comite',
  comite: 'final_dg',
  final_dg: 'oferta',
  oferta: 'contratado',
}

const TERMINALES: RecEtapa[] = ['contratado', 'descartado']

// Punto de color por etapa (outlined, sin badges rellenos).
const ETAPA_DOT: Record<RecEtapa, string> = {
  postulado: 'bg-ink-300',
  en_revision: 'bg-navy',
  viable: 'bg-[#15803d]',
  entrevistas_agendadas: 'bg-[#2563eb]',
  comite: 'bg-[#7c3aed]',
  final_dg: 'bg-[#0891b2]',
  oferta: 'bg-[#a16207]',
  contratado: 'bg-[#15803d]',
  descartado: 'bg-[#b91c1c]',
}

const selectClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'
const miniSelectClass =
  'bg-white border border-[#ECECEC] rounded px-1.5 py-[3px] text-[11.5px] text-ink-900 outline-none focus:border-orange transition-all w-full'

export default function PipelineBoard({
  vacantes,
  vacanteId,
  candidatos,
}: {
  vacantes: Vacante[]
  vacanteId: string | null
  candidatos: PipelineCandidato[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<PipelineCandidato[]>(candidatos)
  const [saving, setSaving] = useState<string | null>(null)
  // Candidato a punto de descartarse, en espera de que se elija el motivo.
  const [descartando, setDescartando] = useState<string | null>(null)

  function navegar(vacante: string) {
    router.push(`/reclutamiento/pipeline?vacante=${vacante}`)
  }

  const porEtapa = useMemo(() => {
    const map = new Map<RecEtapa, PipelineCandidato[]>()
    for (const et of ETAPAS) map.set(et, [])
    for (const c of rows) map.get(c.etapa)?.push(c)
    return map
  }, [rows])

  async function mover(id: string, destino: RecEtapa, motivo: RecMotivoDescarte | null) {
    setSaving(id)
    const res = await transicionarCandidato({
      candidato_id: id,
      etapa_destino: destino,
      motivo_descarte: motivo,
    })
    setSaving(null)
    if (res.ok) {
      setRows(prev => prev.map(c => c.id === id
        ? { ...c, etapa: destino, motivo_descarte: destino === 'descartado' ? motivo : null }
        : c))
      setDescartando(null)
      toast.success(`Movido a ${ETAPA_LABEL[destino]}`)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  if (vacantes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[13px] text-ink-400">No hay vacantes. Crea una vacante para armar el pipeline.</p>
        <Link href="/reclutamiento/vacantes/nueva" className="text-[12.5px] font-medium text-navy hover:underline mt-2 inline-block">
          Crear vacante
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro: vacante */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={vacanteId ?? ''}
          onChange={e => navegar(e.target.value)}
          className={selectClass}
        >
          {vacantes.map(v => (
            <option key={v.id} value={v.id}>
              {v.titulo}{v.estado === 'cerrada' ? ' (cerrada)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Tablero */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {ETAPAS.map(etapa => {
          const items = porEtapa.get(etapa) ?? []
          return (
            <div key={etapa} className="flex-shrink-0 w-[220px] flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`w-2 h-2 rounded-full ${ETAPA_DOT[etapa]}`} />
                <span className="text-[12px] font-medium text-ink-700">{ETAPA_LABEL[etapa]}</span>
                <span className="text-[11px] text-ink-400">{items.length}</span>
              </div>

              <div className="flex flex-col gap-2 min-h-[60px] bg-surface-sidebar rounded-md p-2">
                {items.length === 0 ? (
                  <p className="text-[11px] text-ink-300 text-center py-4">—</p>
                ) : items.map(c => {
                  const terminal = TERMINALES.includes(c.etapa)
                  const siguiente = SIGUIENTE_ETAPA[c.etapa]
                  const busy = saving === c.id
                  return (
                    <div key={c.id} className="bg-white border border-[#ECECEC] rounded-md p-2.5 flex flex-col gap-2">
                      <Link href={`/reclutamiento/candidatos/${c.id}/editar`} className="block min-w-0">
                        <p className="text-[12.5px] font-medium text-ink-900 truncate">{c.nombre}</p>
                        <p className="text-[11px] text-ink-400 truncate">
                          {c.email ?? c.telefono ?? '—'} · {timeAgo(c.created_at)}
                        </p>
                      </Link>

                      {c.etapa === 'descartado' && c.motivo_descarte && (
                        <span className="text-[10.5px] text-[#b91c1c]">
                          {MOTIVO_DESCARTE_LABEL[c.motivo_descarte]}
                        </span>
                      )}

                      {!terminal && descartando === c.id ? (
                        <select
                          disabled={busy}
                          defaultValue=""
                          onChange={e => e.target.value && mover(c.id, 'descartado', e.target.value as RecMotivoDescarte)}
                          className={miniSelectClass}
                          autoFocus
                        >
                          <option value="">Motivo del descarte...</option>
                          {MOTIVOS_DESCARTE.map(m => <option key={m} value={m}>{MOTIVO_DESCARTE_LABEL[m]}</option>)}
                        </select>
                      ) : !terminal && (
                        <div className="flex items-center gap-1">
                          {siguiente && (
                            <button
                              onClick={() => mover(c.id, siguiente, null)}
                              disabled={busy}
                              title={`Mover a ${ETAPA_LABEL[siguiente]}`}
                              className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] text-navy border border-[#ECECEC] rounded px-2 py-[3px] hover:bg-surface-hover disabled:opacity-50 transition-colors"
                            >
                              <ArrowRight size={11} />
                              {ETAPA_LABEL[siguiente]}
                            </button>
                          )}
                          <button
                            onClick={() => setDescartando(c.id)}
                            disabled={busy}
                            title="Descartar"
                            className="inline-flex items-center justify-center text-[11px] text-[#b91c1c] border border-[#ECECEC] rounded px-2 py-[3px] hover:bg-[#fee2e2] disabled:opacity-50 transition-colors"
                          >
                            <XCircle size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
