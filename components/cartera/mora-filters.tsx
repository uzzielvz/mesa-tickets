'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

interface Props {
  fechas: string[]
  coordinaciones: string[]
  fechaActual: string
  coordinacionActual: string | null
  diasMinActual: number
}

const DIAS_OPCIONES = [
  { value: '1',  label: 'Todos (≥ 1 día)' },
  { value: '8',  label: '≥ 8 días' },
  { value: '31', label: '≥ 31 días (PAR 30)' },
  { value: '91', label: '≥ 91 días (PAR 90)' },
]

export default function MoraFilters({
  fechas,
  coordinaciones,
  fechaActual,
  coordinacionActual,
  diasMinActual,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '' || (key === 'dias' && value === '1')) params.delete(key)
    else params.set(key, value)
    if (key === 'fecha') params.delete('coordinacion')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const baseSelect =
    'border border-[#ECECEC] rounded px-2.5 py-1.5 text-[13px] text-ink-900 ' +
    'bg-white outline-none focus:border-orange transition-colors min-w-[150px] ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Fecha de corte">
        <select value={fechaActual} onChange={e => update('fecha', e.target.value)} disabled={pending} className={baseSelect}>
          {fechas.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>

      <Field label="Coordinación">
        <select value={coordinacionActual ?? ''} onChange={e => update('coordinacion', e.target.value)} disabled={pending} className={baseSelect}>
          <option value="">Todas</option>
          {coordinaciones.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Días de mora">
        <select value={String(diasMinActual)} onChange={e => update('dias', e.target.value)} disabled={pending} className={baseSelect}>
          {DIAS_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{label}</label>
      {children}
    </div>
  )
}
