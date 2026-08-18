'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { etiquetaPeriodo } from '@/lib/actividades/periodo'

interface Exito {
  periodos: string[]
  registros: number
  colaboradores: number
  horas: number
  empleados: number
  puestos: number
  avisos: string[]
}

/**
 * Carga del Excel. Diseñada para alguien que sube un archivo una vez al mes y no
 * quiere aprender nada: arrastrar, soltar, y ver en palabras qué acaba de entrar.
 * El resumen de después importa tanto como la subida — sin él, "se cargó" es un
 * acto de fe.
 */
export default function CargaActividades() {
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
      const res = await fetch('/api/actividades/cargar', { method: 'POST', body: fd })
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
            <p className="text-[13px]">Leyendo el archivo…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud size={24} className="text-ink-400" />
            <p className="text-[13px] text-ink-900 font-medium">
              Arrastra el Excel aquí, o haz clic para elegirlo
            </p>
            <p className="text-[12px] text-ink-500">
              Archivo .xlsx con la hoja <span className="font-mono text-[11.5px]">Tabla_actividad</span>. Máximo 10 MB.
            </p>
          </div>
        )}
      </div>

      {/* ── Resultado ── */}
      {exito && (
        <div className="border border-[#C8E6C9] bg-[#F1F8F2] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#2E7D32]">
            <CheckCircle2 size={16} /> Periodo cargado
          </p>
          <ul className="text-[12.5px] text-ink-700 flex flex-col gap-0.5">
            <li>
              <strong>{exito.periodos.map(etiquetaPeriodo).join(', ')}</strong>
              {exito.periodos.length > 1 ? ' quedaron actualizados' : ' quedó actualizado'}
            </li>
            <li>{exito.registros.toLocaleString('es-MX')} registros · {exito.colaboradores} colaboradores · {exito.horas.toLocaleString('es-MX')} horas</li>
            {(exito.empleados > 0 || exito.puestos > 0) && (
              <li className="text-ink-500">
                Catálogos: {exito.empleados} empleados, {exito.puestos} puestos
              </li>
            )}
          </ul>
          {exito.avisos.length > 0 && (
            <ul className="text-[12px] text-ink-500 border-t border-[#C8E6C9] pt-2 flex flex-col gap-0.5">
              {exito.avisos.map((a, i) => <li key={i}>· {a}</li>)}
            </ul>
          )}
          <a href="/actividades" className="text-[12.5px] text-navy hover:underline font-medium mt-1">
            Ver el tablero →
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
                No se cargó nada — los datos que ya estaban siguen intactos. Corrige y vuelve a subir:
              </p>
              <ul className="text-[12px] text-[#C62828] flex flex-col gap-0.5 font-mono">
                {error.detalles.map((d, i) => <li key={i}>· {d}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── Qué espera el archivo ── */}
      <div className="border border-[#ECECEC] rounded-md bg-white p-4">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
          <FileSpreadsheet size={15} className="text-ink-400" /> Qué debe traer el archivo
        </p>
        <ul className="mt-2 text-[12.5px] text-ink-500 flex flex-col gap-1">
          <li>
            <strong className="text-ink-700">Tabla_actividad</strong> — obligatoria. Encabezados en la
            primera fila: <span className="font-mono text-[11.5px]">ID_REGISTRO, FECHA, NO_EMPLEADO, NOMBRE, ACTIVIDAD, CATEGORIA, MINUTOS</span>.
          </li>
          <li>
            <strong className="text-ink-700">Empleados</strong> y <strong className="text-ink-700">Puestos</strong> — opcionales.
            Si vienen, actualizan los catálogos; si no, se conservan los que ya había.
          </li>
        </ul>
        <p className="mt-3 text-[12px] text-ink-500 border-t border-[#F0F0F0] pt-3">
          Subir otra vez el mismo periodo lo <strong className="text-ink-700">reemplaza</strong>, no lo
          duplica. Los periodos que el archivo no menciona no se tocan.
        </p>
      </div>
    </div>
  )
}
