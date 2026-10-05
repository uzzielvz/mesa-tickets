'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { leerCsvAhorros, type FilaAhorro } from '@/lib/ahorros/csv'

/** ~600 KB por lote: lejos de cualquier límite de cuerpo y ~112 viajes para el archivo completo. */
const LOTE = 1000
const MAX_MB = 80

interface Revision {
  nombre: string
  filas: FilaAhorro[]
  rechazadas: number
  grupos: string[]
  clientes: number
  avisos: string[]
}

interface Acuse {
  filas: number
  rechazadas: number
  insertadas: number
  actualizadas: number
  sin_cambio: number
  grupos: number
}

const fmt = (n: number) => n.toLocaleString('es-MX')

/**
 * Carga del CSV de ahorros (AHO-001). Dos pasos a propósito: primero se lee y
 * se muestra QUÉ trae el archivo; solo después se escribe. El upsert sobrescribe
 * valores sin dejar rastro, así que subir el archivo equivocado tiene que
 * notarse antes de tocar la base, no después.
 *
 * El archivo se lee aquí, en el navegador, y se manda por lotes: el CSV
 * completo pesa ~29 MB y una función de Vercel no acepta más de 4.5 MB.
 */
export default function CargaAhorros() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [revision, setRevision] = useState<Revision | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [acuse, setAcuse] = useState<Acuse | null>(null)
  const [error, setError] = useState<{ mensaje: string; detalles: string[] } | null>(null)

  const cargando = progreso !== null

  // Cerrar la pestaña a media carga deja una carga incompleta. No rompe nada
  // (lo que entró se queda y resubir no duplica), pero conviene avisar.
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

  async function elegido(archivos: FileList | null) {
    const archivo = archivos?.[0]
    if (!archivo) return
    reiniciar()

    if (!archivo.name.toLowerCase().endsWith('.csv')) {
      setError({ mensaje: 'Solo se aceptan archivos .csv', detalles: [] })
      return
    }
    if (archivo.size > MAX_MB * 1024 * 1024) {
      setError({ mensaje: `El archivo supera ${MAX_MB} MB`, detalles: [] })
      return
    }

    setLeyendo(true)
    try {
      const texto = await archivo.text()
      // Deja que la pantalla pinte "Revisando…" antes de la lectura pesada.
      await new Promise(r => setTimeout(r, 30))
      const lectura = leerCsvAhorros(texto)
      if (!lectura.ok) {
        setError({ mensaje: 'No se puede cargar este archivo', detalles: lectura.errores })
        return
      }
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

    const { data: cargaId, error: errInicio } = await supabase.rpc('aho_iniciar_carga', {
      p_nombre: revision.nombre,
      p_filas: revision.filas.length,
      p_rechazadas: revision.rechazadas,
      p_grupos: revision.grupos,
      p_avisos: revision.avisos,
    })
    if (errInicio || !cargaId) {
      setProgreso(null)
      setError({ mensaje: 'No se pudo iniciar la carga', detalles: [errInicio?.message ?? 'sin respuesta'] })
      return
    }

    for (let i = 0; i < revision.filas.length; i += LOTE) {
      const lote = revision.filas.slice(i, i + LOTE)
      const { error: errLote } = await supabase.rpc('aho_cargar_lote', { p_carga: cargaId, p_filas: lote })
      if (errLote) {
        setProgreso(null)
        setError({
          mensaje: 'La carga se detuvo a la mitad',
          detalles: [
            errLote.message,
            `Entraron ${fmt(i)} de ${fmt(revision.filas.length)} registros. Lo que entró se queda; volver a subir el archivo es seguro, no duplica nada.`,
          ],
        })
        return
      }
      setProgreso(i + lote.length)
    }

    const { data: cierre, error: errCierre } = await supabase.rpc('aho_cerrar_carga', { p_carga: cargaId })
    setProgreso(null)
    if (errCierre) {
      setError({
        mensaje: 'Los registros entraron, pero la carga no se pudo cerrar',
        detalles: [errCierre.message, 'Los datos ya se pueden consultar; en el historial la carga aparecerá como incompleta.'],
      })
      return
    }
    setAcuse(cierre as unknown as Acuse)
    setRevision(null)
    router.refresh()
  }

  const total = revision?.filas.length ?? 0
  const pct = cargando && total > 0 ? Math.round((progreso! / total) * 100) : 0

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* ── Paso 1: elegir ── */}
      {!revision && !cargando && (
        <div
          onDragOver={e => { e.preventDefault(); setSobre(true) }}
          onDragLeave={() => setSobre(false)}
          onDrop={e => { e.preventDefault(); setSobre(false); elegido(e.dataTransfer.files) }}
          onClick={() => !leyendo && inputRef.current?.click()}
          className={`
            border border-dashed rounded-md px-6 py-10 text-center cursor-pointer transition-colors
            ${sobre ? 'border-orange bg-[#FFF8F2]' : 'border-[#D8D8D8] bg-white hover:bg-surface-hover'}
            ${leyendo ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => elegido(e.target.files)}
          />
          {leyendo ? (
            <div className="flex flex-col items-center gap-2 text-ink-500">
              <Loader2 size={22} className="animate-spin text-navy" />
              <p className="text-[13px]">Revisando el archivo…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud size={24} className="text-ink-400" />
              <p className="text-[13px] text-ink-900 font-medium">
                Arrastra el CSV aquí, o haz clic para elegirlo
              </p>
              <p className="text-[12px] text-ink-500">
                El archivo de pagos con pago semanal por cliente, separado por punto y coma.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Paso 2: revisar antes de escribir ── */}
      {revision && !cargando && (
        <div className="border border-[#ECECEC] rounded-md bg-white p-4 flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
            <FileSpreadsheet size={16} className="text-ink-400" />
            <span className="font-mono text-[12px] truncate">{revision.nombre}</span>
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="text-ink-500">Registros (cliente × semana)</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(revision.filas.length)}</dd>
            <dt className="text-ink-500">Grupo-ciclo</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(revision.grupos.length)}</dd>
            <dt className="text-ink-500">Clientes</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(revision.clientes)}</dd>
            {revision.rechazadas > 0 && (
              <>
                <dt className="text-[#C62828]">No se pudieron leer</dt>
                <dd className="text-[#C62828] text-right font-medium tabular-nums">{fmt(revision.rechazadas)}</dd>
              </>
            )}
          </dl>

          {revision.grupos.length <= 12 && (
            <p className="text-[12px] text-ink-500">
              Grupos: <span className="font-mono text-[11.5px]">{revision.grupos.join(', ')}</span>
            </p>
          )}

          {revision.avisos.length > 0 && (
            <ul className="border-t border-[#F0F0F0] pt-2 flex flex-col gap-1">
              {revision.avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#8A6100]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[12px] text-ink-500 border-t border-[#F0F0F0] pt-2">
            Al cargar, los registros que ya existían toman los valores de este archivo y los nuevos se
            agregan. <strong className="text-ink-700">No se borra nada.</strong> Sube solo lo que ya cuadraste.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={cargar}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-4 py-2 transition-colors"
            >
              <UploadCloud size={14} /> Cargar {fmt(revision.filas.length)} registros
            </button>
            <button
              onClick={reiniciar}
              className="text-[13px] font-medium text-ink-500 hover:text-ink-900 rounded px-3 py-2 transition-colors"
            >
              Elegir otro archivo
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: cargando ── */}
      {cargando && (
        <div className="border border-[#ECECEC] rounded-md bg-white p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] text-ink-900 font-medium">
            <Loader2 size={15} className="animate-spin text-navy" />
            Cargando {fmt(progreso!)} de {fmt(total)}…
          </p>
          <div className="h-[7px] bg-[#F5F5F5] rounded-[4px] overflow-hidden">
            <div className="h-full bg-navy rounded-[4px] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[12px] text-ink-500">No cierres esta pestaña hasta que termine.</p>
        </div>
      )}

      {/* ── Acuse ── */}
      {acuse && (
        <div className="border border-[#C8E6C9] bg-[#F1F8F2] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#2E7D32]">
            <CheckCircle2 size={16} /> Carga completa
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="text-ink-500">Registros nuevos</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(acuse.insertadas)}</dd>
            <dt className="text-ink-500">Registros que cambiaron</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(acuse.actualizadas)}</dd>
            <dt className="text-ink-500">Sin cambio</dt>
            <dd className="text-ink-500 text-right tabular-nums">{fmt(acuse.sin_cambio)}</dd>
            <dt className="text-ink-500">Grupo-ciclo en el archivo</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{fmt(acuse.grupos)}</dd>
          </dl>
          <div className="flex gap-4 mt-1">
            <a href="/ahorros" className="text-[12.5px] text-navy hover:underline font-medium">Buscar un grupo →</a>
            <button onClick={reiniciar} className="text-[12.5px] text-ink-500 hover:text-ink-900 font-medium">
              Cargar otro archivo
            </button>
          </div>
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
          {!cargando && (
            <button onClick={reiniciar} className="self-start text-[12.5px] text-[#C62828] font-medium hover:underline">
              Empezar de nuevo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
