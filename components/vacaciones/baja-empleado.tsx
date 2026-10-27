'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { fechaLarga } from '@/lib/vacaciones/calendario'

const campo =
  'w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-colors'
const etiqueta = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium'

interface ResultadoBaja {
  solicitudes_canceladas: number
  pasaron_a_rh: number
  equipo_sin_jefe: { id: string; nombre: string }[]
}

/**
 * Baja y reactivación (VAC-011). La baja no borra nada: la persona deja de
 * contar, ya no puede entrar a pedir, sus solicitudes en trámite se cancelan y
 * las que esperaban su autorización pasan a RH. Dos clics a propósito.
 */
export default function BajaEmpleado({
  id,
  activo,
  fechaBaja,
  motivoBaja,
  hoy,
}: {
  id: string
  activo: boolean
  fechaBaja: string | null
  motivoBaja: string | null
  hoy: string
}) {
  const router = useRouter()
  const [fecha, setFecha] = useState(hoy)
  const [motivo, setMotivo] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoBaja | null>(null)

  async function darDeBaja() {
    setTrabajando(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('vac_baja_empleado', {
      p_id: id,
      p_fecha_baja: fecha,
      p_motivo: motivo.trim() || null,
    })
    setTrabajando(false)
    setConfirmar(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const r = data as unknown as ResultadoBaja
    setResultado(r)
    toast.success('Baja registrada')
    router.refresh()
  }

  async function reactivar() {
    setTrabajando(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('vac_reactivar_empleado', { p_id: id })
    setTrabajando(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setResultado(null)
    toast.success('Persona reactivada')
    router.refresh()
  }

  if (!activo) {
    return (
      <div className="px-5 py-4 flex flex-col gap-3">
        <p className="text-[12.5px] text-ink-700">
          Baja registrada{fechaBaja ? ` con fecha ${fechaLarga(fechaBaja)}` : ''}{motivoBaja && <> · {motivoBaja}</>}.
          Ya no cuenta en la lista ni puede entrar a pedir vacaciones. Su historial se conserva.
        </p>
        {resultado && <Resumen r={resultado} />}
        <button
          onClick={reactivar}
          disabled={trabajando}
          className="self-start text-[12.5px] font-medium text-navy border border-[#ECECEC] hover:bg-surface-hover disabled:opacity-60 rounded px-3 py-1.5"
        >
          {trabajando ? 'Reactivando…' : 'Reactivar (si regresó o fue un error)'}
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Último día</span>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Motivo (opcional)</span>
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Renuncia, término…" className={campo} />
        </label>
      </div>
      <p className="text-[11.5px] text-ink-500 leading-relaxed">
        No se borra nada. Sus solicitudes en trámite se cancelan; si es jefe, lo que esperaba su autorización pasa
        a tu Vo. Bo. y su equipo queda sin jefe hasta que le asignes otro.
      </p>
      {!confirmar ? (
        <button
          onClick={() => setConfirmar(true)}
          disabled={!fecha}
          className="self-start text-[12.5px] font-medium text-[#C62828] border border-[#F3C9C9] hover:bg-[#FFEBEE] disabled:opacity-60 rounded px-3 py-1.5"
        >
          Dar de baja
        </button>
      ) : (
        <span className="inline-flex items-center gap-3 text-[12.5px]">
          <button onClick={darDeBaja} disabled={trabajando} className="text-[#C62828] font-medium hover:underline">
            {trabajando ? 'Registrando…' : `Sí, dar de baja con fecha ${fechaLarga(fecha)}`}
          </button>
          <button onClick={() => setConfirmar(false)} className="text-ink-400 hover:text-ink-700">No</button>
        </span>
      )}
    </div>
  )
}

function Resumen({ r }: { r: ResultadoBaja }) {
  const lineas: string[] = []
  if (r.solicitudes_canceladas > 0) {
    lineas.push(`${r.solicitudes_canceladas} ${r.solicitudes_canceladas === 1 ? 'solicitud suya en trámite se canceló' : 'solicitudes suyas en trámite se cancelaron'}.`)
  }
  if (r.pasaron_a_rh > 0) {
    lineas.push(`${r.pasaron_a_rh} ${r.pasaron_a_rh === 1 ? 'solicitud que esperaba su autorización pasó' : 'solicitudes que esperaban su autorización pasaron'} a tu Vo. Bo.`)
  }
  if (lineas.length === 0 && r.equipo_sin_jefe.length === 0) return null
  return (
    <div className="border border-[#FFE0B2] bg-[#FFF8E1] rounded-md px-3 py-2.5 text-[12px] text-[#8A6100] flex flex-col gap-1">
      {lineas.map(l => <p key={l}>{l}</p>)}
      {r.equipo_sin_jefe.length > 0 && (
        <p>
          Quedaron sin jefe y hay que asignarles otro desde su ficha:{' '}
          {r.equipo_sin_jefe.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <a href={`/vacaciones/${p.id}`} className="font-medium underline">{p.nombre}</a>
            </span>
          ))}.
        </p>
      )}
    </div>
  )
}
