'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ProblemField, TicketDatos } from '@/lib/supabase/types'

interface Area { id: string; nombre: string }
interface CatalogItem {
  id: string
  area_id: string
  nombre: string
  leyenda: string
  responsable_default_id: string | null
  requiere_evidencia: boolean
  campos: ProblemField[] | null
}

interface Props {
  areas: Area[]
  catalog: CatalogItem[]
  userId: string
}

const inputClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all'

export default function TicketForm({ areas, catalog, userId }: Props) {
  const router = useRouter()
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedProblem, setSelectedProblem] = useState<CatalogItem | null>(null)
  const [datos, setDatos] = useState<TicketDatos>({})
  const [comentario, setComentario] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(false)

  const [areaError, setAreaError] = useState('')
  const [problemError, setProblemError] = useState('')
  const [comentarioError, setComentarioError] = useState('')
  const [evidenciaError, setEvidenciaError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const filteredCatalog = catalog.filter(c => c.area_id === selectedArea)
  const campos: ProblemField[] = selectedProblem?.campos ?? []

  function handleAreaChange(areaId: string) {
    setSelectedArea(areaId)
    setSelectedProblem(null)
    setDatos({})
    setAreaError('')
    setProblemError('')
    setEvidenciaError('')
    setFieldErrors({})
  }

  function handleProblemChange(problemId: string) {
    const problem = catalog.find(c => c.id === problemId) ?? null
    setSelectedProblem(problem)
    setDatos({})
    setProblemError('')
    setEvidenciaError('')
    setFieldErrors({})
  }

  function setCampo(key: string, value: string) {
    setDatos(d => ({ ...d, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(e => ({ ...e, [key]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedArea) { setAreaError('Selecciona un área'); return }
    if (!selectedProblem) { setProblemError('Selecciona un tipo de problema'); return }

    // Validar campos dinámicos
    const errs: Record<string, string> = {}
    for (const c of campos) {
      const v = (datos[c.key] ?? '').trim()
      if (c.required && !v) {
        errs[c.key] = `${c.label} es obligatorio`
      } else if (v && c.type === 'number' && Number.isNaN(Number(v))) {
        errs[c.key] = `${c.label} debe ser numérico`
      }
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    if (comentario.trim().length < 10) {
      setComentarioError('El comentario debe tener al menos 10 caracteres')
      return
    }
    setComentarioError('')

    if (selectedProblem.requiere_evidencia && (!files || files.length === 0)) {
      setEvidenciaError('Debes adjuntar al menos un archivo de evidencia')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Mapeo de compatibilidad: si los campos dinámicos usan keys
    // reservadas (grupo / cliente / ciclo_cliente), también las
    // escribimos en las columnas legacy para que las vistas y los
    // tickets viejos se sigan viendo igual.
    const grupo = (datos.grupo ?? '').trim() || null
    const cliente = (datos.cliente ?? '').trim() || null
    const ciclo_cliente = (datos.ciclo_cliente ?? '').trim() || null

    // Limpiar datos: solo campos definidos, con trim
    const datosLimpios: TicketDatos = {}
    for (const c of campos) {
      const v = (datos[c.key] ?? '').trim()
      if (v) datosLimpios[c.key] = v
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        problem_catalog_id: selectedProblem.id,
        levantado_por_id: userId,
        responsable_id: selectedProblem.responsable_default_id ?? userId,
        grupo,
        cliente,
        ciclo_cliente,
        datos: datosLimpios,
      })
      .select('id, numero')
      .single()

    if (ticketError || !ticket) {
      setLoading(false)
      toast.error(ticketError?.message ?? 'No se pudo crear el ticket')
      return
    }

    // Insertar la primera respuesta y capturar su id para asociar los
    // adjuntos iniciales — así se muestran correctamente en el hilo.
    const { data: firstResponse, error: respError } = await supabase
      .from('ticket_responses')
      .insert({
        ticket_id: ticket.id,
        orden: 1,
        autor_id: userId,
        contenido: comentario.trim(),
        tipo: 'mensaje',
      })
      .select('id')
      .single()

    if (respError || !firstResponse) {
      setLoading(false)
      toast.error('Ticket creado pero falló la primera respuesta. Contacta soporte.')
      return
    }

    if (files && files.length > 0) {
      const results = await Promise.all(Array.from(files).map(async (file) => {
        const path = `${ticket.id}/${Date.now()}-${file.name}`
        const { data: upload, error: upErr } = await supabase.storage
          .from('ticket-attachments')
          .upload(path, file)

        if (upErr || !upload) return { ok: false, name: file.name }

        const { error: attErr } = await supabase.from('ticket_attachments').insert({
          ticket_id: ticket.id,
          response_id: firstResponse.id,
          storage_path: upload.path,
          nombre_original: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by_id: userId,
        })
        return { ok: !attErr, name: file.name }
      }))

      const fallidos = results.filter(r => !r.ok).map(r => r.name)
      if (fallidos.length > 0) {
        toast.error(`No se subieron: ${fallidos.join(', ')}`)
      }
    }

    toast.success(`Ticket #${ticket.numero} creado`)
    router.push(`/tickets/${ticket.numero}`)
  }

  function renderField(c: ProblemField) {
    const value = datos[c.key] ?? ''
    const err = fieldErrors[c.key]
    const common = {
      id: `f-${c.key}`,
      placeholder: c.placeholder ?? '',
    }

    return (
      <div key={c.key} className="flex flex-col gap-1.5">
        <label htmlFor={common.id} className="text-[12.5px] font-medium text-ink-700">
          {c.label}
          {c.required && <span className="text-red-500"> *</span>}
        </label>
        {c.type === 'textarea' ? (
          <textarea
            {...common}
            value={value}
            rows={3}
            onChange={e => setCampo(c.key, e.target.value)}
            className={`${inputClass} resize-none`}
          />
        ) : c.type === 'select' ? (
          <select
            {...common}
            value={value}
            onChange={e => setCampo(c.key, e.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona...</option>
            {(c.options ?? []).map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={e => setCampo(c.key, e.target.value)}
            className={inputClass}
          />
        )}
        {err && <p className="text-[12px] text-red-600">{err}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-medium text-ink-700">Área</label>
        <select
          value={selectedArea}
          onChange={e => handleAreaChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Selecciona un área</option>
          {areas.map(a => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
        {areaError && <p className="text-[12px] text-red-600">{areaError}</p>}
      </div>

      {selectedArea && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Tipo de problema</label>
          <select
            value={selectedProblem?.id ?? ''}
            onChange={e => handleProblemChange(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona el tipo de problema</option>
            {filteredCatalog.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {problemError && <p className="text-[12px] text-red-600">{problemError}</p>}
        </div>
      )}

      {selectedProblem && (
        <div className="bg-surface-sidebar border border-[#ECECEC] rounded-md px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium mb-1">Instrucciones</p>
          <p className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">{selectedProblem.leyenda}</p>
        </div>
      )}

      {selectedProblem && campos.map(renderField)}

      {selectedProblem && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Comentario</label>
          <textarea
            value={comentario}
            onChange={e => { setComentario(e.target.value); if (comentarioError) setComentarioError('') }}
            rows={4}
            placeholder="Describe el problema con detalle..."
            className={`${inputClass} resize-none`}
          />
          {comentarioError && <p className="text-[12px] text-red-600">{comentarioError}</p>}
        </div>
      )}

      {selectedProblem && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">
            Evidencia {selectedProblem.requiere_evidencia ? <span className="text-red-500">*</span> : <span className="text-ink-400 font-normal">(opcional)</span>}
          </label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={e => { setFiles(e.target.files); setEvidenciaError('') }}
            className="text-[12.5px] text-ink-700 file:mr-3 file:py-[5px] file:px-3 file:rounded file:border file:border-[#ECECEC] file:text-[12px] file:font-medium file:text-ink-700 file:bg-white hover:file:bg-surface-hover file:cursor-pointer"
          />
          {evidenciaError && <p className="text-[12px] text-red-600">{evidenciaError}</p>}
        </div>
      )}

      {selectedProblem && (
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Levantar ticket'}
          </button>
        </div>
      )}
    </form>
  )
}
