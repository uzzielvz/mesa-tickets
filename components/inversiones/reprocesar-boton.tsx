'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Vuelve a leer los datos de una carga desde el .xlsx ya guardado.
 *
 * Se muestra solo a quien puede cargar. Es la salida cuando el parser se
 * corrige: reconstruye lo ingerido sin pedirle a Felix que suba de nuevo, y sin
 * borrar la bitácora.
 */
export default function ReprocesarBoton({ cargaId }: { cargaId: string }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)

  async function reprocesar() {
    setOcupado(true)
    try {
      const res = await fetch(`/api/inversiones/reprocesar/${cargaId}`, { method: 'POST' })
      const cuerpo = await res.json()

      if (!res.ok || !cuerpo.ok) {
        const detalle: string = cuerpo.errores?.[0] ?? cuerpo.error ?? 'No se pudo reprocesar'
        toast.error(detalle)
        // Aun fallando, el estado de la carga cambió a `error` con su detalle:
        // hay que refrescar para que la lista lo muestre.
        router.refresh()
        return
      }

      const r = cuerpo.resumen
      toast.success(
        r
          ? `${r.filas} pagos leídos · ${r.total.toLocaleString('es-MX', {
              style: 'currency', currency: 'MXN',
            })}`
          : 'Carga reprocesada',
      )
      router.refresh()
    } catch {
      toast.error('No se pudo contactar al servidor')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <button
      onClick={reprocesar}
      disabled={ocupado}
      className="flex items-center gap-1 text-[12px] text-ink-500 hover:text-navy font-medium disabled:opacity-50 transition-colors"
      title="Vuelve a leer los datos del archivo guardado"
    >
      <RefreshCw size={12} className={ocupado ? 'animate-spin' : undefined} />
      {ocupado ? 'Leyendo…' : 'Reprocesar'}
    </button>
  )
}
