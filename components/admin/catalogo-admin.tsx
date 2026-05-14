'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import FieldsBuilder from './fields-builder'
import type { ProblemField } from '@/lib/supabase/types'

interface CatalogItem {
  id: string; area_id: string; nombre: string; leyenda: string
  responsable_default_id: string | null
  requiere_grupo: boolean; requiere_cliente: boolean
  requiere_ciclo: boolean; requiere_evidencia: boolean; activo: boolean
  campos: ProblemField[] | null
}
interface Area { id: string; nombre: string }
interface Profile { id: string; nombre_completo: string }

const inputClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all'
const selectClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 outline-none focus:border-orange transition-all'

interface FormState {
  area_id: string
  nombre: string
  leyenda: string
  responsable_default_id: string
  requiere_evidencia: boolean
  campos: ProblemField[]
}

const BLANK: FormState = {
  area_id: '',
  nombre: '',
  leyenda: '',
  responsable_default_id: '',
  requiere_evidencia: false,
  campos: [],
}

export default function CatalogoAdmin({ catalog, areas, profiles }: { catalog: CatalogItem[]; areas: Area[]; profiles: Profile[] }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(BLANK)
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  function startEdit(item: CatalogItem) {
    setForm({
      area_id: item.area_id,
      nombre: item.nombre,
      leyenda: item.leyenda,
      responsable_default_id: item.responsable_default_id ?? '',
      requiere_evidencia: item.requiere_evidencia,
      campos: item.campos ?? [],
    })
    setEditing(item.id)
    setShowForm(true)
  }

  function resetForm() {
    setForm(BLANK)
    setEditing(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.area_id || !form.nombre || !form.leyenda) return

    // Validaciones del builder
    const keys = new Set<string>()
    for (const c of form.campos) {
      if (!c.label.trim() || !c.key.trim()) {
        toast.error('Hay un campo sin etiqueta. Revísalo.')
        return
      }
      if (keys.has(c.key)) {
        toast.error(`Hay dos campos con el mismo identificador (${c.key}).`)
        return
      }
      keys.add(c.key)
      if (c.type === 'select' && (!c.options || c.options.length === 0)) {
        toast.error(`El campo "${c.label}" es de selección y no tiene opciones.`)
        return
      }
    }

    setLoading(true)
    const supabase = createClient()
    const payload = {
      area_id: form.area_id,
      nombre: form.nombre,
      leyenda: form.leyenda,
      responsable_default_id: form.responsable_default_id || null,
      requiere_evidencia: form.requiere_evidencia,
      campos: form.campos,
    }
    const { error } = editing
      ? await supabase.from('problem_catalog').update(payload).eq('id', editing)
      : await supabase.from('problem_catalog').insert(payload)

    if (error) {
      toast.error('Error al guardar. Intenta de nuevo.')
      setLoading(false)
      return
    }
    toast.success(editing ? 'Tipo actualizado' : 'Tipo de problema creado')
    resetForm()
    router.refresh()
    setLoading(false)
  }

  async function toggleActivo(item: CatalogItem) {
    const supabase = createClient()
    const { error } = await supabase.from('problem_catalog').update({ activo: !item.activo }).eq('id', item.id)
    if (error) { toast.error('Error al actualizar.'); return }
    toast.success(item.activo ? 'Tipo desactivado' : 'Tipo activado')
    router.refresh()
  }

  const areaName = (id: string) => areas.find(a => a.id === id)?.nombre ?? '—'

  return (
    <div className="flex flex-col gap-6 w-full min-w-0 max-w-5xl">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="self-start bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
        >
          Nuevo tipo de problema
        </button>
      )}

      {showForm && (
        <div className="border border-[#ECECEC] rounded-md p-5 flex flex-col gap-4">
          <p className="text-[13px] font-medium text-navy">{editing ? 'Editar tipo' : 'Nuevo tipo de problema'}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-ink-700">Área</label>
              <select value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} className={selectClass}>
                <option value="">Selecciona un área</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-ink-700">Responsable por defecto</label>
              <select value={form.responsable_default_id} onChange={e => setForm(f => ({ ...f, responsable_default_id: e.target.value }))} className={selectClass}>
                <option value="">Sin responsable</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-700">Nombre</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Ticket no reflejado" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-ink-700">Leyenda (instrucciones al usuario)</label>
            <textarea value={form.leyenda} onChange={e => setForm(f => ({ ...f, leyenda: e.target.value }))} rows={3} placeholder="Explica qué debe hacer el usuario antes de levantar este ticket..." className={`${inputClass} resize-none`} />
          </div>

          <FieldsBuilder
            value={form.campos}
            onChange={campos => setForm(f => ({ ...f, campos }))}
          />

          <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.requiere_evidencia}
              onChange={e => setForm(f => ({ ...f, requiere_evidencia: e.target.checked }))}
              className="accent-orange"
            />
            Requiere evidencia (adjuntos obligatorios)
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading || !form.area_id || !form.nombre || !form.leyenda}
              className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear'}
            </button>
            <button onClick={resetForm} className="border border-[#ECECEC] text-ink-900 text-[12.5px] font-medium rounded px-[14px] py-[7px] hover:bg-surface-hover transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="border border-[#ECECEC] rounded-md overflow-hidden w-full">
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_160px_120px] px-5 py-2 border-b border-[#ECECEC] bg-surface-sidebar gap-4">
          {['Tipo de problema', 'Área', ''].map(h => (
            <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
          ))}
        </div>
        {catalog.map((item, i) => (
          <div key={item.id} className={`grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_120px] items-center px-5 py-3 gap-4 ${i < catalog.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}>
            <div className="min-w-0">
              <p className={`text-[13px] font-medium truncate ${item.activo ? 'text-ink-900' : 'text-ink-400 line-through'}`}>{item.nombre}</p>
              <p className="text-[11.5px] text-ink-400 truncate">{item.leyenda}</p>
              {item.campos && item.campos.length > 0 && (
                <p className="text-[11px] text-ink-400 mt-0.5 truncate">
                  {item.campos.length} campo{item.campos.length !== 1 ? 's' : ''}
                  {item.requiere_evidencia ? ' · evidencia' : ''}
                </p>
              )}
            </div>
            <span className="text-[12.5px] text-ink-700 truncate min-w-0">{areaName(item.area_id)}</span>
            <div className="flex gap-3 justify-end">
              <button onClick={() => startEdit(item)} className="text-[12px] text-ink-400 hover:text-ink-700 transition-colors">Editar</button>
              <button onClick={() => toggleActivo(item)} className="text-[12px] text-ink-400 hover:text-ink-700 transition-colors">
                {item.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
