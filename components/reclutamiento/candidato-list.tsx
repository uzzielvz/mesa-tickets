'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FileText, ExternalLink } from 'lucide-react'
import { timeAgo } from '@/lib/utils/format'
import { urlFirmadaCv, actualizarRevisionCandidato } from '@/lib/actions/reclutamiento'
import {
  ETAPAS, ETAPA_LABEL, FUENTE_LABEL, REVISIONES_CV, REVISION_CV_LABEL,
  MOTIVOS_DESCARTE, MOTIVO_DESCARTE_LABEL,
} from '@/lib/schemas/reclutamiento'
import type { RecEtapa } from '@/lib/supabase/types'

interface Candidato {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  fuente: string | null
  etapa: RecEtapa
  revision_cv: string | null
  motivo_descarte: string | null
  cv_storage_path: string | null
  created_at: string
}

interface Vacante {
  id: string
  titulo: string
  estado: 'abierta' | 'cerrada'
}

const REVISION_BADGE: Record<string, string> = {
  viable: 'bg-[#dcfce7] text-[#15803d]',
  parcial: 'bg-[#fef9c3] text-[#a16207]',
  no_viable: 'bg-[#fee2e2] text-[#b91c1c]',
}

const selectClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'
const miniSelectClass =
  'bg-white border border-[#ECECEC] rounded px-1.5 py-[3px] text-[11.5px] text-ink-900 outline-none focus:border-orange transition-all'

