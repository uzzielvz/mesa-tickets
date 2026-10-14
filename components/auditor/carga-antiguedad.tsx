'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { leerReporteAntiguedad, type GrupoAntiguedad } from '@/lib/auditor/antiguedad'

interface Revision {
  nombre: string
  grupos: GrupoAntiguedad[]
  fechaCorte: string | null
  promotores: number
  gerentes: number
  avisos: string[]
}

interface Acuse {
  grupos: number
  promotores: number
  gerentes: number
  sin_correo: string[]
}

const fmt = (n: number) => n.toLocaleString('es-MX')
const fecha = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—'

/**
 * Carga del reporte de antigüedad grupal (AUD-004): de quién es cada grupo.
 * Se lee en el navegador, como el de depósitos, y entra en una sola llamada
 * (~520 grupos). Al cargar se busca la cuenta de cada promotor y gerente; los
 * que no se encuentran se asignan abajo, en "Promotores y gerentes".
 */
export default function CargaAntiguedad() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [revision, setRevision] = useState<Revision | null>(null)
  const [acuse, setAcuse] = useState<Acuse | null>(null)
  const [error, setError] = useState<{ mensaje: string; detalles: string[] } | null>(null)

  function reiniciar() {
    setRevision(null); setAcuse(null); setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function elegido(archivo: File | undefined) {
    if (!archivo) return
    reiniciar()
    if (!/\.xls[xm]$/i.test(archivo.name)) {
      setError({ mensaje: 'Solo se aceptan archivos .xlsm o .xlsx', detalles: [] })
      return
    }
    setLeyendo(true)
    try {
      const lectura = await leerReporteAntiguedad(await archivo.arrayBuffer())
      if (!lectura.ok) { setError({ mensaje: 'No se puede cargar este archivo', detalles: lectura.errores }); return }
      setRevision({ nombre: archivo.name, ...lectura })
    } catch (e) {
      setError({ mensaje: 'No se pudo leer el archivo', detalles: [e instanceof Error ? e.message : String(e)] })
    } finally {
      setLeyendo(false)
    }
  }

  async function cargar() {
    if (!revision) return
    setError(null)
    setCargando(true)
    const { data, error: e } = await createClient().rpc('aud_ant_cargar', {
      p_nombre: revision.nombre,
      p_fecha_corte: revision.fechaCorte,
      p_grupos: revision.grupos,
      p_avisos: revision.avisos,
    })
    setCargando(false)
    if (e) { setError({ mensaje: 'No se pudo cargar el reporte', detalles: [e.message] }); return }
    setAcuse(data as unknown as Acuse)
    setRevision(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {!revision && !cargando && (
        <div
          onDragOver={e => { e.preventDefault(); setSobre(true) }}
          onDragLeave={() => setSobre(false)}
          onDrop={e => { e.preventDefault(); setSobre(false); elegido(e.dataTransfer.files?.[0]) }}
          onClick={() => !leyendo && inputRef.current?.click()}
          className={`border border-dashed rounded-md px-6 py-8 text-center cursor-pointer transition-colors
            ${sobre ? 'border-orange bg-[#FFF8F2]' : 'border-[#D8D8D8] bg-white hover:bg-surface-hover'}
            ${leyendo ? 'pointer-events-none opacity-70' : ''}`}
        >
          <input ref={inputRef} type="file" accept=".xlsm,.xlsx" className="hidden" onChange={e => elegido(e.target.files?.[0])} />
          {leyendo ? (
            <div className="flex flex-col items-center gap-2 text-ink-500">
              <Loader2 size={22} className="animate-spin text-navy" />
              <p className="text-[13px]">Leyendo el reporte…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud size={24} className="text-ink-400" />
              <p className="text-[13px] text-ink-900 font-medium">Arrastra el reporte de antigüedad grupal aquí, o haz clic para elegirlo</p>
              <p className="text-[12px] text-ink-500">El de Yunius (AntigüedadGrupal_…), en .xlsm o .xlsx. Se lee la hoja CARTERA.</p>
            </div>
          )}
        </div>
      )}

      {revision && !cargando && (
        <div className="border border-[#ECECEC] rounded-md bg-white p-4 flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
            <FileSpreadsheet size={16} className="text-ink-400" />
            <span className="font-mono text-[12px] truncate">{revision.nombre}</span>
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="text-ink-500">Corte</dt>
            <dd className="text-ink-900 text-right">{fecha(revision.fechaCorte)}</dd>
            <dt className="text-ink-500">Grupos</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(revision.grupos.length)}</dd>
            <dt className="text-ink-500">Promotores</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{revision.promotores}</dd>
            <dt className="text-ink-500">Gerentes</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{revision.gerentes}</dd>
          </dl>
          {revision.avisos.length > 0 && (
            <ul className="border-t border-[#F0F0F0] pt-2 flex flex-col gap-1">
              {revision.avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#8A6100]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{a}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-ink-500 border-t border-[#F0F0F0] pt-2">
            Este reporte decide qué grupos ve cada promotor y cada gerente desde que se carga. Reemplaza al anterior, que queda en el historial.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={cargar} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-4 py-2">
              <UploadCloud size={14} /> Cargar {fmt(revision.grupos.length)} grupos
            </button>
            <button onClick={reiniciar} className="text-[13px] font-medium text-ink-500 hover:text-ink-900 px-3 py-2">Elegir otro archivo</button>
          </div>
        </div>
      )}

      {cargando && (
        <div className="border border-[#ECECEC] rounded-md bg-white p-4">
          <p className="flex items-center gap-2 text-[13px] text-ink-900 font-medium">
            <Loader2 size={15} className="animate-spin text-navy" /> Cargando y buscando las cuentas…
          </p>
        </div>
      )}

      {acuse && (
        <div className="border border-[#C8E6C9] bg-[#F1F8F2] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#2E7D32]">
            <CheckCircle2 size={16} /> Reporte de antigüedad cargado
          </p>
          <p className="text-[12.5px] text-ink-700">
            {fmt(acuse.grupos)} grupos · {acuse.promotores} promotores · {acuse.gerentes} gerentes.
          </p>
          {acuse.sin_correo.length > 0 && (
            <p className="text-[12.5px] text-[#8A6100]">
              No se encontró la cuenta de {acuse.sin_correo.length === 1 ? 'una persona' : `${acuse.sin_correo.length} personas`}: {acuse.sin_correo.join(', ')}. Asígnala abajo para que vea lo suyo.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#C62828]">
            <AlertTriangle size={16} /> {error.mensaje}
          </p>
          {error.detalles.length > 0 && (
            <ul className="text-[12px] text-[#C62828] flex flex-col gap-0.5">
              {error.detalles.map((d, i) => <li key={i}>· {d}</li>)}
            </ul>
          )}
          <button onClick={reiniciar} className="self-start text-[12.5px] text-[#C62828] font-medium hover:underline">Empezar de nuevo</button>
        </div>
      )}
    </div>
  )
}
