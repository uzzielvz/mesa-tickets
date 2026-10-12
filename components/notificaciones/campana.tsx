'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { COLUMNAS_AVISO, ETIQUETA_MODULO, type Aviso } from '@/lib/notificaciones/tipos'
import { haceCuanto } from '@/lib/notificaciones/tiempo'

/** Lo dispara quien marca avisos como leídos fuera de la campana (la página). */
export const EVENTO_AVISOS = 'avisos-cambiaron'

/**
 * Cuántos avisos sin leer tiene quien está en sesión (NTF-001). Se vuelve a
 * contar al navegar, al regresar a la pestaña, cada minuto mientras está a la
 * vista y cuando alguien marca avisos. Vive en el Sidebar, que lo comparte con
 * las dos campanas (móvil y escritorio).
 */
export function useAvisosSinLeer(inicial: number) {
  const pathname = usePathname()
  const [sinLeer, setSinLeer] = useState(inicial)

  const actualizar = useCallback(async () => {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .is('leida_at', null)
    if (!error && count !== null) setSinLeer(count)
  }, [])

  useEffect(() => {
    actualizar()
  }, [pathname, actualizar])

  useEffect(() => {
    const siVisible = () => {
      if (document.visibilityState === 'visible') actualizar()
    }
    const intervalo = setInterval(siVisible, 60_000)
    document.addEventListener('visibilitychange', siVisible)
    window.addEventListener(EVENTO_AVISOS, actualizar)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', siVisible)
      window.removeEventListener(EVENTO_AVISOS, actualizar)
    }
  }, [actualizar])

  return { sinLeer, actualizar }
}

/**
 * La campana: el número de avisos sin leer y, al abrirla, los últimos ocho.
 * Abrir un aviso lo marca leído y lleva a donde se resuelve.
 *
 * Dos formas: `fila` en el menú de escritorio (como los demás elementos del
 * menú, y el panel sale a su derecha) e `icono` en la barra de móvil.
 */
export default function Campana({
  sinLeer,
  alCambiar,
  variante,
}: {
  sinLeer: number
  /** Después de marcar avisos: volver a contar. */
  alCambiar: () => void
  variante: 'fila' | 'icono'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [abierta, setAbierta] = useState(false)
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  async function cargar() {
    setFallo(false)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notificaciones')
      .select(COLUMNAS_AVISO)
      .order('created_at', { ascending: false })
      .limit(8)
    if (error) {
      setFallo(true)
      return
    }
    setAvisos((data ?? []) as Aviso[])
  }

  function alternar() {
    const abrir = !abierta
    setAbierta(abrir)
    if (abrir) cargar()
  }

  useEffect(() => {
    if (!abierta) return
    const clicAfuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(false)
    }
    document.addEventListener('mousedown', clicAfuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', clicAfuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierta])

  async function marcar(ids: string[] | null) {
    const supabase = createClient()
    const { error } = await supabase.rpc('ntf_marcar_leidas', { p_ids: ids })
    if (error) return
    const ahora = new Date().toISOString()
    setAvisos(prev =>
      prev?.map(a => (!a.leida_at && (ids === null || ids.includes(a.id)) ? { ...a, leida_at: ahora } : a)) ?? null,
    )
    alCambiar()
  }

  function abrirAviso(a: Aviso) {
    setAbierta(false)
    if (!a.leida_at) marcar([a.id])
    router.push(a.liga ?? '/notificaciones')
  }

  const etiqueta = sinLeer > 0 ? `Avisos: ${sinLeer} sin leer` : 'Avisos'
  const activa = abierta || pathname === '/notificaciones'

  return (
    <div ref={caja} className="relative">
      {variante === 'fila' ? (
        <button
          type="button"
          onClick={alternar}
          aria-label={etiqueta}
          aria-expanded={abierta}
          className={`w-full flex items-center gap-2 px-[10px] py-[6px] rounded-[5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30 ${
            activa ? 'bg-white border border-border text-navy font-medium' : 'text-ink-500 hover:bg-surface-hover'
          }`}
        >
          <Bell size={15} className={`shrink-0 ${sinLeer > 0 ? 'text-orange' : activa ? 'text-navy' : 'text-ink-400'}`} />
          <span className="text-[13px] flex-1 text-left truncate">Avisos</span>
          {sinLeer > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-orange text-white text-[10.5px] font-semibold leading-[18px] text-center">
              {sinLeer > 99 ? '99+' : sinLeer}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={alternar}
          aria-label={etiqueta}
          aria-expanded={abierta}
          className="relative p-1.5 rounded-[5px] text-ink-500 hover:bg-surface-hover hover:text-navy transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/30"
        >
          <Bell size={17} />
          {sinLeer > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-[3px] rounded-full bg-orange text-white text-[10px] font-semibold leading-4 text-center">
              {sinLeer > 9 ? '9+' : sinLeer}
            </span>
          )}
        </button>
      )}

      {abierta && (
        <div
          className={`absolute z-50 w-[340px] max-w-[calc(100vw-32px)] bg-white border border-border rounded-md shadow-lg overflow-hidden ${
            variante === 'fila' ? 'left-full top-0 ml-4' : 'right-0 top-full mt-2'
          }`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-surface-sidebar">
            <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">Avisos</p>
            {sinLeer > 0 && (
              <button onClick={() => marcar(null)} className="text-[11.5px] text-navy font-medium hover:underline">
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {fallo ? (
              <p className="px-4 py-5 text-[12.5px] text-[#C62828]">No se pudieron cargar los avisos.</p>
            ) : avisos === null ? (
              <p className="px-4 py-5 text-[12.5px] text-ink-400">Cargando…</p>
            ) : avisos.length === 0 ? (
              <p className="px-4 py-5 text-[12.5px] text-ink-500">No tienes avisos.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {avisos.map(a => (
                  <li key={a.id}>
                    <button
                      onClick={() => abrirAviso(a)}
                      className="w-full text-left px-4 py-3 flex gap-2.5 hover:bg-surface-hover transition-colors"
                    >
                      <span
                        aria-hidden
                        className={`mt-[6px] w-1.5 h-1.5 rounded-full shrink-0 ${a.leida_at ? 'bg-transparent' : 'bg-orange'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12.5px] leading-snug ${a.leida_at ? 'text-ink-700' : 'text-ink-900 font-medium'}`}>
                          {a.titulo}
                        </span>
                        {a.cuerpo && (
                          <span className="block text-[11.5px] text-ink-500 leading-snug mt-0.5 line-clamp-2">{a.cuerpo}</span>
                        )}
                        <span className="block text-[10.5px] text-ink-400 mt-1">
                          {ETIQUETA_MODULO[a.modulo] ?? a.modulo} · {haceCuanto(a.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/notificaciones"
            onClick={() => setAbierta(false)}
            className="block text-center px-4 py-2.5 border-t border-border text-[12px] text-navy font-medium hover:bg-surface-hover"
          >
            Ver todos los avisos
          </Link>
        </div>
      )}
    </div>
  )
}
