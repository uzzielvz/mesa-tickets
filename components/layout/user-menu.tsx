'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatName } from '@/lib/utils/format'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  responsable: 'Responsable',
  usuario: 'Usuario',
}

export default function UserMenu({ profile }: { profile: Profile }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = formatName(profile.nombre_completo, profile.email)

  // Iniciales para el avatar
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-2.5 group relative">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-medium text-white">{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-ink-900 truncate leading-tight">
          {displayName}
        </p>
        <p className="text-[11px] text-ink-400 leading-tight">
          {ROL_LABEL[profile.rol]}
        </p>
      </div>

      {/* Logout — aparece en hover */}
      <button
        onClick={handleLogout}
        className="text-[11px] text-ink-400 hover:text-ink-700 transition-colors opacity-0 group-hover:opacity-100"
        title="Cerrar sesión"
      >
        Salir
      </button>
    </div>
  )
}
