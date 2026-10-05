'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { diasHabiles, fechaRegreso, festivosEntre, fechaCorta, fechaLarga } from '@/lib/vacaciones/calendario'

const campo =
  'w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-colors'
const etiqueta = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium'

/**
 * La solicitud del empleado. La cuenta de días que se ve aquí es una vista
 * previa con el mismo calendario que usa la base; la cifra que cuenta la
 * calcula `vac_solicitar` (días hábiles, festivos, saldo y empalmes).
 */
export default function SolicitarVacaciones({
  disponibles,
  tieneDerecho,
  hoy,
  jefe,
}: {
  disponibles: number
  /** Menos de un año de servicio: solo días flotantes. */
  tieneDerecho: boolean
  hoy: string
  jefe: string | null
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<'vacaciones' | 'flotante'>(tieneDerecho ? 'vacaciones' : 'flotante')
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)

  const ultimo = fin || inicio
  const dias = useMemo(() => (inicio ? diasHabiles(inicio, ultimo) : 0), [inicio, ultimo])
  const regreso = useMemo(() => (ultimo ? fechaRegreso(ultimo) : ''), [ultimo])
  const festivos = useMemo(() => (inicio ? festivosEntre(inicio, ultimo) : []), [inicio, ultimo])
  const excede = tipo === 'vacaciones' && dias > disponibles

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!inicio) { toast.error('Elige el primer día.'); return }
    setEnviando(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('vac_solicitar', {
      p_tipo: tipo,
      p_inicio: inicio,
      p_fin: ultimo,
      p_observaciones: nota.trim() || null,
    })
    setEnviando(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(jefe ? `Solicitud enviada a ${jefe}` : 'Solicitud enviada a Gente y Cultura')
    setInicio(''); setFin(''); setNota('')
    router.refresh()
  }

  return (
    <form onSubmit={enviar} className="px-5 py-4 flex flex-col gap-3">
      <div className="flex gap-1.5" role="group" aria-label="Tipo de solicitud">
        {([['vacaciones', 'Vacaciones'], ['flotante', 'Día flotante']] as const).map(([k, t]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTipo(k)}
            disabled={k === 'vacaciones' && !tieneDerecho}
            title={k === 'vacaciones' && !tieneDerecho ? 'Tus primeros días de vacaciones llegan al cumplir un año' : undefined}
            className={`text-[12px] font-medium rounded px-3 py-[5px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              tipo === k ? 'border-navy bg-navy text-white' : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Primer día</span>
          <input id="sol-inicio" type="date" value={inicio} min={hoy} onChange={e => setInicio(e.target.value)} className={campo} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Último día</span>
          <input id="sol-fin" type="date" value={fin} min={inicio || hoy} onChange={e => setFin(e.target.value)} className={campo} />
        </label>
      </div>

      {inicio && (
        <div className={`text-[12.5px] rounded px-3 py-2 ${excede ? 'bg-[#FFEBEE] text-[#C62828]' : 'bg-surface-sidebar text-ink-700'}`}>
          <p>
            <strong className="font-medium">{dias} {dias === 1 ? 'día hábil' : 'días hábiles'}</strong>
            {regreso && <> · regresas el {fechaLarga(regreso)}</>}
          </p>
          {festivos.length > 0 && (
            <p className="text-[11.5px] mt-0.5">
              No cuentan: {festivos.map(f => `${fechaCorta(f.fecha)} (${f.nombre})`).join(', ')}
            </p>
          )}
          {excede && <p className="text-[11.5px] mt-0.5">Tienes {disponibles} disponibles.</p>}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Nota para tu jefe (opcional)</span>
        <textarea id="sol-nota" value={nota} onChange={e => setNota(e.target.value)} rows={2} className={campo} />
      </label>

      <button
        type="submit"
        disabled={enviando || !inicio || dias === 0 || excede}
        className="self-start inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-50 rounded px-3.5 py-1.5 transition-colors"
      >
        <Send size={13} /> {enviando ? 'Enviando…' : 'Solicitar'}
      </button>
      <p className="text-[11.5px] text-ink-400">
        {jefe ? `La autoriza ${jefe} y después Gente y Cultura da el Vo. Bo.` : 'No tienes jefe asignado: la revisa directo Gente y Cultura.'}
      </p>
    </form>
  )
}
