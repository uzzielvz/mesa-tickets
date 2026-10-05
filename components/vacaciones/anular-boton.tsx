'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

/**
 * Anular, no borrar: el registro queda en el historial tachado y deja de
 * contar en el saldo. Dos clics a propósito, sin diálogo del navegador.
 */
export default function AnularMovimiento({ id }: { id: string }) {
  const router = useRouter()
  const [confirmar, setConfirmar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  async function anular() {
    setTrabajando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('vac_movimientos')
      .update({ anulado_at: new Date().toISOString(), anulado_por: user?.id ?? null })
      .eq('id', id)
    setTrabajando(false)
    if (error) { toast.error(`No se pudo anular: ${error.message}`); return }
    toast.success('Registro anulado')
    router.refresh()
  }

  if (!confirmar) {
    return (
      <button onClick={() => setConfirmar(true)} className="text-[11.5px] text-ink-400 hover:text-[#C62828]">
        Anular
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 text-[11.5px]">
      <button onClick={anular} disabled={trabajando} className="text-[#C62828] font-medium hover:underline">
        {trabajando ? 'Anulando…' : 'Sí, anular'}
      </button>
      <button onClick={() => setConfirmar(false)} className="text-ink-400 hover:text-ink-700">No</button>
    </span>
  )
}
