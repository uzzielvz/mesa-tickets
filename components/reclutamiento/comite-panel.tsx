'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, CheckCircle2, Copy, UserCheck, Video, XCircle } from 'lucide-react'
import { transicionarCandidato } from '@/lib/actions/reclutamiento'
import { guardarNotasComite, contratarCandidato, pasarAFinalDG } from '@/lib/actions/comite'
import {
  ETAPA_LABEL, MOTIVOS_DESCARTE, MOTIVO_DESCARTE_LABEL, DG_NOMBRE,
} from '@/lib/schemas/reclutamiento'
import type { RecEtapa, RecMotivoDescarte, RecViabilidad } from '@/lib/supabase/types'
import type { CandidatoComite } from '@/app/(dashboard)/reclutamiento/comite/page'

interface Vacante {
  id: string
  titulo: string
  estado: 'abierta' | 'cerrada'
}

const RECOMENDACION_LABEL: Record<RecViabilidad, string> = {
  si: 'Viable',
  no: 'No viable',
  filtro_dg: 'Filtro DG',
}

const RECOMENDACION_COLOR: Record<RecViabilidad, string> = {
  si: 'text-[#15803d] border-[#bbf7d0] bg-[#f0fdf4]',
  no: 'text-[#b91c1c] border-[#fecaca] bg-[#fef2f2]',
  filtro_dg: 'text-[#a16207] border-[#fde68a] bg-[#fffbeb]',
}

const inputClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'
const selectClass = inputClass
const labelClass = 'text-[11.5px] font-medium text-ink-500'

async function copiarLiga(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Liga del Meet copiada.')
  } catch {
    toast.error('No se pudo copiar la liga.')
  }
}

