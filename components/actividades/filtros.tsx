'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { X } from 'lucide-react'

export interface OpcionesFiltro {
  direcciones: string[]
  gerencias: string[]
  puestos: string[]
  categorias: string[]
  empleados: { no_empleado: string; nombre: string }[]
}

interface Props {
  periodos: string[]
  opciones: OpcionesFiltro
  actual: {
    periodo: string
    direccion: string | null
    gerencia: string | null
    puesto: string | null
    empleado: string | null
    categoria: string | null
  }
}

/**
 * Fila única de filtros arriba de las gráficas, compartida por las tres
 * pantallas del módulo: el estado vive en la URL, así que cambiar de pantalla
 * conserva lo que estabas mirando y un tablero filtrado se puede compartir por
 * link — cosa que el Power BI no permite.
 */
export default function FiltrosActividades({ periodos, opciones, actual }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '') params.delete(key)
    else params.set(key, value)
    // Cambiar de periodo puede dejar filtros que ahí no existen (alguien que no
    // registró ese mes). Se limpian en vez de mostrar un tablero vacío sin explicar por qué.
    if (key === 'periodo') {
      params.delete('direccion'); params.delete('gerencia')
      params.delete('puesto'); params.delete('empleado'); params.delete('categoria')
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function limpiar() {
    const params = new URLSearchParams()
    if (actual.periodo) params.set('periodo', actual.periodo)
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const activos = [actual.direccion, actual.gerencia, actual.puesto, actual.empleado, actual.categoria]
    .filter(Boolean).length

  const base =
    'border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 ' +
    'bg-white outline-none focus:border-orange transition-colors max-w-[190px] ' +
    'disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className={`flex flex-wrap items-end gap-3 ${pending ? 'opacity-60' : ''} transition-opacity`}>
      <Campo label="Periodo">
        <select value={actual.periodo} onChange={e => update('periodo', e.target.value)}
                disabled={pending} className={base}>
          {periodos.map(p => <option key={p} value={p}>{etiquetaPeriodo(p)}</option>)}
        </select>
      </Campo>

      <Campo label="Dirección">
        <select value={actual.direccion ?? ''} onChange={e => update('direccion', e.target.value)}
                disabled={pending} className={base}>
          <option value="">Todas</option>
          {opciones.direcciones.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </Campo>

      <Campo label="Gerencia">
        <select value={actual.gerencia ?? ''} onChange={e => update('gerencia', e.target.value)}
                disabled={pending} className={base}>
          <option value="">Todas</option>
          {opciones.gerencias.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </Campo>

      <Campo label="Puesto">
        <select value={actual.puesto ?? ''} onChange={e => update('puesto', e.target.value)}
                disabled={pending} className={base}>
          <option value="">Todos</option>
          {opciones.puestos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </Campo>

      <Campo label="Persona">
        <select value={actual.empleado ?? ''} onChange={e => update('empleado', e.target.value)}
                disabled={pending} className={base}>
          <option value="">Todas</option>
          {opciones.empleados.map(e => (
            <option key={e.no_empleado} value={e.no_empleado}>{e.nombre}</option>
          ))}
        </select>
      </Campo>

      <Campo label="Categoría">
        <select value={actual.categoria ?? ''} onChange={e => update('categoria', e.target.value)}
                disabled={pending} className={base}>
          <option value="">Todas</option>
          {opciones.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Campo>

      {activos > 0 && (
        <button
          onClick={limpiar}
          disabled={pending}
          className="flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 border border-[#ECECEC] rounded px-2.5 py-1.5 hover:bg-surface-hover transition-colors"
        >
          <X size={13} />
          Quitar {activos} filtro{activos > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[10.5px] uppercase tracking-[0.4px] text-ink-400 font-medium">{label}</label>
      {children}
    </div>
  )
}

/** '2026-08' → 'Agosto 2026'. Un periodo es un mes, no una cadena técnica. */
export function etiquetaPeriodo(p: string) {
  const [a, m] = p.split('-')
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const nombre = meses[Number(m) - 1]
  return nombre ? `${nombre} ${a}` : p
}
