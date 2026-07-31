'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { guardarPlantilla } from '@/lib/actions/ajustes'
import { PLANTILLAS, placeholdersDe, type PlantillaMeta } from '@/lib/reclutamiento/plantillas'

export interface PlantillaGuardada {
  asunto: string
  cuerpo: string
  cc_emails: string[]
}

const inputClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all w-full'
const labelClass = 'text-[11.5px] font-medium text-ink-500'

export default function PlantillasEditor({
  plantillas,
}: {
  plantillas: Record<string, PlantillaGuardada>
}) {
  const [abierta, setAbierta] = useState<string | null>(null)

  return (
    <div className="flex flex-col divide-y divide-[#F1F1F1]">
      {PLANTILLAS.map(meta => {
        const guardada = plantillas[meta.codigo]
        const abiertaEsta = abierta === meta.codigo
        return (
          <div key={meta.codigo} className="py-2 first:pt-0 last:pb-0">
            <button
              onClick={() => setAbierta(abiertaEsta ? null : meta.codigo)}
              className="flex w-full items-start gap-2 text-left group"
            >
              {abiertaEsta
                ? <ChevronDown size={14} className="text-ink-400 mt-[3px] shrink-0" />
                : <ChevronRight size={14} className="text-ink-300 mt-[3px] shrink-0 group-hover:text-ink-400" />}
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-ink-900">{meta.label}</span>
                <span className="block text-[11.5px] text-ink-400 mt-0.5">{meta.cuando}</span>
              </span>
            </button>

            {abiertaEsta && (
              guardada
                ? <Formulario meta={meta} inicial={guardada} />
                : (
                  <p className="mt-2 ml-6 text-[11.5px] text-[#a16207]">
                    Esta plantilla no existe en la base de datos. Revisa las migraciones.
                  </p>
                )
            )}
          </div>
        )
      })}
    </div>
  )
}

function Formulario({ meta, inicial }: { meta: PlantillaMeta; inicial: PlantillaGuardada }) {
  const router = useRouter()
  const [asunto, setAsunto] = useState(inicial.asunto)
  const [cuerpo, setCuerpo] = useState(inicial.cuerpo)
  const [cc, setCc] = useState(inicial.cc_emails.join(', '))
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  // Mismo criterio que el schema, para avisar antes de que el usuario guarde.
  const usados = [...placeholdersDe(asunto), ...placeholdersDe(cuerpo)]
  const conocidos = new Set(meta.vars.map(v => v.nombre))
  const inventados = Array.from(new Set(usados.filter(p => !conocidos.has(p))))
  const faltantes = meta.requeridos.filter(p => !usados.includes(p))

  function tocar(fn: () => void) {
    fn()
    setGuardado(false)
  }

  async function guardar() {
    setGuardando(true)
    const res = await guardarPlantilla({
      codigo: meta.codigo,
      asunto,
      cuerpo,
      cc_emails: cc.split(',').map(s => s.trim()).filter(Boolean),
    })
    setGuardando(false)
    if (res.ok) {
      toast.success('Plantilla guardada.')
      setGuardado(true)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="mt-3 ml-6 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Asunto</label>
        <input value={asunto} onChange={e => tocar(() => setAsunto(e.target.value))} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Cuerpo</label>
        <textarea
          value={cuerpo}
          onChange={e => tocar(() => setCuerpo(e.target.value))}
          rows={12}
          className={`${inputClass} resize-y font-mono text-[11.5px] leading-[1.6]`}
        />
        <p className="text-[11px] text-ink-400">
          Texto plano. Los saltos de línea se respetan y una línea que empiece con
          <code className="mx-1 text-ink-500">*</code> sale como viñeta.
        </p>
      </div>

      {meta.cc && (
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Copias (CC), separadas por comas</label>
          <input
            value={cc}
            onChange={e => tocar(() => setCc(e.target.value))}
            placeholder="correo@…, otro@…"
            className={inputClass}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className={labelClass}>Variables disponibles</span>
        <div className="flex flex-wrap gap-1">
          {meta.vars.map(v => {
            const enUso = usados.includes(v.nombre)
            const obligatoria = meta.requeridos.includes(v.nombre)
            return (
              <span
                key={v.nombre}
                title={v.descripcion}
                className={`rounded px-1.5 py-[2px] font-mono text-[11px] border ${
                  enUso
                    ? 'border-[#ECECEC] bg-surface-hover text-ink-700'
                    : obligatoria
                      ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                      : 'border-dashed border-[#E4E4E4] text-ink-400'
                }`}
              >
                {`{{${v.nombre}}}`}
              </span>
            )
          })}
        </div>
      </div>

      {(faltantes.length > 0 || inventados.length > 0) && (
        <div className="flex items-start gap-2 border border-[#fde68a] bg-[#fffbeb] rounded px-2.5 py-2">
          <AlertTriangle size={13} className="text-[#a16207] mt-[2px] shrink-0" />
          <div className="text-[11.5px] text-[#a16207] flex flex-col gap-0.5">
            {faltantes.length > 0 && (
              <span>
                Falta {faltantes.map(p => `{{${p}}}`).join(', ')}: sin eso el correo no sirve de nada.
              </span>
            )}
            {inventados.length > 0 && (
              <span>
                {inventados.map(p => `{{${p}}}`).join(', ')} no existe en esta plantilla y se enviaría tal cual.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={guardar}
          disabled={guardando || faltantes.length > 0 || inventados.length > 0}
          className="inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12px] font-medium rounded px-4 py-[7px] disabled:opacity-50 transition-colors"
        >
          {guardando ? 'Guardando…' : 'Guardar plantilla'}
        </button>
        {guardado && !guardando && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#15803d]">
            <Check size={12} /> Guardado
          </span>
        )}
      </div>
    </div>
  )
}
