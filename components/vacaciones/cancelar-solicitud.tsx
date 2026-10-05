'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

/** Cancelar una solicitud que todavía nadie resolvió. Dos clics, sin diálogo del navegador. */
export default function CancelarSolicitud({ id }: { id: string }) {
  const router = useRouter()
  const [confirmar, setConfirmar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  async function cancelar() {
    setTrabajando(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('vac_cancelar_solicitud', { p_id: id })
    setTrabajando(false)
    if (error) { toast.error(error.message); return }
    toast.success('Solicitud cancelada')
    router.refresh()
  }

  if (!confirmar) {
    return (
      <button onClick={() => setConfirmar(true)} className="text-[11.5px] text-ink-400 hover:text-[#C62828]">
        Cancelar solicitud
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 text-[11.5px]">
      <button onClick={cancelar} disabled={trabajando} className="text-[#C62828] font-medium hover:underline">
        {trabajando ? 'Cancelando…' : 'Sí, cancelar'}
      </button>
      <button onClick={() => setConfirmar(false)} className="text-ink-400 hover:text-ink-700">No</button>
    </span>
  )
}
