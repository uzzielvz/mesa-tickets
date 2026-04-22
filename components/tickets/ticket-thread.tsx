import { formatDate } from '@/lib/utils/format'

interface Response {
  id: string
  orden: number
  autor_id: string
  contenido: string
  tipo: string
  created_at: string
  profiles: { nombre_completo: string; rol: string } | null
}

interface Attachment {
  id: string
  response_id: string | null
  nombre_original: string
  storage_path: string
  mime_type: string
}

interface Props {
  responses: Response[]
  attachments: Attachment[]
  levantadoPorId: string
}

const TIPO_LABEL: Record<string, string> = {
  terminado_responsable: 'Marcó como terminado',
  terminado_usuario: 'Confirmó el cierre',
}

export default function TicketThread({ responses, attachments, levantadoPorId }: Props) {
  if (responses.length === 0) {
    return (
      <div className="mx-5 md:mx-9 py-8 text-center">
        <p className="text-[13px] text-ink-400">Sin respuestas aún.</p>
      </div>
    )
  }

  return (
    <div className="mx-5 md:mx-9 flex flex-col gap-0">
      {responses.map((resp, i) => {
        const isUser = resp.autor_id === levantadoPorId
        const isSystem = resp.tipo !== 'mensaje'
        const respAttachments = attachments.filter(a => a.response_id === resp.id)

        if (isSystem) {
          return (
            <div key={resp.id} className="flex items-center gap-3 py-4">
              <div className="flex-1 h-px bg-[#ECECEC]" />
              <span className="text-[11.5px] text-ink-400">
                {resp.profiles?.nombre_completo} — {TIPO_LABEL[resp.tipo]}
              </span>
              <div className="flex-1 h-px bg-[#ECECEC]" />
            </div>
          )
        }

        return (
          <div
            key={resp.id}
            className={`flex flex-col gap-1 py-5 ${i < responses.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
          >
            {/* Autor y fecha */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Avatar */}
                <div className="w-6 h-6 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-medium text-white">
                    {resp.profiles?.nombre_completo.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <span className="text-[12.5px] font-medium text-ink-900">
                  {resp.profiles?.nombre_completo}
                </span>
                {!isUser && (
                  <span className="text-[11px] text-ink-400 bg-surface-sidebar border border-[#ECECEC] rounded px-1.5 py-px">
                    Responsable
                  </span>
                )}
              </div>
              <span className="text-[12px] text-ink-400">{formatDate(resp.created_at)}</span>
            </div>

            {/* Contenido */}
            <p className="text-[13px] text-ink-700 leading-relaxed pl-8 whitespace-pre-wrap">
              {resp.contenido}
            </p>

            {/* Adjuntos */}
            {respAttachments.length > 0 && (
              <div className="pl-8 flex flex-wrap gap-2 mt-1">
                {respAttachments.map(att => (
                  <span
                    key={att.id}
                    className="text-[11.5px] text-ink-500 border border-[#ECECEC] rounded px-2 py-1 bg-surface-sidebar"
                  >
                    {att.nombre_original}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