export default function CandidatoList({
  vacantes,
  vacanteId,
  candidatos,
  etapaFiltro,
}: {
  vacantes: Vacante[]
  vacanteId: string | null
  candidatos: Candidato[]
  etapaFiltro: string
}) {
  const router = useRouter()
  const [abriendoCv, setAbriendoCv] = useState<string | null>(null)
  const [rows, setRows] = useState<Candidato[]>(candidatos)
  const [savingRev, setSavingRev] = useState<string | null>(null)
  // Candidato marcado no_viable en espera de que se elija el motivo.
  const [motivoPendiente, setMotivoPendiente] = useState<string | null>(null)

  function navegar(vacante: string | null, etapa: string) {
    const params = new URLSearchParams()
    if (vacante) params.set('vacante', vacante)
    if (etapa) params.set('etapa', etapa)
    router.push(`/reclutamiento/candidatos?${params.toString()}`)
  }

  const filtrados = useMemo(() => {
    if (!etapaFiltro) return rows
    return rows.filter(c => c.etapa === etapaFiltro)
  }, [rows, etapaFiltro])

  async function guardarRevision(id: string, revision: string, motivo: string | null) {
    setSavingRev(id)
    const res = await actualizarRevisionCandidato(id, { revision_cv: revision, motivo_descarte: motivo })
    setSavingRev(null)
    if (res.ok) {
      setRows(prev => prev.map(c => c.id === id
        ? { ...c, revision_cv: revision, motivo_descarte: revision === 'no_viable' ? motivo : null }
        : c))
      setMotivoPendiente(null)
      toast.success('Revisión guardada')
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  function onCambioRevision(id: string, revision: string) {
    if (!revision) return
    if (revision === 'no_viable') {
      // Requiere motivo: mostrar el selector inline antes de persistir.
      setMotivoPendiente(id)
      setRows(prev => prev.map(c => c.id === id ? { ...c, revision_cv: 'no_viable' } : c))
    } else {
      setMotivoPendiente(null)
      guardarRevision(id, revision, null)
    }
  }

  async function abrirCv(c: Candidato) {
    if (!c.cv_storage_path) return
    setAbriendoCv(c.id)
    const res = await urlFirmadaCv(c.cv_storage_path)
    setAbriendoCv(null)
    if (res.ok) {
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } else {
      toast.error(res.error)
    }
  }

  if (vacantes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[13px] text-ink-400">No hay vacantes. Crea una vacante para registrar candidatos.</p>
        <Link href="/reclutamiento/vacantes/nueva" className="text-[12.5px] font-medium text-navy hover:underline mt-2 inline-block">
          Crear vacante
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros: vacante + etapa */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={vacanteId ?? ''}
          onChange={e => navegar(e.target.value, '')}
          className={selectClass}
        >
          {vacantes.map(v => (
            <option key={v.id} value={v.id}>
              {v.titulo}{v.estado === 'cerrada' ? ' (cerrada)' : ''}
            </option>
          ))}
        </select>

        <select
          value={etapaFiltro}
          onChange={e => navegar(vacanteId, e.target.value)}
          className={selectClass}
        >
          <option value="">Todas las etapas</option>
          {ETAPAS.map(et => (
            <option key={et} value={et}>{ETAPA_LABEL[et]}</option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-ink-400">
            {candidatos.length === 0 ? 'Sin candidatos en esta vacante.' : 'Sin candidatos en esta etapa.'}
          </p>
        </div>
      ) : (
        <div className="border border-[#ECECEC] rounded-md overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_150px_110px_70px] px-5 py-2 bg-surface-sidebar border-b border-[#ECECEC]">
            {['Candidato', 'Fuente', 'Etapa', 'Revisión', 'CV'].map(h => (
              <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
            ))}
          </div>

          {filtrados.map((c, i) => (
            <div
              key={c.id}
              className={`md:grid md:grid-cols-[1fr_120px_150px_110px_70px] items-center px-5 py-3 hover:bg-surface-hover transition-colors ${i < filtrados.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
            >
              <Link href={`/reclutamiento/candidatos/${c.id}/editar`} className="block min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{c.nombre}</p>
                <p className="text-[11.5px] text-ink-400 truncate">
                  {c.email ?? c.telefono ?? '—'} · {timeAgo(c.created_at)}
                </p>
              </Link>

              <span className="hidden md:block text-[12.5px] text-ink-700">
                {c.fuente ? FUENTE_LABEL[c.fuente as keyof typeof FUENTE_LABEL] : '—'}
              </span>

              <span className="hidden md:block text-[12.5px] text-ink-700">
                {ETAPA_LABEL[c.etapa]}
              </span>

              <div className="hidden md:flex flex-col gap-1">
                <select
                  value={c.revision_cv ?? ''}
                  disabled={savingRev === c.id}
                  onChange={e => onCambioRevision(c.id, e.target.value)}
                  className={`${miniSelectClass} ${c.revision_cv ? REVISION_BADGE[c.revision_cv] ?? '' : 'text-ink-400'}`}
                >
                  <option value="">Sin revisar</option>
                  {REVISIONES_CV.map(r => <option key={r} value={r}>{REVISION_CV_LABEL[r]}</option>)}
                </select>
                {c.revision_cv === 'no_viable' && (motivoPendiente === c.id || !c.motivo_descarte) && (
                  <select
                    value={c.motivo_descarte ?? ''}
                    disabled={savingRev === c.id}
                    onChange={e => guardarRevision(c.id, 'no_viable', e.target.value || null)}
                    className={miniSelectClass}
                    autoFocus
                  >
                    <option value="">Motivo...</option>
                    {MOTIVOS_DESCARTE.map(m => <option key={m} value={m}>{MOTIVO_DESCARTE_LABEL[m]}</option>)}
                  </select>
                )}
                {c.revision_cv === 'no_viable' && c.motivo_descarte && motivoPendiente !== c.id && (
                  <span className="text-[10.5px] text-ink-400">{MOTIVO_DESCARTE_LABEL[c.motivo_descarte as keyof typeof MOTIVO_DESCARTE_LABEL]}</span>
                )}
              </div>

              <div className="hidden md:block">
                {c.cv_storage_path ? (
                  <button
                    onClick={() => abrirCv(c)}
                    disabled={abriendoCv === c.id}
                    title="Ver CV"
                    className="inline-flex items-center gap-1 text-[12px] text-navy hover:underline disabled:opacity-50"
                  >
                    <FileText size={13} />
                    {abriendoCv === c.id ? '...' : <ExternalLink size={11} />}
                  </button>
                ) : (
                  <span className="text-[11.5px] text-ink-400">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
