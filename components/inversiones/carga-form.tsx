'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { etiquetaPeriodo } from '@/lib/inversiones/periodo'
import type { TipoReporte } from '@/lib/inversiones/excel'

interface Exito {
  tipo: TipoReporte
  reporte: string
  periodoInicio: string
  periodoFin: string
  hojas: string[]
  notas: number
  hojasDegradadas: string[]
  avisos: string[]
}

/**
 * Carga de un reporte. Quien la usa sube un archivo todos los días, así que lo
 * que importa no es la subida sino el acuse: **qué reporte entendió el sistema y
 * de qué periodo**. Sin eso, subir el archivo del mes pasado por error no se
 * nota hasta que alguien pregunta por qué no cuadra.
 */
export default function CargaInversiones() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [exito, setExito] = useState<Exito | null>(null)
  const [error, setError] = useState<{ mensaje: string; detalles: string[] } | null>(null)

  async function subir(archivo: File) {
    setError(null); setExito(null); setSubiendo(true)

    const fd = new FormData()
    fd.append('archivo', archivo)

    try {
      const res = await fetch('/api/inversiones/cargar', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setError({
          mensaje: json.error ?? 'No se pudo cargar el archivo',
          detalles: json.errores ?? [],
        })
        return
      }

      setExito(json)
      router.refresh()
    } catch {
      setError({ mensaje: 'Se perdió la conexión durante la carga', detalles: [] })
    } finally {
      setSubiendo(false)
    }
  }

  function elegido(archivos: FileList | null) {
    const archivo = archivos?.[0]
    if (archivo) subir(archivo)
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* ── Zona de arrastre ── */}
      <div
        onDragOver={e => { e.preventDefault(); setSobre(true) }}
        onDragLeave={() => setSobre(false)}
        onDrop={e => { e.preventDefault(); setSobre(false); elegido(e.dataTransfer.files) }}
        onClick={() => !subiendo && inputRef.current?.click()}
        className={`
          border border-dashed rounded-md px-6 py-10 text-center cursor-pointer
          transition-colors
          ${sobre ? 'border-orange bg-[#FFF8F2]' : 'border-[#D8D8D8] bg-white hover:bg-surface-hover'}
          ${subiendo ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={e => elegido(e.target.files)}
        />
        {subiendo ? (
          <div className="flex flex-col items-center gap-2 text-ink-500">
            <Loader2 size={22} className="animate-spin text-navy" />
            <p className="text-[13px]">Revisando el archivo…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud size={24} className="text-ink-400" />
            <p className="text-[13px] text-ink-900 font-medium">
              Arrastra el reporte aquí, o haz clic para elegirlo
            </p>
            <p className="text-[12px] text-ink-500">
              Calendario de Pagos o Tablero Ejecutivo, en .xlsx. Máximo 25 MB.
            </p>
          </div>
        )}
      </div>

      {/* ── Acuse ── */}
      {exito && (
        <div className="border border-[#C8E6C9] bg-[#F1F8F2] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#2E7D32]">
            <CheckCircle2 size={16} /> Reporte guardado
          </p>
          <ul className="text-[12.5px] text-ink-700 flex flex-col gap-0.5">
            <li><strong>{exito.reporte}</strong></li>
            <li>
              Periodo: <strong className="font-medium">
                {etiquetaPeriodo(exito.tipo, exito.periodoInicio, exito.periodoFin)}
              </strong>
            </li>
            <li className="text-ink-500">
              {exito.hojas.length} hojas · {exito.notas} con notas metodológicas
            </li>
          </ul>

          {exito.avisos.length > 0 && (
            <ul className="border-t border-[#C8E6C9] pt-2 flex flex-col gap-1">
              {exito.avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#8A6100]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}

          <a
            href="/inversiones/cargas"
            className="text-[12.5px] text-navy hover:underline font-medium mt-1"
          >
            Ver el historial →
          </a>
        </div>
      )}

      {error && (
        <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#C62828]">
            <AlertTriangle size={16} /> {error.mensaje}
          </p>
          {error.detalles.length > 0 && (
            <>
              <p className="text-[12px] text-[#C62828]">
                No se guardó nada. Lo que ya estaba sigue intacto.
              </p>
              <ul className="text-[12px] text-[#C62828] flex flex-col gap-0.5">
                {error.detalles.map((d, i) => <li key={i}>· {d}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── Qué acepta ── */}
      <div className="border border-[#ECECEC] rounded-md bg-white p-4">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
          <FileSpreadsheet size={15} className="text-ink-400" /> Qué se puede subir
        </p>
        <ul className="mt-2 text-[12.5px] text-ink-500 flex flex-col gap-1">
          <li>
            <strong className="text-ink-700">Calendario de Pagos a Fondeadores</strong> —
            se reconoce por su hoja <span className="font-mono text-[11.5px]">BASE MM</span>.
          </li>
          <li>
            <strong className="text-ink-700">Tablero Ejecutivo de Cartera</strong> —
            se reconoce por su hoja <span className="font-mono text-[11.5px]">Historial_Movimientos</span>.
          </li>
        </ul>
        <p className="mt-3 text-[12px] text-ink-500 border-t border-[#F0F0F0] pt-3">
          El tipo y el periodo se leen <strong className="text-ink-700">del contenido</strong>,
          no del nombre del archivo — así que puedes renombrarlo sin romper nada.
          Cada carga se conserva: subir uno nuevo <strong className="text-ink-700">no
          borra</strong> los anteriores.
        </p>
      </div>
    </div>
  )
}
