'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface Props {
  ticketId: string
  userId: string
  esResponsable: boolean
  esLevantador: boolean
  isTerminado: boolean
}

type Tipo = 'mensaje' | 'terminado_responsable' | 'terminado_usuario' | 'rechazo_responsable'

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
  const [showRechazo, setShowRechazo] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')

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

  async function submitResponse(tipo: Tipo, customText?: string) {
    if (tipo === 'mensaje' && !contenido.trim()) return
    setLoading(true)

    const supabase = createClient()
    const orden = await getNextOrder()

    const text =
      tipo === 'mensaje'
        ? contenido.trim()
        : tipo === 'terminado_responsable'
          ? 'El responsable marcó este ticket como terminado.'
          : tipo === 'terminado_usuario'
            ? 'El usuario confirmó el cierre del ticket.'
            : (customText ?? '').trim()

    const { data: resp, error } = await supabase
      .from('ticket_responses')
      .insert({ ticket_id: ticketId, orden, autor_id: userId, contenido: text, tipo })
      .select('id')
      .single()

    if (!error && resp && tipo === 'mensaje' && files && files.length > 0) {
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

    if (error) {
      toast.error('Error al enviar. Intenta de nuevo.')
      setLoading(false)
      return
    }

    const toastMsg: Record<Tipo, string> = {
      mensaje: 'Respuesta enviada',
      terminado_responsable: 'Ticket marcado como terminado',
      terminado_usuario: 'Ticket cerrado',
      rechazo_responsable: 'Solicitud rechazada',
    }
    toast.success(toastMsg[tipo])

    setContenido('')
    setFiles(null)
    setShowRechazo(false)
    setMotivoRechazo('')
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
        <textarea
          value={contenido}
          onChange={e => setContenido(e.target.value)}
          placeholder="Si el problema no fue resuelto, explica aquí por qué..."
          rows={3}
          className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all resize-none"
        />
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
      </div>
    )
  }

  // Panel de rechazo (solo responsable)
  if (showRechazo && esResponsable) {
    const motivoTrim = motivoRechazo.trim()
    const motivoOk = motivoTrim.length >= 10
    return (
      <div className="border border-red-200 rounded-md p-4 bg-red-50/50 flex flex-col gap-3">
        <div>
          <p className="text-[13px] font-medium text-red-700">Rechazar solicitud</p>
          <p className="text-[12px] text-ink-500 mt-0.5">
            Explica al solicitante por qué se rechaza. Una vez rechazado, el ticket queda cerrado.
          </p>
        </div>
        <textarea
          value={motivoRechazo}
          onChange={e => setMotivoRechazo(e.target.value)}
          placeholder="Ej: falta el comprobante de pago / el cliente no pertenece a tu cartera / etc."
          rows={4}
          autoFocus
          className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-red-400 focus:ring-[3px] focus:ring-red-100 transition-all resize-none"
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11.5px] text-ink-400">
            {motivoOk ? '\u00a0' : 'Mínimo 10 caracteres.'}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setShowRechazo(false); setMotivoRechazo('') }}
              disabled={loading}
              className="bg-transparent border border-[#ECECEC] text-ink-900 text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => submitResponse('rechazo_responsable', motivoTrim)}
              disabled={loading || !motivoOk}
              className="bg-red-600 hover:bg-red-700 text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Rechazando...' : 'Rechazar solicitud'}
            </button>
          </div>
        </div>
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
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={e => setFiles(e.target.files)}
          className="text-[12px] text-ink-500 file:mr-2 file:py-[4px] file:px-3 file:rounded file:border file:border-[#ECECEC] file:text-[11.5px] file:font-medium file:text-ink-700 file:bg-white hover:file:bg-surface-hover file:cursor-pointer"
        />

        <div className="flex gap-2 flex-wrap">
          {esResponsable && !isTerminado && (
            <>
              <button
                onClick={() => setShowRechazo(true)}
                disabled={loading}
                className="bg-transparent border border-red-200 text-red-700 text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Rechazar solicitud
              </button>
              <button
                onClick={() => submitResponse('terminado_responsable')}
                disabled={loading}
                className="bg-transparent border border-[#ECECEC] text-ink-900 text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors hover:bg-surface-hover disabled:opacity-50"
              >
                Marcar como terminado
              </button>
            </>
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
