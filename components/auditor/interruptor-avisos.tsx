'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { dispararTandaDeCorreos } from '@/lib/notificaciones/disparar'
import type { ResultadoAvisos } from '@/lib/auditor/tipos'
import AcuseAvisos from '@/components/auditor/acuse-avisos'

const momento = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })

/**
 * El interruptor de los avisos del Auditor (AUD-006). Arrancan apagados.
 * Encender avisa en ese momento con lo que haya pendiente, como si se acabara
 * de cargar un reporte; apagar solo deja de avisar.
 */
export default function InterruptorAvisos({ activos, desde }: { activos: boolean; desde: string | null }) {
  const router = useRouter()
  const [trabajando, setTrabajando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoAvisos | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function cambiar(encender: boolean) {
    if (encender && !window.confirm(
      'Se avisa ahora mismo a cada promotor y gerente con depósitos pendientes (campana y correo), y después en cada carga. ¿Encender los avisos?',
    )) return
    setTrabajando(true)
    setError(null)
    const { data, error: e } = await createClient().rpc('aud_avisos_encender', { p_activos: encender })
    setTrabajando(false)
    if (e) { setError(e.message); return }
    const r = data as unknown as ResultadoAvisos
    setResultado(encender ? r : null)
    if ((r?.avisados ?? 0) > 0) dispararTandaDeCorreos()
    router.refresh()
  }

  return (
    <div className={`border rounded-md p-4 flex flex-col gap-2 max-w-2xl ${activos ? 'border-[#C8E6C9] bg-[#F1F8F2]' : 'border-[#ECECEC] bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
          {activos ? <Bell size={15} className="text-[#2E7D32]" /> : <BellOff size={15} className="text-ink-400" />}
          Avisos a promotores y gerentes: {activos ? 'encendidos' : 'apagados'}
        </p>
        <button
          onClick={() => cambiar(!activos)}
          disabled={trabajando}
          className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium rounded px-3 py-1.5 disabled:opacity-60 ${
            activos ? 'text-ink-700 border border-[#D8D8D8] hover:bg-surface-hover' : 'text-white bg-navy hover:bg-navy/90'
          }`}
        >
          {trabajando && <Loader2 size={13} className="animate-spin" />}
          {activos ? 'Apagar' : 'Encender y avisar ahora'}
        </button>
      </div>
      <p className="text-[12px] text-ink-500">
        {activos
          ? `Cada carga avisa a cada promotor de lo suyo y a cada gerente de lo de su equipo.${desde ? ` Encendidos desde el ${momento(desde)}.` : ''}`
          : 'Al cargar un reporte no se avisa a nadie. Al encenderlos se avisa en ese momento con lo que haya pendiente.'}
      </p>
      <AcuseAvisos resultado={resultado} />
      {error && <p className="text-[12px] text-[#C62828]">{error}</p>}
    </div>
  )
}
