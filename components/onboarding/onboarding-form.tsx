'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Area { id: string; nombre: string }

interface Props {
  areas: Area[]
  initialNombre: string
  initialEmail: string
}

const inputClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all w-full'

export default function OnboardingForm({ areas, initialNombre, initialEmail }: Props) {
  const router = useRouter()
  const [nombre, setNombre] = useState(initialNombre)
  const [areaId, setAreaId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const nombreTrim = nombre.trim()
    if (nombreTrim.length < 3) {
      setError('Escribe tu nombre completo (mínimo 3 caracteres).')
      return
    }
    if (!areaId) {
      setError('Selecciona el área en la que trabajas.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('complete_onboarding', {
      p_nombre: nombreTrim,
      p_area_id: areaId,
    })

    if (rpcError) {
      const msg = rpcError.message.includes('nombre_invalido')
        ? 'El nombre no es válido.'
        : rpcError.message.includes('area_invalida')
          ? 'El área seleccionada no es válida.'
          : 'No se pudo guardar tu información. Intenta de nuevo.'
      setError(msg)
      setLoading(false)
      return
    }

    toast.success('¡Bienvenido!')
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-[420px] px-6">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-orange flex-shrink-0" />
          <span className="text-[15px] font-semibold text-navy tracking-tight">CrediFlexi</span>
          <span className="text-[11px] text-ink-400 font-normal">/ Operaciones</span>
        </div>

        <h1 className="text-[22px] font-semibold text-navy tracking-[-0.4px] mb-1">
          Antes de empezar
        </h1>
        <p className="text-[13px] text-ink-500 mb-6">
          Cuéntanos quién eres para que el equipo pueda identificarte.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-medium text-ink-700">Cuenta</label>
            <input
              type="text"
              value={initialEmail}
              disabled
              className={`${inputClass} bg-surface-sidebar text-ink-400 cursor-not-allowed`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nombre" className="text-[12.5px] font-medium text-ink-700">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: María Fernanda Pérez González"
              autoFocus
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="area" className="text-[12.5px] font-medium text-ink-700">
              Área en la que trabajas
            </label>
            <select
              id="area"
              value={areaId}
              onChange={e => setAreaId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Selecciona un área</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            {areas.length === 0 && (
              <p className="text-[11.5px] text-ink-400">
                No hay áreas configuradas. Contacta al administrador.
              </p>
            )}
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || areas.length === 0}
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Guardando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
