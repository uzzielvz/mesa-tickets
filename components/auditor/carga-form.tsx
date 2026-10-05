'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface Resultado {
  registros: number
  sin_conciliar: number
  monto_sin_conciliar: number
  fecha_min: string | null
  fecha_max: string | null
}

const pesos = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fecha = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'

/** Subida del archivo de pagos registrados. El acuse dice qué periodo trae, para notar si es el mes equivocado. */
export default function CargaAuditor() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [exito, setExito] = useState<{ resultado: Resultado; avisos: string[] } | null>(null)
  const [error, setError] = useState<{ mensaje: string; detalles: string[] } | null>(null)

  async function subir(archivo: File) {
    setError(null); setExito(null); setSubiendo(true)
    const fd = new FormData()
    fd.append('archivo', archivo)
    try {
      const res = await fetch('/api/auditor/cargar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError({ mensaje: json.error ?? 'No se pudo cargar', detalles: json.errores ?? [] }); return }
      setExito(json)
      router.refresh()
    } catch {
      setError({ mensaje: 'Se perdió la conexión durante la carga', detalles: [] })
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div
        onDragOver={e => { e.preventDefault(); setSobre(true) }}
        onDragLeave={() => setSobre(false)}
        onDrop={e => { e.preventDefault(); setSobre(false); const f = e.dataTransfer.files?.[0]; if (f) subir(f) }}
        onClick={() => !subiendo && inputRef.current?.click()}
        className={`
          border border-dashed rounded-md px-6 py-10 text-center cursor-pointer transition-colors
          ${sobre ? 'border-orange bg-[#FFF8F2]' : 'border-[#D8D8D8] bg-white hover:bg-surface-hover'}
          ${subiendo ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }} />
        {subiendo ? (
          <div className="flex flex-col items-center gap-2 text-ink-500">
            <Loader2 size={22} className="animate-spin text-navy" />
            <p className="text-[13px]">Revisando el archivo…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud size={24} className="text-ink-400" />
            <p className="text-[13px] text-ink-900 font-medium">Arrastra el archivo aquí, o haz clic para elegirlo</p>
            <p className="text-[12px] text-ink-500">Pagos registrados de Yunius, en .xlsx (columnas CONCILIADO, CDGCLNS, FREALDEP…).</p>
          </div>
        )}
      </div>

      {exito && (
        <div className="border border-[#C8E6C9] bg-[#F1F8F2] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#2E7D32]">
            <CheckCircle2 size={16} /> Archivo cargado
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="text-ink-500">Depósitos registrados</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{exito.resultado.registros.toLocaleString('es-MX')}</dd>
            <dt className="text-ink-500">Periodo</dt>
            <dd className="text-ink-900 text-right">{fecha(exito.resultado.fecha_min)} – {fecha(exito.resultado.fecha_max)}</dd>
            <dt className="text-ink-500">Sin conciliar</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{exito.resultado.sin_conciliar}</dd>
            <dt className="text-ink-500">Monto sin conciliar</dt>
            <dd className="text-ink-900 text-right font-medium tabular-nums">{pesos(exito.resultado.monto_sin_conciliar)}</dd>
          </dl>
          {exito.avisos.length > 0 && (
            <ul className="border-t border-[#C8E6C9] pt-2 flex flex-col gap-1">
              {exito.avisos.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#8A6100]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{a}</span>
                </li>
              ))}
            </ul>
          )}
          <a href="/auditor" className="text-[12.5px] text-navy hover:underline font-medium mt-1">Ver lo que falta conciliar →</a>
        </div>
      )}

      {error && (
        <div className="border border-[#FFCDD2] bg-[#FFEBEE] rounded-md p-4 flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[#C62828]">
            <AlertTriangle size={16} /> {error.mensaje}
          </p>
          {error.detalles.length > 0 && (
            <>
              <p className="text-[12px] text-[#C62828]">No se guardó nada.</p>
              <ul className="text-[12px] text-[#C62828] flex flex-col gap-0.5">
                {error.detalles.map((d, i) => <li key={i}>· {d}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
