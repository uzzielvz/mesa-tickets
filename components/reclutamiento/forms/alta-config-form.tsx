'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'
import { guardarAltaConfig } from '@/lib/actions/comite'
import {
  EQUIPO_OPCIONES, EQUIPO_LABEL, SISTEMAS_OPCIONES, SISTEMAS_LABEL, DESTINATARIOS_ROLES,
} from '@/lib/schemas/reclutamiento'
import type { AltaConfigComite } from '@/app/(dashboard)/reclutamiento/comite/page'
import {
  inputClass, labelClass, checkboxClass, btnPrimario, marcoForm, type VarianteForm,
} from './estilos'

// Qué recibe el nuevo ingreso y a quién se le avisa. Se guarda en rec_alta_config
// y alimenta el correo interno de altas que se manda al contratar.
export default function AltaConfigForm({
  candidatoId,
  inicial,
  destinatariosDefault,
  variante = 'inline',
  onGuardado,
  setSaving,
}: {
  candidatoId: string
  inicial: AltaConfigComite | null
  destinatariosDefault: Record<string, string>
  variante?: VarianteForm
  onGuardado?: () => void
  setSaving?: (id: string | null) => void
}) {
  const [equipo, setEquipo] = useState<string[]>(inicial?.equipo ?? [])
  const [sistemas, setSistemas] = useState<string[]>(inicial?.sistemas ?? [])
  const [otrosTexto, setOtrosTexto] = useState(inicial?.otros_texto ?? '')
  const [induccionFecha, setInduccionFecha] = useState(inicial?.induccion_fecha ?? '')
  const [induccionMeet, setInduccionMeet] = useState(inicial?.induccion_meet_url ?? '')
  const [destinatarios, setDestinatarios] = useState<Record<string, string>>({
    ...destinatariosDefault,
    ...(inicial?.destinatarios ?? {}),
  })
  const [guardando, setGuardando] = useState(false)

  function toggle(list: string[], set: (v: string[]) => void, val: string) {
    set(list.includes(val) ? list.filter(x => x !== val) : [...list, val])
  }

  async function guardar() {
    setGuardando(true)
    setSaving?.(candidatoId)
    const res = await guardarAltaConfig({
      candidato_id: candidatoId,
      equipo,
      sistemas,
      otros_texto: otrosTexto,
      induccion_fecha: induccionFecha,
      induccion_meet_url: induccionMeet,
      destinatarios,
    })
    setGuardando(false)
    setSaving?.(null)
    if (res.ok) {
      toast.success('Configuración de alta guardada.')
      onGuardado?.()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className={marcoForm(variante, false)}>
      {variante === 'inline' && (
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
          <ClipboardList size={13} className="text-orange" /> Configuración de alta
        </div>
      )}

      {/* Equipo */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Equipo asignado</span>
        <div className="flex flex-wrap gap-2">
          {EQUIPO_OPCIONES.map(op => (
            <label key={op} className={`${checkboxClass} ${equipo.includes(op) ? 'border-orange bg-white' : ''}`}>
              <input type="checkbox" checked={equipo.includes(op)} onChange={() => toggle(equipo, setEquipo, op)} />
              {EQUIPO_LABEL[op]}
            </label>
          ))}
        </div>
      </div>

      {/* Sistemas */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Sistemas</span>
        <div className="flex flex-wrap gap-2">
          {SISTEMAS_OPCIONES.map(op => (
            <label key={op} className={`${checkboxClass} ${sistemas.includes(op) ? 'border-orange bg-white' : ''}`}>
              <input type="checkbox" checked={sistemas.includes(op)} onChange={() => toggle(sistemas, setSistemas, op)} />
              {SISTEMAS_LABEL[op]}
            </label>
          ))}
        </div>
        {sistemas.includes('otros') && (
          <input
            value={otrosTexto}
            onChange={e => setOtrosTexto(e.target.value)}
            placeholder="¿Qué otros sistemas?"
            className={`${inputClass} max-w-[440px]`}
          />
        )}
      </div>

      {/* Inducción */}
      <div className="grid grid-cols-2 gap-3 max-w-[440px]">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Inducción — fecha</label>
          <input type="date" value={induccionFecha} onChange={e => setInduccionFecha(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Inducción — liga Meet</label>
          <input value={induccionMeet} onChange={e => setInduccionMeet(e.target.value)} placeholder="https://…" className={inputClass} />
        </div>
      </div>

      {/* Destinatarios internos */}
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Destinatarios internos (correo por rol)</span>
        <div className="grid grid-cols-2 gap-2 max-w-[560px]">
          {DESTINATARIOS_ROLES.map(rol => (
            <div key={rol.key} className="flex flex-col gap-1">
              <label className="text-[11px] text-ink-400">{rol.label}</label>
              <input
                type="email"
                value={destinatarios[rol.key] ?? ''}
                onChange={e => setDestinatarios(prev => ({ ...prev, [rol.key]: e.target.value }))}
                placeholder="correo@…"
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={guardar} disabled={guardando} className={`self-start ${btnPrimario}`}>
        {guardando ? 'Guardando…' : 'Guardar configuración de alta'}
      </button>
    </div>
  )
}
