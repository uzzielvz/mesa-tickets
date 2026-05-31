'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

type RecuperadorOpt = { codigo: string; nombre: string | null }

interface Props {
  fechas: string[]                   // YYYY-MM-DD ordenadas desc
  coordinaciones: string[]
  recuperadores: RecuperadorOpt[]
  ciclos: string[]
  fechaActual: string
  coordinacionActual: string | null
  recuperadorActual: string | null
  cicloActual: string | null
}

export default function DashboardFilters({
  fechas,
  coordinaciones,
  recuperadores,
  ciclos,
  fechaActual,
  coordinacionActual,
  recuperadorActual,
  cicloActual,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '') params.delete(key)
    else params.set(key, value)
    // Si cambia la fecha de corte, los demás filtros pueden quedar inválidos.
    if (key === 'fecha') {
      params.delete('coordinacion')
      params.delete('recuperador')
      params.delete('ciclo')
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function reset() {
    const params = new URLSearchParams()
    params.set('fecha', fechaActual)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const hayFiltro = !!(coordinacionActual || recuperadorActual || cicloActual)

  const baseSelect =
    'border border-[#ECECEC] rounded px-2.5 py-1.5 text-[13px] text-ink-900 ' +
    'bg-white outline-none focus:border-orange transition-colors min-w-[150px] ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterField label="Fecha de corte">
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
      </FilterField>

      <FilterField label="Coordinación">
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
      </FilterField>

      <FilterField label="Recuperador">
        <select
          value={recuperadorActual ?? ''}
          onChange={e => update('recuperador', e.target.value)}
          disabled={pending}
          className={baseSelect}
        >
          <option value="">Todos</option>
          {recuperadores.map(r => (
            <option key={r.codigo} value={r.codigo}>
              {r.codigo}{r.nombre ? ` · ${r.nombre}` : ''}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Ciclo">
        <select
          value={cicloActual ?? ''}
          onChange={e => update('ciclo', e.target.value)}
          disabled={pending}
          className={baseSelect}
        >
          <option value="">Todos</option>
          {ciclos.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FilterField>

      {hayFiltro && (
        <button
          onClick={reset}
          disabled={pending}
          className="text-[12px] text-ink-500 hover:text-ink-900 underline underline-offset-2 pb-1.5"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
