'use client'

import { useMemo, useState } from 'react'

export type MoraCredito = {
  codigo_acreditado: string
  nombre_acreditado: string | null
  coordinacion: string
  codigo_recuperador: string | null
  nombre_recuperador: string | null
  ciclo: string
  dias_mora: number
  bucket: string
  saldo_total: number
  saldo_vencido: number
  pagos_vencidos: number | null
  dias_desde_ultimo_pago: number | null
  fecha_ultimo_pago: string | null
  alerta: string | null
  criticidad: string | null
  contacto: string | null
}

// Estado de gestión MOCK: solo vive en memoria del cliente (no se persiste).
type GestionEstatus = '' | 'contactado' | 'promesa' | 'no_contesta' | 'visita' | 'pago'
type Gestion = { estatus: GestionEstatus; acuerdoFecha: string; acuerdoMonto: string; nota: string }

const ESTATUS_OPCIONES: { value: GestionEstatus; label: string }[] = [
  { value: '',            label: 'Sin gestión' },
  { value: 'contactado',  label: 'Contactado' },
  { value: 'promesa',     label: 'Promesa de pago' },
  { value: 'pago',        label: 'Pagó' },
  { value: 'no_contesta', label: 'No contesta' },
  { value: 'visita',      label: 'Visita campo' },
]

const ESTATUS_COLOR: Record<GestionEstatus, string> = {
  '':            'text-ink-400',
  contactado:    'text-[#1565C0]',
  promesa:       'text-[#E65100]',
  pago:          'text-[#2E7D32]',
  no_contesta:   'text-[#C62828]',
  visita:        'text-[#6A1B9A]',
}

const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
const fmtNumero = (n: number) => new Intl.NumberFormat('es-MX').format(n)

function bucketTono(bucket: string) {
  if (bucket === '181+' || bucket === '91-180') return 'bg-[#FFEBEE] text-[#C62828]'
  if (bucket === '61-90' || bucket === '31-60') return 'bg-[#FFF3E0] text-[#E65100]'
  return 'bg-[#FFF8E1] text-[#9A7D00]'
}

type SortKey = 'dias_mora' | 'saldo_vencido' | 'nombre_acreditado'

