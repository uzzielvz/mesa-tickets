'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Panel, Vacio } from '@/components/viz'
import { EVENTO_AVISOS } from '@/components/notificaciones/campana'
import { ETIQUETA_MODULO, type Aviso } from '@/lib/notificaciones/tipos'
import { haceCuanto } from '@/lib/notificaciones/tiempo'

/** La lista completa de avisos. Abrir uno lo marca leído y lleva a donde se resuelve. */
export default function ListaAvisos({ avisos: iniciales }: { avisos: Aviso[] }) {
  const router = useRouter()
  const [avisos, setAvisos] = useState(iniciales)
  const sinLeer = avisos.filter(a => !a.leida_at).length

  async function marcar(ids: string[] | null) {
    const supabase = createClient()
    const { error } = await supabase.rpc('ntf_marcar_leidas', { p_ids: ids })
    if (error) return
    const ahora = new Date().toISOString()
    setAvisos(prev => prev.map(a => (!a.leida_at && (ids === null || ids.includes(a.id)) ? { ...a, leida_at: ahora } : a)))
    window.dispatchEvent(new Event(EVENTO_AVISOS))
  }

  function abrir(a: Aviso) {
    if (!a.leida_at) marcar([a.id])
    if (a.liga) router.push(a.liga)
  }

  return (
    <div className="flex flex-col gap-3">
      {sinLeer > 0 && (
        <div className="flex justify-end">
          <button onClick={() => marcar(null)} className="text-[12.5px] text-navy font-medium hover:underline">
            Marcar todo como leído
          </button>
        </div>
      )}

      <Panel titulo="Avisos" nota={sinLeer > 0 ? `${sinLeer} sin leer` : undefined}>
        {avisos.length === 0 ? (
          <Vacio mensaje="No tienes avisos todavía. Aquí aparece lo que pase con tus solicitudes y lo que te toque resolver." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {avisos.map(a => (
              <li key={a.id}>
                <button
                  onClick={() => abrir(a)}
                  className="w-full text-left px-5 py-3.5 flex gap-3 hover:bg-surface-hover transition-colors"
                >
                  <span
                    aria-hidden
                    className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${a.leida_at ? 'bg-transparent' : 'bg-orange'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] leading-snug ${a.leida_at ? 'text-ink-700' : 'text-ink-900 font-medium'}`}>
                      {a.titulo}
                    </span>
                    {a.cuerpo && <span className="block text-[12px] text-ink-500 leading-snug mt-0.5">{a.cuerpo}</span>}
                    <span className="block text-[11px] text-ink-400 mt-1">
                      {ETIQUETA_MODULO[a.modulo] ?? a.modulo} · {haceCuanto(a.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
