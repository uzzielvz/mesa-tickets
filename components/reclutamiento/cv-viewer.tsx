'use client'

import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, Loader2, X } from 'lucide-react'
import { urlFirmadaCv } from '@/lib/actions/reclutamiento'

// El bucket `reclutamiento` es privado: la vista previa usa una URL firmada
// temporal (10 min). Solo los PDF se pueden embeber; DOC/DOCX se descargan.
export default function CvViewer({ path, onQuitar }: { path: string; onQuitar?: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setUrl(null)
    setError(null)
    urlFirmadaCv(path).then(res => {
      if (!vigente) return
      if (res.ok) setUrl(res.url)
      else setError(res.error)
    })
    return () => { vigente = false }
  }, [path])

  // El path guardado es `<vacanteId>/<uuid>-<nombre original>`.
  const nombre = (path.split('/').pop() ?? 'CV').replace(/^[0-9a-f-]{36}-/i, '')
  const esPdf = nombre.toLowerCase().endsWith('.pdf')

  return (
    <div className="border border-[#ECECEC] rounded overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-surface-sidebar px-3 py-2">
        <span className="flex items-center gap-2 text-[12.5px] text-ink-700 min-w-0">
          <FileText size={14} className="shrink-0 text-ink-400" />
          <span className="truncate">{nombre}</span>
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {url && (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en una pestaña nueva"
                className="p-1 text-ink-400 hover:text-ink-700 transition-colors"
              >
                <ExternalLink size={14} />
              </a>
              <a
                href={`${url}&download=${encodeURIComponent(nombre)}`}
                title="Descargar"
                className="p-1 text-ink-400 hover:text-ink-700 transition-colors"
              >
                <Download size={14} />
              </a>
            </>
          )}
          {onQuitar && (
            <button
              type="button"
              onClick={onQuitar}
              title="Quitar CV"
              className="p-1 text-ink-300 hover:text-red-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </span>
      </div>

      {error ? (
        <p className="px-3 py-4 text-[12px] text-ink-400">{error}</p>
      ) : !url ? (
        <p className="flex items-center gap-2 px-3 py-4 text-[12px] text-ink-400">
          <Loader2 size={13} className="animate-spin" />
          Cargando el CV...
        </p>
      ) : esPdf ? (
        <iframe
          src={url}
          title={nombre}
          className="w-full border-0 bg-[#f5f5f5] h-[60vh] min-h-[340px] sm:h-[75vh]"
        />
      ) : (
        <p className="px-3 py-4 text-[12px] text-ink-400">
          Este formato no se puede previsualizar en el navegador. Descárgalo para verlo.
        </p>
      )}
    </div>
  )
}