export default function MoraTable({ creditos }: { creditos: MoraCredito[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('dias_mora')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [gestiones, setGestiones] = useState<Record<string, Gestion>>({})

  const gestion = (codigo: string): Gestion =>
    gestiones[codigo] ?? { estatus: '', acuerdoFecha: '', acuerdoMonto: '', nota: '' }

  function setGestion(codigo: string, patch: Partial<Gestion>) {
    setGestiones(prev => ({ ...prev, [codigo]: { ...gestion(codigo), ...patch } }))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir(key === 'nombre_acreditado' ? 'asc' : 'desc') }
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = q
      ? creditos.filter(c =>
          (c.nombre_acreditado ?? '').toLowerCase().includes(q) ||
          c.codigo_acreditado.toLowerCase().includes(q) ||
          (c.nombre_recuperador ?? '').toLowerCase().includes(q))
      : creditos
    const dir = sortDir === 'asc' ? 1 : -1
    return [...base].sort((a, b) => {
      if (sortKey === 'nombre_acreditado') {
        return dir * (a.nombre_acreditado ?? '').localeCompare(b.nombre_acreditado ?? '')
      }
      return dir * ((a[sortKey] as number) - (b[sortKey] as number))
    })
  }, [creditos, busqueda, sortKey, sortDir])

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '')

  return (
    <div className="flex flex-col gap-3">
      {/* Banner modo demo */}
      <div className="flex items-center gap-2 text-[12px] text-[#9A7D00] bg-[#FFF8E1] border border-[#FFE9A8] rounded-md px-3 py-2">
        <span className="font-medium">Modo demostración</span>
        <span className="text-[#7A6400]">
          Las columnas de gestión (estatus, acuerdo, nota) son editables pero aún no se guardan.
        </span>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar acreditado, código o recuperador…"
          className="border border-[#ECECEC] rounded px-3 py-1.5 text-[13px] text-ink-900 bg-white outline-none focus:border-orange transition-colors w-72 max-w-full"
        />
        <p className="text-[12px] text-ink-400">
          {fmtNumero(filtradas.length)} de {fmtNumero(creditos.length)} créditos en mora
        </p>
      </div>

      {/* Tabla */}
      <div className="border border-[#ECECEC] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[1100px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium border-b border-[#F0F0F0] bg-surface-sidebar">
                <th className="text-left px-4 py-2.5 font-medium sticky left-0 bg-surface-sidebar">
                  <button onClick={() => toggleSort('nombre_acreditado')} className="hover:text-ink-700 uppercase tracking-[0.3px]">
                    Acreditado{sortIndicator('nombre_acreditado')}
                  </button>
                </th>
                <th className="text-left  px-3 py-2.5 font-medium">Coordinación</th>
                <th className="text-left  px-3 py-2.5 font-medium">Recuperador</th>
                <th className="text-right px-3 py-2.5 font-medium">
                  <button onClick={() => toggleSort('dias_mora')} className="hover:text-ink-700 uppercase tracking-[0.3px]">
                    Días{sortIndicator('dias_mora')}
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 font-medium">Bucket</th>
                <th className="text-right px-3 py-2.5 font-medium">
                  <button onClick={() => toggleSort('saldo_vencido')} className="hover:text-ink-700 uppercase tracking-[0.3px]">
                    Saldo vencido{sortIndicator('saldo_vencido')}
                  </button>
                </th>
                <th className="text-left px-3 py-2.5 font-medium">Contacto</th>
                {/* Gestión (mock) */}
                <th className="text-left px-3 py-2.5 font-medium border-l border-[#ECECEC] bg-[#FFFDF5]">Estatus</th>
                <th className="text-left px-3 py-2.5 font-medium bg-[#FFFDF5]">Acuerdo</th>
                <th className="text-left px-3 py-2.5 font-medium bg-[#FFFDF5]">Monto</th>
                <th className="text-left px-3 py-2.5 font-medium bg-[#FFFDF5]">Nota</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => {
                const g = gestion(c.codigo_acreditado)
                return (
                  <tr key={c.codigo_acreditado} className="border-b border-[#F5F5F5] hover:bg-surface-hover/40">
                    <td className="px-4 py-2 sticky left-0 bg-white">
                      <div className="text-ink-900 font-medium whitespace-nowrap">{c.nombre_acreditado ?? '—'}</div>
                      <div className="text-ink-400 text-[11.5px] tabular-nums">{c.codigo_acreditado} · ciclo {c.ciclo}</div>
                    </td>
                    <td className="px-3 py-2 text-ink-500 whitespace-nowrap">{c.coordinacion}</td>
                    <td className="px-3 py-2 text-ink-500 whitespace-nowrap">{c.nombre_recuperador ?? c.codigo_recuperador ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-ink-900 font-medium tabular-nums">{fmtNumero(c.dias_mora)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${bucketTono(c.bucket)}`}>
                        {c.bucket}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-900 tabular-nums">{fmtMoneda(c.saldo_vencido)}</td>
                    <td className="px-3 py-2 text-ink-500 whitespace-nowrap max-w-[160px] truncate" title={c.contacto ?? ''}>
                      {c.contacto ?? '—'}
                    </td>

                    {/* ── Columnas de gestión (mock, estado local) ── */}
                    <td className="px-3 py-2 border-l border-[#F5F5F5] bg-[#FFFDF5]">
                      <select
                        value={g.estatus}
                        onChange={e => setGestion(c.codigo_acreditado, { estatus: e.target.value as GestionEstatus })}
                        className={`border border-[#ECECEC] rounded px-2 py-1 text-[12px] bg-white outline-none focus:border-orange ${ESTATUS_COLOR[g.estatus]}`}
                      >
                        {ESTATUS_OPCIONES.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 bg-[#FFFDF5]">
                      <input
                        type="date"
                        value={g.acuerdoFecha}
                        onChange={e => setGestion(c.codigo_acreditado, { acuerdoFecha: e.target.value })}
                        className="border border-[#ECECEC] rounded px-2 py-1 text-[12px] text-ink-900 bg-white outline-none focus:border-orange w-[130px]"
                      />
                    </td>
                    <td className="px-3 py-2 bg-[#FFFDF5]">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="$"
                        value={g.acuerdoMonto}
                        onChange={e => setGestion(c.codigo_acreditado, { acuerdoMonto: e.target.value })}
                        className="border border-[#ECECEC] rounded px-2 py-1 text-[12px] text-ink-900 bg-white outline-none focus:border-orange w-[90px] tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 bg-[#FFFDF5]">
                      <input
                        type="text"
                        placeholder="Observación…"
                        value={g.nota}
                        onChange={e => setGestion(c.codigo_acreditado, { nota: e.target.value })}
                        className="border border-[#ECECEC] rounded px-2 py-1 text-[12px] text-ink-900 bg-white outline-none focus:border-orange w-[160px]"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtradas.length === 0 && (
        <p className="text-[13px] text-ink-400 px-1">No hay créditos que coincidan con la búsqueda.</p>
      )}
    </div>
  )
}
