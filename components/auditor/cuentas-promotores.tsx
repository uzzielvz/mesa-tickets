'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sugerirCuenta } from '@/lib/auditor/personas'
import type { CandidatoCuenta, PersonaReporte } from '@/lib/auditor/tipos'

/**
 * De qué cuenta es cada promotor y gerente del reporte de antigüedad vigente
 * (AUD-004). La base la busca sola al cargar; aquí se asigna a mano la que no
 * encontró o se corrige. Lo asignado a mano sobrevive a las cargas siguientes.
 */
export default function CuentasPromotores({ personas, candidatos }: { personas: PersonaReporte[]; candidatos: CandidatoCuenta[] }) {
  const sinCuenta = personas.filter(p => !p.email).length
  const grupos = (['promotor', 'gerente'] as const).map(papel => ({
    papel,
    lista: personas
      .filter(p => p.papel === papel)
      .sort((a, b) => Number(!!a.email) - Number(!!b.email) || a.nombre.localeCompare(b.nombre, 'es')),
  }))

  return (
    <div className="flex flex-col">
      {sinCuenta > 0 && (
        <p className="px-5 py-3 text-[12.5px] text-[#8A6100] border-b border-[#F5F5F5]">
          {sinCuenta === 1 ? 'Una persona no tiene' : `${sinCuenta} personas no tienen`} cuenta asignada: no pueden ver sus grupos hasta que se les asigne un correo.
        </p>
      )}
      <datalist id="aud-candidatos">
        {candidatos.map(c => <option key={c.email} value={c.email}>{c.nombre}</option>)}
      </datalist>
      {grupos.map(({ papel, lista }) => lista.length > 0 && (
        <div key={papel}>
          <p className="px-5 pt-3 pb-1 text-[10.5px] uppercase tracking-[0.3px] text-ink-400 font-medium">
            {papel === 'promotor' ? 'Promotores' : 'Gerentes'} · {lista.length}
          </p>
          <ul className="divide-y divide-[#F5F5F5]">
            {lista.map(p => <FilaPersona key={`${papel}-${p.clave}`} persona={p} candidatos={candidatos} />)}
          </ul>
        </div>
      ))}
    </div>
  )
}

function FilaPersona({ persona: p, candidatos }: { persona: PersonaReporte; candidatos: CandidatoCuenta[] }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [correo, setCorreo] = useState(p.email ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sugerencia = useMemo(() => (p.email ? null : sugerirCuenta(p.nombre, candidatos)), [p.email, p.nombre, candidatos])

  async function guardar(email: string | null) {
    setGuardando(true)
    setError(null)
    const { error: e } = await createClient().rpc('aud_asignar_correo', { p_clave: p.clave, p_email: email })
    setGuardando(false)
    if (e) { setError(e.message); return }
    setEditando(false)
    router.refresh()
  }

  return (
    <li className="px-5 py-2.5 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="min-w-0">
          <span className="text-[13px] text-ink-900 font-medium">{p.nombre}</span>
          <span className="ml-2 text-[11.5px] text-ink-400 tabular-nums">{p.grupos} {p.grupos === 1 ? 'grupo' : 'grupos'}</span>
        </span>
        {!editando && (
          <span className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
            {p.email ? (
              <>
                <span className="font-mono text-[12px] text-ink-700">{p.email}</span>
                {p.origen === 'manual' && <span className="text-[11px] font-medium rounded px-1.5 py-[1px] bg-[#E7EEF9] text-navy">a mano</span>}
                {!p.entro && <span className="text-[11px] font-medium rounded px-1.5 py-[1px] bg-[#FFF8E1] text-[#8A6100]">no ha entrado</span>}
              </>
            ) : (
              <span className="text-[11px] font-medium rounded px-1.5 py-[1px] bg-[#FFEBEE] text-[#C62828]">sin cuenta</span>
            )}
            <button onClick={() => { setCorreo(p.email ?? ''); setEditando(true) }} className="text-navy font-medium hover:underline">
              {p.email ? 'Cambiar' : 'Asignar'}
            </button>
          </span>
        )}
      </div>

      {!editando && sugerencia && (
        <p className="text-[12px] text-ink-500">
          ¿Es <span className="text-ink-900">{sugerencia.nombre}</span> (<span className="font-mono">{sugerencia.email}</span>)?{' '}
          <button disabled={guardando} onClick={() => guardar(sugerencia.email)} className="text-navy font-medium hover:underline disabled:opacity-50">
            Usar este correo
          </button>
        </p>
      )}

      {editando && (
        <form
          onSubmit={e => { e.preventDefault(); guardar(correo.trim() || null) }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="email"
            list="aud-candidatos"
            value={correo}
            onChange={e => setCorreo(e.target.value)}
            placeholder="correo@financieracrediflexi.com"
            autoFocus
            className="bg-white border border-[#ECECEC] rounded px-3 py-1.5 text-[13px] text-ink-900 outline-none focus:border-orange w-72 max-w-full"
          />
          <button type="submit" disabled={guardando} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white bg-navy hover:bg-navy/90 rounded px-3 py-1.5 disabled:opacity-60">
            {guardando && <Loader2 size={13} className="animate-spin" />} Guardar
          </button>
          {p.origen === 'manual' && (
            <button type="button" disabled={guardando} onClick={() => guardar(null)} className="text-[12.5px] text-ink-500 hover:text-ink-900">
              Volver a la búsqueda automática
            </button>
          )}
          <button type="button" onClick={() => { setEditando(false); setError(null) }} className="text-[12.5px] text-ink-500 hover:text-ink-900">
            Cancelar
          </button>
        </form>
      )}

      {error && <p className="text-[12px] text-[#C62828]">{error}</p>}
    </li>
  )
}
