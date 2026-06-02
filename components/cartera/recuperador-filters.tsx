'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

interface Props {
  fechas: string[]                 // YYYY-MM-DD ordenadas desc
  coordinaciones: string[]
  fechaActual: string
  coordinacionActual: string | null
}

export default function RecuperadorFilters({
  fechas,
  coordinaciones,
  fechaActual,
  coordinacionActual,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '') params.delete(key)
    else params.set(key, value)
    // Cambiar de fecha puede invalidar la coordinación seleccionada.
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
        <select
          value={fechaActual}
          onChange={e => update('fecha', e.target.value)}
          disabled={pending}
          className={baseSelect}
        >
          {fechas.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </Field>

      <Field label="Coordinación">
        <select
          value={coordinacionActual ?? ''}
          onChange={e => update('coordinacion', e.target.value)}
          disabled={pending}
          className={baseSelect}
        >
          <option value="">Todas</option>
          {coordinaciones.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      {coordinacionActual && (
        <button
          onClick={() => update('coordinacion', '')}
          disabled={pending}
          className="text-[12px] text-ink-500 hover:text-ink-900 underline underline-offset-2 pb-1.5"
        >
          Limpiar
        </button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
