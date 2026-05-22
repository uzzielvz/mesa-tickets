'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { CarteraUpload, UploadEstado } from '@/lib/cartera/types'

const ESTADO_LABEL: Record<UploadEstado, string> = {
  pendiente:  'Pendiente',
  procesando: 'Procesando…',
  procesado:  'Procesado',
  error:      'Error',
}

const ESTADO_COLOR: Record<UploadEstado, string> = {
  pendiente:  'bg-[#FFF3E0] text-[#E65100]',
  procesando: 'bg-[#E3F2FD] text-[#1565C0]',
  procesado:  'bg-[#E8F5E9] text-[#2E7D32]',
  error:      'bg-[#FFEBEE] text-[#C62828]',
}

function EstadoBadge({ estado }: { estado: UploadEstado }) {
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${ESTADO_COLOR[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  )
}

export default function UploadForm({ uploads: initial }: { uploads: CarteraUpload[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState(initial)
  const [dragging, setDragging] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [fechaCorte, setFechaCorte] = useState('')
  const [uploading, setUploading] = useState(false)
  const [procesando, setProcesando] = useState<string | null>(null)

  // Polling mientras algún upload esté procesando
  const hayProcesando = uploads.some(u => u.estado === 'procesando')

  const refrescarUploads = useCallback(async () => {
    const res = await fetch('/api/cartera/uploads')
    if (res.ok) {
      const data = await res.json()
      setUploads(data.uploads)
    }
  }, [])

  useEffect(() => {
    if (!hayProcesando) return
    const interval = setInterval(refrescarUploads, 3000)
    return () => clearInterval(interval)
  }, [hayProcesando, refrescarUploads])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setArchivo(file)
  }

  async function handleUpload() {
    if (!archivo || !fechaCorte) {
      toast.error('Selecciona el archivo y la fecha de corte.')
      return
    }
    if (!archivo.name.endsWith('.xlsx')) {
      toast.error('Solo se aceptan archivos .xlsx')
      return
    }

    setUploading(true)
    const form = new FormData()
    form.append('archivo', archivo)
    form.append('fecha_corte', fechaCorte)

    const res = await fetch('/api/cartera/upload', { method: 'POST', body: form })
    const json = await res.json()
    setUploading(false)

    if (!res.ok) { toast.error(json.error ?? 'Error al subir'); return }

    toast.success('Archivo registrado')
    setArchivo(null)
    setFechaCorte('')
    if (fileRef.current) fileRef.current.value = ''
    await refrescarUploads()
    router.refresh()
  }

  async function handleProcesar(uploadId: string) {
    setProcesando(uploadId)
    // Optimistic update
    setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, estado: 'procesando' } : u))

    const res = await fetch(`/api/cartera/procesar?uploadId=${uploadId}`, { method: 'POST' })
    const json = await res.json()
    setProcesando(null)

    if (!res.ok) { toast.error(json.error ?? 'Error al procesar'); await refrescarUploads(); return }

    toast.success('Procesado correctamente')
    await refrescarUploads()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* ── Formulario de carga ── */}
      <div className="border border-[#ECECEC] rounded-md p-5 flex flex-col gap-4">
        <p className="text-[13px] font-medium text-ink-900">Subir reporte de Yunius</p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            border-2 border-dashed rounded-md px-6 py-8 text-center cursor-pointer transition-colors
            ${dragging ? 'border-orange bg-[#FFF8F2]' : 'border-[#DCDCDC] hover:border-[#BBBBBB]'}
          `}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) setArchivo(e.target.files[0]) }}
          />
          {archivo ? (
            <p className="text-[13px] text-ink-900 font-medium">{archivo.name}</p>
          ) : (
            <>
              <p className="text-[13px] text-ink-500">Arrastra el archivo aquí o haz clic para seleccionar</p>
              <p className="text-[11.5px] text-ink-400 mt-1">Solo .xlsx · máx. 10 MB</p>
            </>
          )}
        </div>

        {/* Fecha de corte */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-ink-500">Fecha de corte</label>
          <input
            type="date"
            value={fechaCorte}
            onChange={e => setFechaCorte(e.target.value)}
            className="border border-[#ECECEC] rounded px-3 py-1.5 text-[13px] text-ink-900 outline-none focus:border-orange transition-all w-44"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !archivo || !fechaCorte}
          className="self-start bg-navy text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? 'Subiendo…' : 'Subir reporte'}
        </button>
      </div>

      {/* ── Lista de cargas recientes ── */}
      {uploads.length > 0 && (
        <div className="border border-[#ECECEC] rounded-md overflow-hidden">
          <div className="px-5 py-2 border-b border-[#ECECEC] bg-surface-sidebar">
            <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Cargas recientes</p>
          </div>
          {uploads.map((u, i) => (
            <div
              key={u.id}
              className={`flex items-center justify-between px-5 py-3 gap-4 ${i < uploads.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[13px] font-medium text-ink-900 truncate">{u.nombre_archivo}</p>
                <p className="text-[11.5px] text-ink-400">Corte: {u.fecha_corte}</p>
                {u.estado === 'error' && u.error_detalle && (
                  <p className="text-[11.5px] text-red-600">{u.error_detalle}</p>
                )}
                {u.estado === 'procesado' && u.rows_inserted !== null && (
                  <p className="text-[11.5px] text-ink-400">{u.rows_inserted} registros</p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <EstadoBadge estado={u.estado} />
                {u.estado === 'pendiente' && (
                  <button
                    onClick={() => handleProcesar(u.id)}
                    disabled={procesando === u.id}
                    className="text-[12px] font-medium text-navy hover:underline disabled:opacity-40"
                  >
                    Procesar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
