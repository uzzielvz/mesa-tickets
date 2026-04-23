'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { newTicketSchema, type NewTicketInput } from '@/lib/schemas/ticket'


interface Area { id: string; nombre: string }
interface CatalogItem {
  id: string
  area_id: string
  nombre: string
  leyenda: string
  responsable_default_id: string | null
  requiere_grupo: boolean
  requiere_cliente: boolean
  requiere_ciclo: boolean
  requiere_evidencia: boolean
}

interface Props {
  areas: Area[]
  catalog: CatalogItem[]
  userId: string
}

export default function TicketForm({ areas, catalog, userId }: Props) {
  const router = useRouter()
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedProblem, setSelectedProblem] = useState<CatalogItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<FileList | null>(null)

  const [areaError, setAreaError] = useState('')
  const [problemError, setProblemError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<NewTicketInput>({
    resolver: zodResolver(newTicketSchema),
  })

  const filteredCatalog = catalog.filter(c => c.area_id === selectedArea)

  function handleAreaChange(areaId: string) {
    setSelectedArea(areaId)
    setSelectedProblem(null)
    setAreaError('')
    setProblemError('')
  }

  function handleProblemChange(problemId: string) {
    const problem = catalog.find(c => c.id === problemId) ?? null
    setSelectedProblem(problem)
    setProblemError('')
  }

  async function onSubmit(data: NewTicketInput) {
    // Validar selects manualmente
    if (!selectedArea) { setAreaError('Selecciona un área'); return }
    if (!selectedProblem) { setProblemError('Selecciona un tipo de problema'); return }
    setLoading(true)

    const supabase = createClient()

    // Crear el ticket — select('id, numero') evita una segunda query
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        problem_catalog_id: selectedProblem.id,
        levantado_por_id: userId,
        responsable_id: selectedProblem.responsable_default_id ?? userId,
        grupo: data.grupo || null,
        cliente: data.cliente || null,
        ciclo_cliente: data.ciclo_cliente || null,
      })
      .select('id, numero')
      .single()

    if (ticketError || !ticket) {
      setLoading(false)
      return
    }

    // Insertar primera respuesta (orden 1, del usuario que levanta)
    await supabase.from('ticket_responses').insert({
      ticket_id: ticket.id,
      orden: 1,
      autor_id: userId,
      contenido: data.comentario,
      tipo: 'mensaje',
    })

    // Subir adjuntos en paralelo si hay
    if (files && files.length > 0) {
      await Promise.all(Array.from(files).map(async (file) => {
        const path = `${ticket.id}/${Date.now()}-${file.name}`
        const { data: upload } = await supabase.storage
          .from('ticket-attachments')
          .upload(path, file)

        if (upload) {
          await supabase.from('ticket_attachments').insert({
            ticket_id: ticket.id,
            storage_path: upload.path,
            nombre_original: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by_id: userId,
          })
        }
      }))
    }

    router.push(`/tickets/${ticket.numero}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 pt-2">

      {/* Área */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-medium text-ink-700">Área</label>
        <select
          value={selectedArea}
          onChange={e => handleAreaChange(e.target.value)}
          className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all"
        >
          <option value="">Selecciona un área</option>
          {areas.map(a => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
        {areaError && <p className="text-[12px] text-red-600">{areaError}</p>}
      </div>

      {/* Tipo de problema */}
      {selectedArea && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Tipo de problema</label>
          <select
            value={selectedProblem?.id ?? ''}
            onChange={e => handleProblemChange(e.target.value)}
            className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all"
          >
            <option value="">Selecciona el tipo de problema</option>
            {filteredCatalog.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {problemError && <p className="text-[12px] text-red-600">{problemError}</p>}
        </div>
      )}

      {/* Leyenda del problema */}
      {selectedProblem && (
        <div className="bg-surface-sidebar border border-[#ECECEC] rounded-md px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium mb-1">Instrucciones</p>
          <p className="text-[13px] text-ink-700 leading-relaxed">{selectedProblem.leyenda}</p>
        </div>
      )}

      {/* Campos condicionales */}
      {selectedProblem?.requiere_grupo && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Grupo</label>
          <input
            {...register('grupo')}
            placeholder="Nombre del grupo"
            className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all"
          />
        </div>
      )}

      {selectedProblem?.requiere_cliente && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Cliente</label>
          <input
            {...register('cliente')}
            placeholder="Nombre del cliente"
            className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all"
          />
        </div>
      )}

      {selectedProblem?.requiere_ciclo && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Ciclo del cliente</label>
          <input
            {...register('ciclo_cliente')}
            placeholder="Ej: Ciclo 12"
            className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all"
          />
        </div>
      )}

      {/* Comentario inicial */}
      {selectedProblem && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Comentario</label>
          <textarea
            {...register('comentario')}
            rows={4}
            placeholder="Describe el problema con detalle..."
            className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all resize-none"
          />
          {errors.comentario && <p className="text-[12px] text-red-600">{errors.comentario.message}</p>}
        </div>
      )}

      {/* Adjuntos */}
      {selectedProblem && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">
            Evidencia {selectedProblem.requiere_evidencia ? <span className="text-red-500">*</span> : <span className="text-ink-400 font-normal">(opcional)</span>}
          </label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={e => setFiles(e.target.files)}
            className="text-[12.5px] text-ink-700 file:mr-3 file:py-[5px] file:px-3 file:rounded file:border file:border-[#ECECEC] file:text-[12px] file:font-medium file:text-ink-700 file:bg-white hover:file:bg-surface-hover file:cursor-pointer"
          />
        </div>
      )}

      {/* Submit */}
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
