'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Datos {
  id: string
  nombre: string
  fecha_ingreso: string
  puesto: string | null
  area: string | null
  numero_empleado: string | null
  email: string | null
  jefe_id: string | null
}

const campo =
  'w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-colors'
const etiqueta = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium'

/**
 * Los datos de la persona. Nombre y fecha de ingreso se corrigen aquí desde
 * VAC-011 (antes solo por SQL); área y número de empleado van impresos en el
 * formato; correo y jefe directo hacen que pueda solicitar y su jefe autorizar.
 * La baja tiene su propio panel: aquí ya no se marca "activo".
 */
export default function DatosEmpleado({
  datos,
  posiblesJefes,
}: {
  datos: Datos
  posiblesJefes: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const [f, setF] = useState({
    nombre: datos.nombre,
    fecha_ingreso: datos.fecha_ingreso,
    puesto: datos.puesto ?? '',
    area: datos.area ?? '',
    numero_empleado: datos.numero_empleado ?? '',
    email: datos.email ?? '',
    jefe_id: datos.jefe_id ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  const limpio = (s: string) => (s.trim() === '' ? null : s.trim())
  const cambiaIngreso = f.fecha_ingreso !== datos.fecha_ingreso

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const email = limpio(f.email)?.toLowerCase() ?? null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('El correo no parece válido.')
      return
    }
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('vac_guardar_empleado', {
      p_id: datos.id,
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
    toast.success('Datos guardados')
    router.refresh()
  }

  return (
    <form onSubmit={guardar} className="px-5 py-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Nombre (apellidos y nombres)</span>
        <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} required className={campo} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Fecha de ingreso</span>
        <input
          type="date"
          value={f.fecha_ingreso}
          onChange={e => setF({ ...f, fecha_ingreso: e.target.value })}
          required
          className={campo}
        />
        {cambiaIngreso && (
          <span className="text-[11.5px] text-[#8A6100]">
            Cambiar la fecha recalcula sus periodos y sus días por tomar.
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Puesto</span>
        <input value={f.puesto} onChange={e => setF({ ...f, puesto: e.target.value })} className={campo} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Área</span>
          <input value={f.area} onChange={e => setF({ ...f, area: e.target.value })} className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>No. de empleado</span>
          <input value={f.numero_empleado} onChange={e => setF({ ...f, numero_empleado: e.target.value })} className={campo} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Correo</span>
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
      <button
        type="submit"
        disabled={guardando}
        className="self-start text-[13px] font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-60 rounded px-3.5 py-1.5 transition-colors"
      >
        {guardando ? 'Guardando…' : 'Guardar datos'}
      </button>
    </form>
  )
}
