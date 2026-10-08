'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { leerReporteDepositos, type DepositoFila } from '@/lib/auditor/depositos'
import { pesos } from '@/lib/auditor/tipos'

const LOTE = 2000 // ~480 KB por petición

interface Revision {
  nombre: string
  filas: DepositoFila[]
  rechazadas: number
  noConciliados: number
  montoNoConciliado: number
  fechaMin: string | null
  fechaMax: string | null
  avisos: string[]
}

interface Acuse {
  filas: number
  no_conciliados: number
  fecha_min: string | null
  fecha_max: string | null
}

const fmt = (n: number) => n.toLocaleString('es-MX')
const fecha = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'

/**
 * Carga del reporte de depósitos de Yunius (AUD-003). Se lee en el navegador
 * (pesa más de lo que acepta una función de Vercel) y entra por lotes. Dos
 * pasos: primero se enseña qué trae el archivo, después se escribe. La foto
 * solo se vuelve la vigente si entró completa.
 */
export default function CargaDepositos() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [revision, setRevision] = useState<Revision | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [acuse, setAcuse] = useState<Acuse | null>(null)
  const [error, setError] = useState<{ mensaje: string; detalles: string[] } | null>(null)
  const cargando = progreso !== null

  useEffect(() => {
    if (!cargando) return
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [cargando])

  function reiniciar() {
    setRevision(null); setAcuse(null); setError(null); setProgreso(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function elegido(archivo: File | undefined) {
    if (!archivo) return
    reiniciar()
    if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
      setError({ mensaje: 'Solo se aceptan archivos .xlsx', detalles: [] })
      return
    }
    setLeyendo(true)
    try {
      const lectura = await leerReporteDepositos(await archivo.arrayBuffer())
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
    setProgreso(0)
    const supabase = createClient()
    const { data: id, error: e1 } = await supabase.rpc('aud_dep_iniciar_carga', {
      p_nombre: revision.nombre, p_filas: revision.filas.length,
      p_rechazadas: revision.rechazadas, p_avisos: revision.avisos,
    })
    if (e1 || !id) {
      setProgreso(null)
      setError({ mensaje: 'No se pudo iniciar la carga', detalles: [e1?.message ?? 'sin respuesta'] })
      return
    }
    for (let i = 0; i < revision.filas.length; i += LOTE) {
      const { error: e2 } = await supabase.rpc('aud_dep_cargar_lote', { p_carga: id, p_filas: revision.filas.slice(i, i + LOTE) })
      if (e2) {
        setProgreso(null)
        setError({
          mensaje: 'La carga se detuvo a la mitad',
          detalles: [e2.message, 'No se volvió la vigente: el Auditor sigue mostrando la foto anterior. Sube el archivo de nuevo.'],
        })
        return
      }
      setProgreso(Math.min(i + LOTE, revision.filas.length))
    }
    const { data: cierre, error: e3 } = await supabase.rpc('aud_dep_cerrar_carga', { p_carga: id })
    setProgreso(null)
    if (e3) { setError({ mensaje: 'No se pudo cerrar la carga', detalles: [e3.message] }); return }
    setAcuse(cierre as unknown as Acuse)
    setRevision(null)
    router.refresh()
  }

  const total = revision?.filas.length ?? 0
  const pct = cargando && total > 0 ? Math.round((progreso! / total) * 100) : 0

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
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={e => elegido(e.target.files?.[0])} />
          {leyendo ? (
            <div className="flex flex-col items-center gap-2 text-ink-500">
              <Loader2 size={22} className="animate-spin text-navy" />
              <p className="text-[13px]">Leyendo el reporte… puede tardar unos segundos</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud size={24} className="text-ink-400" />
              <p className="text-[13px] text-ink-900 font-medium">Arrastra el reporte de depósitos aquí, o haz clic para elegirlo</p>
              <p className="text-[12px] text-ink-500">El de Yunius (Grup_Depósito_Garantía…), en .xlsx.</p>
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
            <dt className="text-ink-500">Movimientos</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(revision.filas.length)}</dd>
            <dt className="text-ink-500">Periodo</dt>
            <dd className="text-ink-900 text-right">{fecha(revision.fechaMin)} – {fecha(revision.fechaMax)}</dd>
            <dt className="text-ink-500">No conciliados</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{revision.noConciliados} · {pesos(revision.montoNoConciliado)}</dd>
            {revision.rechazadas > 0 && (
              <>
                <dt className="text-[#C62828]">No se pudieron leer</dt>
                <dd className="text-[#C62828] text-right font-medium tabular-nums">{fmt(revision.rechazadas)}</dd>
              </>
            )}
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
            Este archivo reemplaza la foto anterior de depósitos. La anterior se conserva en el historial.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={cargar} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-4 py-2">
              <UploadCloud size={14} /> Cargar {fmt(revision.filas.length)} movimientos
            </button>
            <button onClick={reiniciar} className="text-[13px] font-medium text-ink-500 hover:text-ink-900 px-3 py-2">Elegir otro archivo</button>
          </div>
        </div>
      )}

      {cargando && (
        <div className="border border-[#ECECEC] rounded-md bg-white p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] text-ink-900 font-medium">
            <Loader2 size={15} className="animate-spin text-navy" /> Cargando {fmt(progreso!)} de {fmt(total)}…
          </p>
          <div className="h-[7px] bg-[#F5F5F5] rounded-[4px] overflow-hidden">
            <div className="h-full bg-navy rounded-[4px] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[12px] text-ink-500">No cierres esta pestaña hasta que termine.</p>
        </div>
      )}

      {acuse && (
        <div className="border border-[#C8E6C9] bg-[#F1F8F2] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#2E7D32]">
            <CheckCircle2 size={16} /> Reporte de depósitos cargado
          </p>
          <p className="text-[12.5px] text-ink-700">
            {fmt(acuse.filas)} movimientos del {fecha(acuse.fecha_min)} al {fecha(acuse.fecha_max)} · {acuse.no_conciliados} no conciliados.
          </p>
          <a href="/auditor" className="text-[12.5px] text-navy hover:underline font-medium">Ver la conciliación →</a>
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
