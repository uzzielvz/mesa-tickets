'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { contratarCandidato } from '@/lib/actions/comite'
import {
  inputClass, labelClass, btnPrimario, btnCancelar, marcoForm, type VarianteForm,
} from './estilos'

// Separa el nombre completo en nombre(s) y apellidos. Por convención mexicana,
// los últimos dos tokens se toman como apellidos. Es solo un prellenado: el
// admin puede corregirlo antes de confirmar (el dato viaja limpio a Factorial).
function dividirNombre(completo: string): { nombre: string; apellidos: string } {
  const partes = completo.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { nombre: completo.trim(), apellidos: '' }
  if (partes.length === 2) return { nombre: partes[0], apellidos: partes[1] }
  return { nombre: partes.slice(0, -2).join(' '), apellidos: partes.slice(-2).join(' ') }
}

// Cierra el proceso: marca al candidato como contratado, le envía la bienvenida,
// dispara el correo interno de altas y da de alta al empleado en Factorial HR.
export default function ContratacionForm({
  candidatoId,
  nombreCompleto,
  ccDefault,
  variante = 'inline',
  onCancelar,
  onContratado,
  setSaving,
}: {
  candidatoId: string
  nombreCompleto: string
  ccDefault: string[]
  variante?: VarianteForm
  onCancelar: () => void
  onContratado: () => void
  setSaving?: (id: string | null) => void
}) {
  const inicial = dividirNombre(nombreCompleto)
  const [nombre, setNombre] = useState(inicial.nombre)
  const [apellidos, setApellidos] = useState(inicial.apellidos)
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [cc, setCc] = useState(ccDefault.join(', '))
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setEnviando(true)
    setSaving?.(candidatoId)
    const cc_emails = cc.split(',').map(s => s.trim()).filter(Boolean)
    const res = await contratarCandidato({
      candidato_id: candidatoId,
      fecha_ingreso: fechaIngreso,
      fecha_limite_docs: fechaLimite,
      cc_emails,
      first_name: nombre.trim(),
      last_name: apellidos.trim(),
    })
    setEnviando(false)
    setSaving?.(null)
    if (res.ok) {
      const base = res.correoEnviado
        ? res.altasEnviado
          ? 'Candidato contratado. Bienvenida y aviso de altas enviados.'
          : 'Candidato contratado y bienvenida enviada (revisa la config de alta para el aviso interno).'
        : 'Candidato contratado, pero el correo de bienvenida no se pudo enviar.'
      toast.success(res.factorialCreado ? `${base} Empleado creado en Factorial.` : base)
      onContratado()
    } else {
      toast.error(res.error)
    }
  }

  const valido = /^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)
    && /^\d{4}-\d{2}-\d{2}$/.test(fechaLimite)
    && nombre.trim().length > 0
    && apellidos.trim().length > 0

  return (
    <div className={marcoForm(variante)}>
      {variante === 'inline' && (
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
          <CheckCircle2 size={13} className="text-orange" /> Contratación — correo de bienvenida
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 max-w-[440px]">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Nombre(s)</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Apellidos</label>
          <input value={apellidos} onChange={e => setApellidos(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className="text-[11px] text-ink-400 max-w-[440px] -mt-1">
        Se dividió automáticamente para el alta en Factorial; corrígelo si hace falta.
      </p>
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
        <button onClick={confirmar} disabled={enviando || !valido} className={btnPrimario}>
          {enviando ? 'Contratando y enviando…' : 'Confirmar contratación'}
        </button>
        <button onClick={onCancelar} disabled={enviando} className={btnCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
