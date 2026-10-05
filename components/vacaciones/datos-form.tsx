'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Datos {
  id: string
  puesto: string | null
  area: string | null
  numero_empleado: string | null
  email: string | null
  jefe_id: string | null
  activo: boolean
}

const campo =
  'w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-colors'
const etiqueta = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium'

/**
 * Lo que el Excel no trae y el formato o la fase 2 necesitan: área y número de
 * empleado (van impresos en el formato), correo y jefe directo (con ellos el
 * empleado podrá solicitar y su jefe autorizar desde la plataforma).
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
    puesto: datos.puesto ?? '',
    area: datos.area ?? '',
    numero_empleado: datos.numero_empleado ?? '',
    email: datos.email ?? '',
    jefe_id: datos.jefe_id ?? '',
    activo: datos.activo,
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
    const { error } = await supabase
      .from('vac_empleados')
      .update({
        puesto: limpio(f.puesto),
        area: limpio(f.area),
        numero_empleado: limpio(f.numero_empleado),
        email,
        jefe_id: f.jefe_id || null,
        activo: f.activo,
      })
      .eq('id', datos.id)
    setGuardando(false)
    if (error) {
      toast.error(error.code === '23505' ? 'Ese correo ya es de otra persona.' : `No se pudo guardar: ${error.message}`)
      return
    }
    toast.success('Datos guardados')
    router.refresh()
  }

  return (
    <form onSubmit={guardar} className="px-5 py-4 flex flex-col gap-3">
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
      <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
        <input type="checkbox" checked={f.activo} onChange={e => setF({ ...f, activo: e.target.checked })} />
        Activo (desmarca si ya no trabaja en CrediFlexi)
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