function fechaHoraDg(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function ComitePanel({
  vacantes,
  vacanteId,
  candidatos,
  ccDefault,
}: {
  vacantes: Vacante[]
  vacanteId: string | null
  candidatos: CandidatoComite[]
  ccDefault: string[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  const [descartando, setDescartando] = useState<string | null>(null)
  const [contratando, setContratando] = useState<string | null>(null)
  const [agendandoDg, setAgendandoDg] = useState<string | null>(null)

  function navegar(vacante: string) {
    router.push(`/reclutamiento/comite?vacante=${vacante}`)
  }

  async function guardarNotas(id: string, notas: string) {
    setSaving(id)
    const res = await guardarNotasComite({ candidato_id: id, notas_comite: notas })
    setSaving(null)
    if (res.ok) toast.success('Notas del comité guardadas.')
    else toast.error(res.error)
  }

  async function mover(id: string, destino: RecEtapa, motivo: RecMotivoDescarte | null) {
    setSaving(id)
    const res = await transicionarCandidato({ candidato_id: id, etapa_destino: destino, motivo_descarte: motivo })
    setSaving(null)
    if (res.ok) {
      setDescartando(null)
      toast.success(destino === 'descartado' ? 'Candidato descartado.' : `Movido a ${ETAPA_LABEL[destino]}.`)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  if (vacantes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[13px] text-ink-400">No hay vacantes.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-[820px]">
      <div className="flex flex-wrap items-center gap-2">
        <select value={vacanteId ?? ''} onChange={e => navegar(e.target.value)} className={selectClass}>
          {vacantes.map(v => (
            <option key={v.id} value={v.id}>
              {v.titulo}{v.estado === 'cerrada' ? ' (cerrada)' : ''}
            </option>
          ))}
        </select>
      </div>

      {candidatos.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-ink-400">
            No hay candidatos en comité para esta vacante. Muévelos desde el pipeline.
          </p>
        </div>
      ) : (
        candidatos.map(c => (
          <CandidatoCard
            key={c.id}
            candidato={c}
            ccDefault={ccDefault}
            busy={saving === c.id}
            descartando={descartando === c.id}
            contratando={contratando === c.id}
            agendandoDg={agendandoDg === c.id}
            onGuardarNotas={notas => guardarNotas(c.id, notas)}
            onMover={(destino, motivo) => mover(c.id, destino, motivo)}
            onIniciarDescarte={() => { setDescartando(c.id); setContratando(null); setAgendandoDg(null) }}
            onCancelarDescarte={() => setDescartando(null)}
            onIniciarContratacion={() => { setContratando(c.id); setDescartando(null); setAgendandoDg(null) }}
            onCancelarContratacion={() => setContratando(null)}
            onContratado={() => { setContratando(null); router.refresh() }}
            onIniciarDg={() => { setAgendandoDg(c.id); setDescartando(null); setContratando(null) }}
            onCancelarDg={() => setAgendandoDg(null)}
            onAgendadoDg={() => { setAgendandoDg(null); router.refresh() }}
            setSaving={setSaving}
          />
        ))
      )}
    </div>
  )
}

function CandidatoCard({
  candidato: c,
  ccDefault,
  busy,
  descartando,
  contratando,
  agendandoDg,
  onGuardarNotas,
  onMover,
  onIniciarDescarte,
  onCancelarDescarte,
  onIniciarContratacion,
  onCancelarContratacion,
  onContratado,
  onIniciarDg,
  onCancelarDg,
  onAgendadoDg,
  setSaving,
}: {
  candidato: CandidatoComite
  ccDefault: string[]
  busy: boolean
  descartando: boolean
  contratando: boolean
  agendandoDg: boolean
  onGuardarNotas: (notas: string) => void
  onMover: (destino: RecEtapa, motivo: RecMotivoDescarte | null) => void
  onIniciarDescarte: () => void
  onCancelarDescarte: () => void
  onIniciarContratacion: () => void
  onCancelarContratacion: () => void
  onContratado: () => void
  onIniciarDg: () => void
  onCancelarDg: () => void
  onAgendadoDg: () => void
  setSaving: (id: string | null) => void
}) {
  const [notas, setNotas] = useState(c.notas_comite ?? '')

  return (
    <div className="bg-white border border-[#ECECEC] rounded-md p-4 flex flex-col gap-3">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink-900 truncate">{c.nombre}</p>
          <p className="text-[11.5px] text-ink-400 truncate">{c.email ?? 'sin correo'}</p>
        </div>
        <span className="text-[11px] font-medium text-ink-500 border border-[#ECECEC] rounded-full px-2.5 py-[3px] whitespace-nowrap">
          {ETAPA_LABEL[c.etapa]}
        </span>
      </div>

      {/* Evaluaciones de los entrevistadores */}
      <div className="flex flex-col gap-2">
        <span className={labelClass}>Evaluaciones ({c.evaluaciones.length})</span>
        {c.evaluaciones.length === 0 ? (
          <p className="text-[12px] text-ink-300">Aún no hay evaluaciones registradas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {c.evaluaciones.map((ev, i) => (
              <div key={i} className="border border-border-subtle rounded p-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-medium text-ink-900">
                    {ev.entrevistador_nombre ?? 'Entrevistador'}
                  </span>
                  {ev.recomendacion && (
                    <span className={`text-[10.5px] font-medium border rounded-full px-2 py-[1px] ${RECOMENDACION_COLOR[ev.recomendacion]}`}>
                      {RECOMENDACION_LABEL[ev.recomendacion]}
                    </span>
                  )}
                  {ev.puntaje != null && (
                    <span className="text-[10.5px] text-ink-400">Puntaje: {ev.puntaje}/10</span>
                  )}
                </div>
                {ev.comentarios && (
                  <p className="text-[12px] text-ink-700 whitespace-pre-wrap">{ev.comentarios}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notas del comité */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Comentarios del comité (decisión conjunta)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={3}
          placeholder="Acuerdos y observaciones del comité…"
          className={`${inputClass} resize-y`}
        />
        <button
          onClick={() => onGuardarNotas(notas)}
          disabled={busy}
          className="self-start text-[11.5px] font-medium text-navy border border-[#ECECEC] rounded px-3 py-[5px] hover:bg-surface-hover disabled:opacity-50 transition-colors"
        >
          Guardar notas
        </button>
      </div>

      {/* Liga del Meet con la DG (guardada; el admin la puede copiar/reenviar) */}
      {c.final_dg_meet_url && (
        <div className="flex items-center gap-2 flex-wrap bg-surface-sidebar border border-border-subtle rounded p-2.5">
          <Video size={13} className="text-navy shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-ink-500">
              Entrevista final con {DG_NOMBRE}
              {c.final_dg_at ? ` — ${fechaHoraDg(c.final_dg_at)}` : ''}
            </p>
            <a
              href={c.final_dg_meet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-navy underline break-all"
            >
              {c.final_dg_meet_url}
            </a>
          </div>
          <button
            onClick={() => copiarLiga(c.final_dg_meet_url!)}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-navy border border-[#ECECEC] rounded px-2.5 py-[5px] hover:bg-surface-hover transition-colors shrink-0"
          >
            <Copy size={11} /> Copiar
          </button>
        </div>
      )}

      {/* Formulario de contratación */}
      {contratando ? (
        <ContratacionForm
          candidatoId={c.id}
          ccDefault={ccDefault}
          onCancelar={onCancelarContratacion}
          onContratado={onContratado}
          setSaving={setSaving}
        />
      ) : agendandoDg ? (
        <FinalDgForm
          candidatoId={c.id}
          onCancelar={onCancelarDg}
          onAgendado={onAgendadoDg}
          setSaving={setSaving}
        />
      ) : descartando ? (
        <div className="flex items-center gap-2">
          <select
            disabled={busy}
            defaultValue=""
            onChange={e => e.target.value && onMover('descartado', e.target.value as RecMotivoDescarte)}
            className={`${selectClass} flex-1`}
            autoFocus
          >
            <option value="">Motivo del descarte…</option>
            {MOTIVOS_DESCARTE.map(m => <option key={m} value={m}>{MOTIVO_DESCARTE_LABEL[m]}</option>)}
          </select>
          <button
            onClick={onCancelarDescarte}
            className="text-[11.5px] text-ink-500 border border-[#ECECEC] rounded px-3 py-[6px] hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap border-t border-border-subtle pt-3">
          {c.etapa === 'comite' && (
            <button
              onClick={onIniciarDg}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-navy border border-[#ECECEC] rounded px-3 py-[6px] hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              <ArrowRight size={12} /> Pasa con DG
            </button>
          )}
          <button
            onClick={onIniciarContratacion}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12px] font-medium rounded px-3 py-[6px] disabled:opacity-50 transition-colors"
          >
            <UserCheck size={12} /> Contratar
          </button>
          <button
            onClick={onIniciarDescarte}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-[12px] text-[#b91c1c] border border-[#ECECEC] rounded px-3 py-[6px] hover:bg-[#fee2e2] disabled:opacity-50 transition-colors"
          >
            <XCircle size={12} /> Descartar
          </button>
        </div>
      )}
    </div>
  )
}

function ContratacionForm({
  candidatoId,
  ccDefault,
  onCancelar,
  onContratado,
  setSaving,
}: {
  candidatoId: string
  ccDefault: string[]
  onCancelar: () => void
  onContratado: () => void
  setSaving: (id: string | null) => void
}) {
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [cc, setCc] = useState(ccDefault.join(', '))
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setEnviando(true)
    setSaving(candidatoId)
    const cc_emails = cc.split(',').map(s => s.trim()).filter(Boolean)
    const res = await contratarCandidato({
      candidato_id: candidatoId,
      fecha_ingreso: fechaIngreso,
      fecha_limite_docs: fechaLimite,
      cc_emails,
    })
    setEnviando(false)
    setSaving(null)
    if (res.ok) {
      toast.success(res.correoEnviado
        ? 'Candidato contratado y correo de bienvenida enviado.'
        : 'Candidato contratado, pero el correo de bienvenida no se pudo enviar.')
      onContratado()
    } else {
      toast.error(res.error)
    }
  }

  const valido = /^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso) && /^\d{4}-\d{2}-\d{2}$/.test(fechaLimite)

  return (
    <div className="border-t border-border-subtle pt-3 flex flex-col gap-3 bg-surface-sidebar -mx-4 -mb-4 px-4 pb-4 rounded-b-md">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
        <CheckCircle2 size={13} className="text-orange" /> Contratación — correo de bienvenida
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-[440px]">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Fecha de ingreso</label>
          <input type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Fecha límite de documentos</label>
          <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Copia (CC) — separados por coma</label>
        <input value={cc} onChange={e => setCc(e.target.value)} className={inputClass} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={confirmar}
          disabled={enviando || !valido}
          className="inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12px] font-medium rounded px-4 py-[7px] disabled:opacity-50 transition-colors"
        >
          {enviando ? 'Contratando y enviando…' : 'Confirmar contratación'}
        </button>
        <button
          onClick={onCancelar}
          disabled={enviando}
          className="text-[12px] text-ink-500 border border-[#ECECEC] rounded px-4 py-[7px] hover:bg-surface-hover disabled:opacity-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function FinalDgForm({
  candidatoId,
  onCancelar,
  onAgendado,
  setSaving,
}: {
  candidatoId: string
  onCancelar: () => void
  onAgendado: () => void
  setSaving: (id: string | null) => void
}) {
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setEnviando(true)
    setSaving(candidatoId)
    const res = await pasarAFinalDG({ candidato_id: candidatoId, fecha, hora })
    setEnviando(false)
    setSaving(null)
    if (res.ok) {
      toast.success('Entrevista final agendada y correo enviado al candidato.')
      onAgendado()
    } else {
      toast.error(res.error)
    }
  }

  const valido = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && /^\d{2}:\d{2}$/.test(hora)

  return (
    <div className="border-t border-border-subtle pt-3 flex flex-col gap-3 bg-surface-sidebar -mx-4 -mb-4 px-4 pb-4 rounded-b-md">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
        <Video size={13} className="text-navy" /> Entrevista final con {DG_NOMBRE} — se agenda un Meet
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-[440px]">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Hora</label>
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={confirmar}
          disabled={enviando || !valido}
          className="inline-flex items-center gap-1.5 bg-navy hover:opacity-90 text-white text-[12px] font-medium rounded px-4 py-[7px] disabled:opacity-50 transition-colors"
        >
          {enviando ? 'Agendando…' : 'Agendar y pasar con DG'}
        </button>
        <button
          onClick={onCancelar}
          disabled={enviando}
          className="text-[12px] text-ink-500 border border-[#ECECEC] rounded px-4 py-[7px] hover:bg-surface-hover disabled:opacity-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
