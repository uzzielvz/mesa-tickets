'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Profile {
  id: string
  nombre_completo: string
  email: string
  acceso_cartera: boolean
}

export default function CarteraAccesos({ profiles }: { profiles: Profile[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)

  async function toggleCarteraAccess(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ acceso_cartera: !actual })
      .eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? 'Acceso a Cartera retirado' : 'Acceso a Cartera otorgado')
    router.refresh()
    setSaving(null)
  }

  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden max-w-2xl">
      <div className="hidden md:grid grid-cols-[1fr_100px] px-5 py-2 border-b border-[#ECECEC] bg-surface-sidebar">
        {['Usuario', 'Acceso'].map(h => (
          <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
        ))}
      </div>

      {profiles.map((profile, i) => (
        <div
          key={profile.id}
          className={`grid grid-cols-1 md:grid-cols-[1fr_100px] items-center px-5 py-3 gap-2 ${i < profiles.length - 1 ? 'border-b border-[#F5F5F5]' : ''} ${saving === profile.id ? 'opacity-50' : ''}`}
        >
          <div>
            <p className="text-[13px] font-medium text-ink-900">{profile.nombre_completo}</p>
            <p className="text-[11.5px] text-ink-400">{profile.email}</p>
          </div>

          <button
            onClick={() => toggleCarteraAccess(profile.id, profile.acceso_cartera)}
            disabled={saving === profile.id}
            title={profile.acceso_cartera ? 'Quitar acceso a Cartera' : 'Dar acceso a Cartera'}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
              ${profile.acceso_cartera ? 'bg-orange' : 'bg-[#DCDCDC]'}
            `}
          >
            <span className={`
              inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${profile.acceso_cartera ? 'translate-x-4' : 'translate-x-0'}
            `} />
          </button>
        </div>
      ))}
    </div>
  )
}
