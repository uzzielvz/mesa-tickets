'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Autorizar o rechazar una solicitud. El jefe autoriza (pasa a RH) y RH da el
 * Vo. Bo. (los días entran al saldo). Rechazar siempre pide el motivo: la
 * persona lo va a leer en "Mis vacaciones". Quién puede resolver qué lo valida
 * la base, no este botón.
 */
export default function ResolverSolicitud({ id, modo }: { id: string; modo: 'jefe' | 'rh' }) {
  const router = useRouter()
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  async function resolver(aprueba: boolean) {
    if (!aprueba && !motivo.trim()) {
      toast.error('Escribe el motivo del rechazo.')
      return
    }
    setTrabajando(true)
    const supabase = createClient()
    const { error } = modo === 'jefe'
      ? await supabase.rpc('vac_resolver_jefe', { p_id: id, p_autoriza: aprueba, p_comentario: motivo.trim() || null })
      : await supabase.rpc('vac_resolver_rh', { p_id: id, p_aprueba: aprueba, p_comentario: motivo.trim() || null })
    setTrabajando(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(aprueba ? (modo === 'jefe' ? 'Autorizada: pasa a Gente y Cultura' : 'Aprobada: los días ya cuentan') : 'Rechazada')
    setRechazando(false)
    setMotivo('')
    router.refresh()
  }

  const etiquetaSi = modo === 'jefe' ? 'Autorizar' : 'Dar Vo. Bo.'

  if (rechazando) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={`motivo-${id}`} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
          Motivo del rechazo
        </label>
        <textarea
          id={`motivo-${id}`}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={2}
          placeholder="Por ejemplo: esa semana hay cierre de mes; ¿la movemos a la siguiente?"
          className="w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange"
        />
        <div className="flex gap-2">
          <button
            onClick={() => resolver(false)}
            disabled={trabajando}
            className="text-[12.5px] font-medium text-white bg-[#C62828] hover:bg-[#B71C1C] disabled:opacity-60 rounded px-3 py-1.5"
          >
            {trabajando ? 'Guardando…' : 'Rechazar'}
          </button>
          <button onClick={() => setRechazando(false)} className="text-[12.5px] text-ink-500 hover:text-ink-900 px-2">
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => resolver(true)}
        disabled={trabajando}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-60 rounded px-3 py-1.5"
      >
        <Check size={13} /> {trabajando ? 'Guardando…' : etiquetaSi}
      </button>
      <button
        onClick={() => setRechazando(true)}
        disabled={trabajando}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-700 border border-[#ECECEC] hover:bg-surface-hover rounded px-3 py-1.5"
      >
        <X size={13} /> Rechazar
      </button>
    </div>
  )
}
