'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login?logout=1')
  }

  return (
    <button
      onClick={handleLogout}
      className="border border-[#ECECEC] text-ink-700 hover:bg-surface-hover text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
    >
      Cerrar sesión
    </button>
  )
}
