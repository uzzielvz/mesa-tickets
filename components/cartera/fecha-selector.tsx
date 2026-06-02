'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

interface Props {
  fechas: string[]        // YYYY-MM-DD ordenadas desc
  fechaActual: string
}

export default function FechaSelector({ fechas, fechaActual }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('fecha', value)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
        Fecha de corte
      </label>
      <select
        value={fechaActual}
        onChange={e => update(e.target.value)}
        disabled={pending}
        className="border border-[#ECECEC] rounded px-2.5 py-1.5 text-[13px] text-ink-900 bg-white outline-none focus:border-orange transition-colors min-w-[150px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {fechas.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </div>
  )
}
