'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { crearVacante, actualizarVacante, cerrarVacante } from '@/lib/actions/reclutamiento'

const inputClass =
  'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all w-full'

interface InitialData {
  id: string
  titulo: string
  area: string | null
  descripcion: string | null
  estado: 'abierta' | 'cerrada'
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[12.5px] font-medium text-ink-700">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

export default function VacanteForm({ initialData }: { initialData?: InitialData }) {
  const router = useRouter()
  const isEdit = !!initialData

  const [titulo, setTitulo] = useState(initialData?.titulo ?? '')
  const [area, setArea] = useState(initialData?.area ?? '')
  const [descripcion, setDescripcion] = useState(initialData?.descripcion ?? '')
  const [estado, setEstado] = useState<'abierta' | 'cerrada'>(initialData?.estado ?? 'abierta')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (titulo.trim().length < 3) {
      toast.error('El título debe tener al menos 3 caracteres')
      return
    }

    setLoading(true)
    const payload = { titulo: titulo.trim(), area, descripcion, estado }
    const result = isEdit
      ? await actualizarVacante(initialData!.id, payload)
      : await crearVacante(payload)

    if (result.ok) {
      toast.success(isEdit ? 'Vacante actualizada' : 'Vacante creada')
      router.push('/reclutamiento/vacantes')
      router.refresh()
    } else {
      toast.error(result.error)
      setLoading(false)
    }
  }

  async function toggleEstado() {
    if (!initialData) return
    const reabrir = estado === 'cerrada'
    setLoading(true)
    const result = await cerrarVacante(initialData.id, reabrir)
    if (result.ok) {
      setEstado(reabrir ? 'abierta' : 'cerrada')
      toast.success(reabrir ? 'Vacante reabierta' : 'Vacante cerrada')
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label required>Título de la vacante</Label>
          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="ej. Gerente de Inversiones"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Área</Label>
          <input
            value={area}
            onChange={e => setArea(e.target.value)}
            placeholder="ej. Inversiones"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Descripción</Label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Perfil, responsabilidades, requisitos..."
            rows={5}
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {isEdit && (
        <div className="flex items-center justify-between border border-[#ECECEC] rounded-md px-5 py-4">
          <div>
            <p className="text-[13px] font-medium text-ink-900">Estado de la vacante</p>
            <p className="text-[11.5px] text-ink-400">
              {estado === 'abierta' ? 'Recibiendo candidatos.' : 'Cerrada: ya no recibe candidatos nuevos.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleEstado}
            disabled={loading}
            className="border border-[#ECECEC] text-ink-700 text-[12.5px] font-medium rounded px-4 py-[7px] hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {estado === 'abierta' ? 'Cerrar vacante' : 'Reabrir vacante'}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-5 py-[8px] transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear vacante'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading}
          className="border border-[#ECECEC] text-ink-700 text-[12.5px] font-medium rounded px-5 py-[8px] hover:bg-surface-hover transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
