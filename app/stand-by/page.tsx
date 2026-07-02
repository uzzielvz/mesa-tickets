import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Wordmark from '@/components/brand/wordmark'
import LogoutButton from '@/components/stand-by/logout-button'
import { formatName } from '@/lib/utils/format'

// Sala de espera corporativa: el usuario autenticó pero un admin aún no le
// asigna área ni accesos. Fuera de (dashboard) a propósito (sin sidebar).
export default async function StandByPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, nombre_completo, email, acceso_tickets, acceso_score, acceso_cartera, acceso_reclutamiento')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const tieneAlgunAcceso =
    profile.rol === 'admin' ||
    profile.acceso_tickets === true ||
    profile.acceso_score === true ||
    profile.acceso_cartera === true ||
    profile.acceso_reclutamiento === true

  if (tieneAlgunAcceso) redirect('/dashboard')

  const nombre = formatName(profile.nombre_completo, profile.email ?? user.email ?? '').split(' ')[0]

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <Wordmark />
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-semibold text-navy tracking-tight">
            Hola, {nombre}
          </h1>
          <p className="text-[13.5px] text-ink-500 leading-relaxed">
            Aún no tienes acceso a ninguna herramienta de la plataforma.
            Estamos trabajando en ello: tu área y tus accesos los asigna el
            equipo de administración.
          </p>
          <p className="text-[13.5px] text-ink-500 leading-relaxed">
            Si crees que ya deberías tenerlo, ponte en contacto con el equipo.
          </p>
        </div>
        <LogoutButton />
      </div>
    </div>
  )
}
