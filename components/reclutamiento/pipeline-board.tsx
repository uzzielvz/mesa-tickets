'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, XCircle } from 'lucide-react'
import { timeAgo } from '@/lib/utils/format'
import { transicionarCandidato } from '@/lib/actions/reclutamiento'
import { siguientePaso, indicacion, type SiguientePaso } from '@/lib/reclutamiento/etapas'
import EtapaAccionDialog from '@/components/reclutamiento/etapa-accion-dialog'
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

const TONO_TEXTO = {
  bloqueo: 'text-[#b91c1c]',
  aviso: 'text-[#a16207]',
  normal: 'text-ink-400',
} as const

const selectClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'
const miniSelectClass =
  'bg-white border border-[#ECECEC] rounded px-1.5 py-[3px] text-[11.5px] text-ink-900 outline-none focus:border-orange transition-all w-full'

export default function PipelineBoard({
  vacantes,
  vacanteId,
  candidatos,
  googleConectado,
  dgNombre,
  dgConfigurada,
  ccDefault,
  destinatariosDefault,
}: {
  vacantes: Vacante[]
  vacanteId: string | null
  candidatos: PipelineCandidato[]
  googleConectado: boolean
  dgNombre: string
  dgConfigurada: boolean
  ccDefault: string[]
  destinatariosDefault: Record<string, string>
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  // Candidato a punto de descartarse, en espera de que se elija el motivo.
  const [descartando, setDescartando] = useState<string | null>(null)
  // Formulario / confirmación abiertos para un candidato.
  const [dialogo, setDialogo] = useState<{ candidato: PipelineCandidato; paso: SiguientePaso } | null>(null)

  function navegar(vacante: string) {
    router.push(`/reclutamiento/pipeline?vacante=${vacante}`)
  }

  // El paso de cada candidato se deriva de su estado: nada de tablas estáticas
  // de "siguiente etapa". Así el botón dice y hace lo que la etapa exige.
  const pasos = useMemo(() => {
    const ctx = { googleConectado, dgConfigurada }
    return new Map(candidatos.map(c => [c.id, siguientePaso(c, ctx)]))
  }, [candidatos, googleConectado, dgConfigurada])

  const porEtapa = useMemo(() => {
    const map = new Map<RecEtapa, PipelineCandidato[]>()
    for (const et of ETAPAS) map.set(et, [])
    for (const c of candidatos) map.get(c.etapa)?.push(c)
    return map
  }, [candidatos])

  async function mover(id: string, destino: RecEtapa, motivo: RecMotivoDescarte | null) {
    setSaving(id)
    const res = await transicionarCandidato({
      candidato_id: id,
      etapa_destino: destino,
      motivo_descarte: motivo,
    })
    setSaving(null)
    if (res.ok) {
      setDescartando(null)
      toast.success(`Movido a ${ETAPA_LABEL[destino]}`)
      // Sin update optimista: los requisitos son derivados y se desincronizarían.
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  function accionar(c: PipelineCandidato, paso: SiguientePaso) {
    if (paso.accion.tipo === 'redirect') {
      router.push(paso.accion.href)
      return
    }
    // Los formularios y las confirmaciones se resuelven en el modal.
    if (paso.accion.tipo === 'formulario' || paso.advertencias.length > 0) {
      setDialogo({ candidato: c, paso })
      return
    }
    if (paso.etapaDestino) mover(c.id, paso.etapaDestino, null)
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
          // Cuántos pueden avanzar ya: el dato que dice dónde está atorado el flujo.
          const listos = items.filter(c => {
            const p = pasos.get(c.id)
            return p != null && p.puede && p.etapaDestino != null
          }).length

          return (
            <div key={etapa} className="flex-shrink-0 w-[220px] flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`w-2 h-2 rounded-full ${ETAPA_DOT[etapa]}`} />
                <span className="text-[12px] font-medium text-ink-700">{ETAPA_LABEL[etapa]}</span>
                <span className="text-[11px] text-ink-400">{items.length}</span>
                {listos > 0 && <span className="text-[11px] text-[#15803d]">· {listos} listo{listos !== 1 ? 's' : ''}</span>}
              </div>

              <div className="flex flex-col gap-2 min-h-[60px] bg-surface-sidebar rounded-md p-2">
                {items.length === 0 ? (
                  <p className="text-[11px] text-ink-300 text-center py-4">—</p>
                ) : items.map(c => {
                  const terminal = TERMINALES.includes(c.etapa)
                  const paso = pasos.get(c.id) ?? null
                  const busy = saving === c.id
                  const nota = paso ? indicacion(paso) : null
                  const prog = paso?.progreso

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

                      {prog && (
                        <span className="text-[10.5px] text-ink-500">
                          {prog.registradas} de {prog.total} evaluaciones
                        </span>
                      )}

                      {/* Una sola línea: el primer bloqueo, la advertencia, o el resumen. */}
                      {nota && (
                        <span className={`text-[10.5px] line-clamp-1 ${TONO_TEXTO[nota.tono]}`} title={nota.texto}>
                          {nota.texto}
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
                          {paso && (
                            <button
                              onClick={() => accionar(c, paso)}
                              disabled={busy || !paso.puede}
                              title={paso.puede ? paso.descripcion : paso.bloqueos.join(' · ')}
                              className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] text-navy border border-[#ECECEC] rounded px-2 py-[3px] hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <ArrowRight size={11} />
                              <span className="truncate">{paso.titulo}</span>
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

      {dialogo && (
        <EtapaAccionDialog
          abierto
          onOpenChange={v => !v && setDialogo(null)}
          candidatoId={dialogo.candidato.id}
          candidatoNombre={dialogo.candidato.nombre}
          paso={dialogo.paso}
          dgNombre={dgNombre}
          ccDefault={ccDefault}
          destinatariosDefault={destinatariosDefault}
          onHecho={() => { setDialogo(null); router.refresh() }}
          onConfirmarDirecta={() => {
            const { candidato, paso } = dialogo
            setDialogo(null)
            if (paso.etapaDestino) mover(candidato.id, paso.etapaDestino, null)
          }}
        />
      )}
    </div>
  )
}
