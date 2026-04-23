'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Area { id: string; nombre: string; activo: boolean }

export default function AreasAdmin({ areas }: { areas: Area[] }) {
  const router = useRouter()
  const [nueva, setNueva] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCrear() {
    if (!nueva.trim()) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('areas').insert({ nombre: nueva.trim() })
    if (err) {
      toast.error('No se pudo crear el área.')
    } else {
      toast.success('Área creada')
      setNueva('')
      router.refresh()
    }
    setLoading(false)
  }

  async function toggleActivo(area: Area) {
    const supabase = createClient()
    const { error } = await supabase.from('areas').update({ activo: !area.activo }).eq('id', area.id)
    if (error) { toast.error('Error al actualizar el área.'); return }
    toast.success(area.activo ? 'Área desactivada' : 'Área activada')
    router.refresh()
  }

  const inputClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all'

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Crear nueva */}
      <div className="flex gap-2">
        <input
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          placeholder="Nombre del área"
          className={`${inputClass} flex-1`}
          onKeyDown={e => e.key === 'Enter' && handleCrear()}
        />
        <button
          onClick={handleCrear}
          disabled={loading || !nueva.trim()}
          className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {/* Lista */}
      <div className="border border-[#ECECEC] rounded-md overflow-hidden">
        {areas.length === 0 && (
          <p className="text-[13px] text-ink-400 px-5 py-4">Sin áreas registradas.</p>
        )}
        {areas.map((area, i) => (
          <div
            key={area.id}
            className={`flex items-center justify-between px-5 py-3 ${i < areas.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
          >
            <span className={`text-[13px] font-medium ${area.activo ? 'text-ink-900' : 'text-ink-400 line-through'}`}>
              {area.nombre}
            </span>
            <button
              onClick={() => toggleActivo(area)}
              className="text-[12px] text-ink-400 hover:text-ink-700 transition-colors"
            >
              {area.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
