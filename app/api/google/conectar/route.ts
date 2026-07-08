import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { urlAutorizacion } from '@/lib/google/client'

// Inicia el flujo OAuth de Google (Calendar + Gmail) para la cuenta emisora
// del módulo de reclutamiento. Solo admin o portadores del flag.

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const { data } = await supabase
    .from('profiles')
    .select('rol, acceso_reclutamiento')
    .eq('id', user.id)
    .single()
  const profile = data as { rol: string; acceso_reclutamiento: boolean } | null
  if (!profile || !(profile.rol === 'admin' || profile.acceso_reclutamiento === true)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const state = crypto.randomUUID()
  const redirectUri = new URL('/api/google/callback', req.url).toString()

  const res = NextResponse.redirect(urlAutorizacion(redirectUri, state))
  // Cookie efímera para validar el state en el callback (anti-CSRF).
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
