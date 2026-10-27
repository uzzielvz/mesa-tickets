'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const campo =
  'w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-colors'
const etiqueta = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium'

/**
 * Alta de una persona nueva (VAC-011). Nombre y fecha de ingreso son lo único
 * obligatorio: con eso ya se calculan sus días. Correo y jefe hacen que pueda
 * pedir vacaciones en línea; sin correo, RH le registra los días a mano.
 */
export default function AltaEmpleado({ posiblesJefes }: { posiblesJefes: { id: string; nombre: string }[] }) {
  const router = useRouter()
  const [f, setF] = useState({
    nombre: '', fecha_ingreso: '', email: '', puesto: '', area: '', numero_empleado: '', jefe_id: '',
  })
  const [guardando, setGuardando] = useState(false)

  const limpio = (s: string) => (s.trim() === '' ? null : s.trim())

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const email = limpio(f.email)?.toLowerCase() ?? null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('El correo no parece válido.')
      return
    }
    setGuardando(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('vac_alta_empleado', {
      p_nombre: f.nombre,
      p_fecha_ingreso: f.fecha_ingreso,
      p_email: email,
      p_puesto: limpio(f.puesto),
      p_area: limpio(f.area),
      p_numero_empleado: limpio(f.numero_empleado),
      p_jefe_id: f.jefe_id || null,
    })
    setGuardando(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Alta registrada')
    router.push(`/vacaciones/${data as unknown as string}`)
  }

  return (
    <form onSubmit={guardar} className="px-5 py-4 flex flex-col gap-3">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_180px] gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Nombre completo (apellidos y nombres) *</span>
          <input
            value={f.nombre}
            onChange={e => setF({ ...f, nombre: e.target.value })}
            placeholder="PÉREZ LÓPEZ MARÍA"
            required
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Fecha de ingreso *</span>
          <input
            type="date"
            value={f.fecha_ingreso}
            onChange={e => setF({ ...f, fecha_ingreso: e.target.value })}
            required
            className={campo}
          />
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Correo de la empresa</span>
          <input
            type="email"
            value={f.email}
            onChange={e => setF({ ...f, email: e.target.value })}
            placeholder="nombre@financieracrediflexi.com"
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Jefe directo</span>
          <select value={f.jefe_id} onChange={e => setF({ ...f, jefe_id: e.target.value })} className={campo}>
            <option value="">Sin asignar</option>
            {posiblesJefes.map(j => <option key={j.id} value={j.id}>{j.nombre}</option>)}
          </select>
        </label>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Puesto</span>
          <input value={f.puesto} onChange={e => setF({ ...f, puesto: e.target.value })} className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Área</span>
          <input value={f.area} onChange={e => setF({ ...f, area: e.target.value })} className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>No. de empleado</span>
          <input value={f.numero_empleado} onChange={e => setF({ ...f, numero_empleado: e.target.value })} className={campo} />
        </label>
      </div>
      <p className="text-[11.5px] text-ink-500 leading-relaxed">
        Con el correo y el jefe directo, la persona puede pedir sus vacaciones en línea y a su jefe le llega el aviso.
        Si no tiene correo de la empresa, déjalo vacío: sus días los registras tú desde su ficha.
      </p>
      <button
        type="submit"
        disabled={guardando}
        className="self-start text-[13px] font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-60 rounded px-3.5 py-1.5 transition-colors"
      >
        {guardando ? 'Guardando…' : 'Dar de alta'}
      </button>
    </form>
  )
}
