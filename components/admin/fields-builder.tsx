'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react'
import type { ProblemField, ProblemFieldType } from '@/lib/supabase/types'
import { slugifyKey } from '@/lib/schemas/ticket'

interface Props {
  value: ProblemField[]
  onChange: (campos: ProblemField[]) => void
}

const TIPOS: { value: ProblemFieldType; label: string }[] = [
  { value: 'text', label: 'Texto corto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Selección' },
]

const inputClass = 'bg-white border border-[#ECECEC] rounded px-2 py-[6px] text-[12.5px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange transition-all w-full'

export default function FieldsBuilder({ value, onChange }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  function update(idx: number, patch: Partial<ProblemField>) {
    onChange(value.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...value]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    const tmp = next[idx]
    next[idx] = next[target]
    next[target] = tmp
    onChange(next)
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
    if (editingIdx === idx) setEditingIdx(null)
  }

  function add() {
    const usedKeys = new Set(value.map(c => c.key))
    let baseKey = 'campo'
    let i = value.length + 1
    while (usedKeys.has(`${baseKey}_${i}`)) i++
    const newField: ProblemField = {
      key: `${baseKey}_${i}`,
      label: `Campo ${i}`,
      type: 'text',
      required: true,
    }
    onChange([...value, newField])
    setEditingIdx(value.length)
  }

  function handleLabelChange(idx: number, newLabel: string) {
    const existing = value[idx]
    const slug = slugifyKey(newLabel) || `campo_${idx + 1}`
    let finalKey = slug
    let suffix = 2
    const otherKeys = new Set(value.filter((_, i) => i !== idx).map(c => c.key))
    while (otherKeys.has(finalKey)) {
      finalKey = `${slug}_${suffix}`
      suffix++
    }
    update(idx, { label: newLabel, key: existing.key.startsWith('campo_') ? finalKey : existing.key })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-medium text-ink-700">
          Campos del formulario
        </label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[12px] text-orange hover:text-orange-dark font-medium transition-colors"
        >
          <Plus size={12} />
          Agregar campo
        </button>
      </div>

      {value.length === 0 && (
        <p className="text-[12px] text-ink-400 border border-dashed border-[#ECECEC] rounded px-3 py-3">
          Sin campos. El usuario solo escribirá el comentario inicial.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {value.map((campo, idx) => {
          const isEditing = editingIdx === idx
          return (
            <div key={idx} className="border border-[#ECECEC] rounded p-3 bg-surface-sidebar/40">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="text-ink-400 hover:text-ink-700 disabled:opacity-30"
                    aria-label="Subir"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === value.length - 1}
                    className="text-ink-400 hover:text-ink-700 disabled:opacity-30"
                    aria-label="Bajar"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingIdx(isEditing ? null : idx)}
                  className="flex-1 text-left"
                >
                  <p className="text-[12.5px] font-medium text-ink-900">
                    {campo.label}{' '}
                    {campo.required && <span className="text-red-500 text-[11px]">*</span>}
                  </p>
                  <p className="text-[11px] text-ink-400">
                    {TIPOS.find(t => t.value === campo.type)?.label}
                    {' · '}
                    <span className="font-mono">{campo.key}</span>
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-ink-400 hover:text-red-600 transition-colors"
                  aria-label="Eliminar"
                >
                  <X size={14} />
                </button>
              </div>

              {isEditing && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-[11px] text-ink-500">Etiqueta</label>
                    <input
                      value={campo.label}
                      onChange={e => handleLabelChange(idx, e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-ink-500">Tipo</label>
                    <select
                      value={campo.type}
                      onChange={e => update(idx, { type: e.target.value as ProblemFieldType })}
                      className={inputClass}
                    >
                      {TIPOS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-ink-500">Placeholder</label>
                    <input
                      value={campo.placeholder ?? ''}
                      onChange={e => update(idx, { placeholder: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  {campo.type === 'select' && (
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[11px] text-ink-500">
                        Opciones (una por línea)
                      </label>
                      <textarea
                        value={(campo.options ?? []).join('\n')}
                        onChange={e =>
                          update(idx, {
                            options: e.target.value
                              .split('\n')
                              .map(s => s.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={3}
                        className={`${inputClass} resize-none font-mono`}
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-[12px] text-ink-700 mt-1">
                    <input
                      type="checkbox"
                      checked={campo.required}
                      onChange={e => update(idx, { required: e.target.checked })}
                      className="accent-orange"
                    />
                    Obligatorio
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
