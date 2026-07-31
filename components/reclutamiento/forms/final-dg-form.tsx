'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Video } from 'lucide-react'
import { pasarAFinalDG } from '@/lib/actions/comite'
import {
  inputClass, labelClass, btnNavy, btnCancelar, marcoForm, type VarianteForm,
} from './estilos'

// Agenda la entrevista final con la Dirección General: crea el Meet y avisa al
// candidato por correo. Lo usan la tarjeta de comité y el modal del pipeline.
export default function FinalDgForm({
  candidatoId,
  dgNombre,
  variante = 'inline',
  onCancelar,
  onAgendado,
  setSaving,
}: {
  candidatoId: string
  dgNombre: string
  variante?: VarianteForm
  onCancelar: () => void
  onAgendado: () => void
  setSaving?: (id: string | null) => void
}) {
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setEnviando(true)
    setSaving?.(candidatoId)
    const res = await pasarAFinalDG({ candidato_id: candidatoId, fecha, hora })
    setEnviando(false)
    setSaving?.(null)
    if (res.ok) {
      toast.success('Entrevista final agendada y correo enviado al candidato.')
      onAgendado()
    } else {
      toast.error(res.error)
    }
  }

  const valido = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && /^\d{2}:\d{2}$/.test(hora)

  return (
    <div className={marcoForm(variante)}>
      {variante === 'inline' && (
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
          <Video size={13} className="text-navy" /> Entrevista final con {dgNombre} — se agenda un Meet
        </div>
      )}
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
        <button onClick={confirmar} disabled={enviando || !valido} className={btnNavy}>
          {enviando ? 'Agendando…' : 'Agendar y pasar con DG'}
        </button>
        <button onClick={onCancelar} disabled={enviando} className={btnCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
