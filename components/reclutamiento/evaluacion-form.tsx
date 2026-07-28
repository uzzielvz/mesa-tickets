'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { submitEvaluacion } from '@/lib/actions/evaluaciones'
import type { CandidatoEval } from '@/app/evaluar/[token]/tipos'

type Recomendacion = 'si' | 'no' | 'filtro_dg'

const OPCIONES: { value: Recomendacion; label: string; activo: string }[] = [
  { value: 'si', label: 'Viable', activo: 'bg-green-600 text-white border-green-600' },
  { value: 'no', label: 'No viable', activo: 'bg-red-600 text-white border-red-600' },
  { value: 'filtro_dg', label: 'Filtro DG', activo: 'bg-amber-500 text-white border-amber-500' },
]

export function EvaluacionForm({ token, candidato }: { token: string; candidato: CandidatoEval }) {
  const router = useRouter()
  const [recomendacion, setRecomendacion] = useState<Recomendacion | null>(
    candidato.evaluacion?.recomendacion ?? null,
  )
  const [comentarios, setComentarios] = useState(candidato.evaluacion?.comentarios ?? '')
  const [puntaje, setPuntaje] = useState(candidato.evaluacion?.puntaje?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    if (!recomendacion) {
      toast.error('Selecciona una valoración')
      return
    }
    setSaving(true)
    const res = await submitEvaluacion({
      token,
      entrevista_id: candidato.entrevista_id,
      recomendacion,
      comentarios,
      puntaje: puntaje ? Number(puntaje) : null,
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Evaluación guardada')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {OPCIONES.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => setRecomendacion(o.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              recomendacion === o.value
                ? o.activo
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <textarea
        value={comentarios}
        onChange={e => setComentarios(e.target.value)}
        placeholder="Comentarios (opcional)"
        rows={3}
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Puntaje (1–10)
          <input
            type="number"
            min={1}
            max={10}
            value={puntaje}
            onChange={e => setPuntaje(e.target.value)}
            className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={guardar}
          disabled={saving}
          className="ml-auto inline-flex h-10 items-center justify-center rounded-md bg-orange px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
