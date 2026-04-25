'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { guardarEvaluacion } from '@/lib/actions/acreditados'

const LETRAS = ['A', 'B', 'C', 'D'] as const
const LETRA_LABEL: Record<string, string> = {
  A: 'A — Bajo riesgo',
  B: 'B — Riesgo moderado',
  C: 'C — Alto riesgo',
  D: 'D — No aprobado',
}

const selectClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 outline-none focus:border-orange transition-all'
const inputClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all resize-none'

interface Props {
  acreditadoId: string
  calificacion_actual: string | null
  justificacion_actual: string | null
}

export default function EvaluacionPromotor({ acreditadoId, calificacion_actual, justificacion_actual }: Props) {
  const [editando, setEditando] = useState(!calificacion_actual)
  const [calificacion, setCalificacion] = useState(calificacion_actual ?? '')
  const [justificacion, setJustificacion] = useState(justificacion_actual ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!calificacion) { toast.error('Selecciona una calificación'); return }
    if (justificacion.trim().length < 10) { toast.error('Escribe al menos 10 caracteres de justificación'); return }
    setLoading(true)

    const result = await guardarEvaluacion(acreditadoId, {
      calificacion_promotor: calificacion,
      justificacion_promotor: justificacion.trim(),
    })

    if (result.ok) {
      toast.success('Evaluación guardada')
      setEditando(false)
    } else {
      toast.error(result.error ?? 'Error al guardar')
    }
    setLoading(false)
  }

  if (!editando && calificacion_actual) {
    return (
      <div className="border border-[#ECECEC] rounded-md p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-ink-700 uppercase tracking-[0.3px]">Evaluación del promotor</p>
          <button
            onClick={() => setEditando(true)}
            className="text-[12px] text-ink-400 hover:text-ink-700 transition-colors"
          >
            Modificar
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[22px] font-bold text-navy">{calificacion_actual}</span>
          <span className="text-[13px] text-ink-700">{LETRA_LABEL[calificacion_actual]}</span>
        </div>
        {justificacion_actual && (
          <p className="text-[13px] text-ink-500 leading-relaxed whitespace-pre-wrap">{justificacion_actual}</p>
        )}
      </div>
    )
  }

  return (
    <div className="border border-[#ECECEC] rounded-md p-5 flex flex-col gap-4">
      <p className="text-[12px] font-medium text-ink-700 uppercase tracking-[0.3px]">Evaluación del promotor</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-medium text-ink-700">Calificación</label>
        <select value={calificacion} onChange={e => setCalificacion(e.target.value)} className={selectClass}>
          <option value="">Selecciona una calificación</option>
          {LETRAS.map(l => <option key={l} value={l}>{LETRA_LABEL[l]}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-medium text-ink-700">Justificación</label>
        <textarea
          value={justificacion}
          onChange={e => setJustificacion(e.target.value)}
          rows={3}
          placeholder="Explica el criterio de evaluación..."
          className={inputClass}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar evaluación'}
        </button>
        {calificacion_actual && (
          <button
            onClick={() => { setEditando(false); setCalificacion(calificacion_actual); setJustificacion(justificacion_actual ?? '') }}
            className="border border-[#ECECEC] text-ink-900 text-[12.5px] font-medium rounded px-[14px] py-[7px] hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
