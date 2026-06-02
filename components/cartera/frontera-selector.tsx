'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

interface Props {
  fronteraActual: string   // YYYY-MM-DD
  fronteraDefault: string  // YYYY-MM-DD (se omite del URL cuando coincide)
}

export default function FronteraSelector({ fronteraActual, fronteraDefault }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(value: string) {
    if (!value) return
    const params = new URLSearchParams(searchParams.toString())
    if (value === fronteraDefault) params.delete('frontera')
    else params.set('frontera', value)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
        Fecha frontera
      </label>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={fronteraActual}
          onChange={e => update(e.target.value)}
          disabled={pending}
          className="border border-[#ECECEC] rounded px-2.5 py-1.5 text-[13px] text-ink-900 bg-white outline-none focus:border-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {fronteraActual !== fronteraDefault && (
          <button
            onClick={() => update(fronteraDefault)}
            disabled={pending}
            className="text-[12px] text-navy hover:underline disabled:opacity-50"
          >
            Default
          </button>
        )}
      </div>
    </div>
  )
}
