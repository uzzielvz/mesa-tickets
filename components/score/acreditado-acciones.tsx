'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { eliminarAcreditado } from '@/lib/actions/acreditados'

interface Props {
  acreditadoId: string
  numero: number
  nombre: string
  puedeEditar: boolean
}

export default function AcreditadoAcciones({ acreditadoId, numero, nombre, puedeEditar }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (!puedeEditar) return null

  async function handleEliminar() {
    const ok = window.confirm(
      `¿Eliminar el registro de ${nombre}?\n\nEsta acción no se puede deshacer.`
    )
    if (!ok) return

    setLoading(true)
    const result = await eliminarAcreditado(acreditadoId)
    if (result.ok) {
      toast.success('Registro eliminado')
      router.push('/score/acreditados')
      router.refresh()
    } else {
      toast.error(result.error ?? 'No se pudo eliminar')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Link
        href={`/score/acreditados/${numero}/editar`}
        className="flex items-center gap-1.5 border border-[#ECECEC] text-ink-700 text-[12.5px] font-medium rounded px-4 py-[7px] hover:bg-surface-hover transition-colors"
      >
        <Pencil size={12} />
        Editar
      </Link>
      <button
        type="button"
        onClick={handleEliminar}
        disabled={loading}
        className="flex items-center gap-1.5 border border-red-200 text-red-700 text-[12.5px] font-medium rounded px-4 py-[7px] hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <Trash2 size={12} />
        {loading ? 'Eliminando...' : 'Eliminar'}
      </button>
    </div>
  )
}
