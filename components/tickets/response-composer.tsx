'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  ticketId: string
  userId: string
  esResponsable: boolean
  esLevantador: boolean
  isTerminado: boolean
}

export default function ResponseComposer({
  ticketId,
  userId,
  esResponsable,
  esLevantador,
  isTerminado,
}: Props) {
  const router = useRouter()
  const [contenido, setContenido] = useState('')
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<FileList | null>(null)

  async function getNextOrder(): Promise<number> {
    const supabase = createClient()
    const { data } = await supabase
      .from('ticket_responses')
      .select('orden')
      .eq('ticket_id', ticketId)
      .order('orden', { ascending: false })
      .limit(1)
      .single()
    const row = data as { orden: number } | null
    return (row?.orden ?? 0) + 1
  }

  async function submitResponse(tipo: 'mensaje' | 'terminado_responsable' | 'terminado_usuario') {
    if (tipo === 'mensaje' && !contenido.trim()) return
    setLoading(true)

    const supabase = createClient()
    const orden = await getNextOrder()

    const text = tipo === 'mensaje'
      ? contenido.trim()
      : tipo === 'terminado_responsable'
        ? 'El responsable marcó este ticket como terminado.'
        : 'El usuario confirmó el cierre del ticket.'

    const { data: resp, error } = await supabase
      .from('ticket_responses')
      .insert({ ticket_id: ticketId, orden, autor_id: userId, contenido: text, tipo })
      .select('id')
      .single()

    if (!error && resp && files && files.length > 0) {
      await Promise.all(Array.from(files).map(async (file) => {
        const path = `${ticketId}/${Date.now()}-${file.name}`
        const { data: upload } = await supabase.storage.from('ticket-attachments').upload(path, file)
        if (upload) {
          await supabase.from('ticket_attachments').insert({
            ticket_id: ticketId,
            response_id: resp.id,
            storage_path: upload.path,
            nombre_original: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by_id: userId,
          })
        }
      }))
    }

    setContenido('')
    setFiles(null)
    setLoading(false)
    router.refresh()
  }

  // Si el ticket está terminado y el levantador aún no confirma
  if (isTerminado && esLevantador) {
    return (
      <div className="border border-[#ECECEC] rounded-md p-4 bg-surface-sidebar flex flex-col gap-3">
        <p className="text-[13px] text-ink-700">
          El responsable marcó este ticket como terminado. ¿El problema fue resuelto?
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => submitResponse('terminado_usuario')}
            disabled={loading}
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50"
          >
            Confirmar cierre
          </button>
          <button
            onClick={() => submitResponse('mensaje')}
            disabled={loading || !contenido.trim()}
            className="bg-transparent border border-[#ECECEC] text-ink-900 text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            Reabrir con comentario
          </button>
        </div>
        {/* Textarea para reabrir */}
        <textarea
          value={contenido}
          onChange={e => setContenido(e.target.value)}
          placeholder="Explica por qué el problema no está resuelto..."
          rows={3}
          className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all resize-none"
        />
      </div>
    )
  }

  return (
    <div className="border border-[#ECECEC] rounded-md p-4 flex flex-col gap-3">
      <textarea
        value={contenido}
        onChange={e => setContenido(e.target.value)}
        placeholder="Escribe tu respuesta..."
        rows={4}
        className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all resize-none w-full"
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Adjuntos */}
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={e => setFiles(e.target.files)}
          className="text-[12px] text-ink-500 file:mr-2 file:py-[4px] file:px-3 file:rounded file:border file:border-[#ECECEC] file:text-[11.5px] file:font-medium file:text-ink-700 file:bg-white hover:file:bg-surface-hover file:cursor-pointer"
        />

        <div className="flex gap-2 flex-wrap">
          {/* Marcar terminado — solo responsable */}
          {esResponsable && !isTerminado && (
            <button
              onClick={() => submitResponse('terminado_responsable')}
              disabled={loading}
              className="bg-transparent border border-[#ECECEC] text-ink-900 text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              Marcar como terminado
            </button>
          )}

          <button
            onClick={() => submitResponse('mensaje')}
            disabled={loading || !contenido.trim()}
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Responder'}
          </button>
        </div>
      </div>
    </div>
  )
}
