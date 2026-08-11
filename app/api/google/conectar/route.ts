import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { urlAutorizacion } from '@/lib/google/client'

// Inicia el flujo OAuth de Google (Calendar + Gmail) para la cuenta emisora.
//
// Esta ruta configura el emisor de RECLUTAMIENTO, donde tiene sentido que el
// operador conecte su propia cuenta: esos correos salen de una persona.
//
// La mesa de tickets NO pasa por aquí (TKT-048): su remitente es una identidad
// de la plataforma y vive en variables de entorno, fuera del alcance de
// cualquier usuario y de cualquier dispositivo.
// Solo admin o portadores del flag de reclutamiento.

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

  // `?uso=tickets` ya no existe: el remitente de la mesa no se configura desde
  // la aplicación. Si alguien llega con ese parámetro, se ignora.
  const uso = req.nextUrl.searchParams.get('uso') === 'reclutamiento' ? 'reclutamiento' : 'ambos'

  const state = crypto.randomUUID()
  const redirectUri = new URL('/api/google/callback', req.url).toString()

  const res = NextResponse.redirect(urlAutorizacion(redirectUri, state))
  // El uso viaja en cookie, no en el `state`, para no alterar el anti-CSRF.
  res.cookies.set('google_oauth_uso', uso, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  // Cookie efímera para validar el state en el callback (anti-CSRF).
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
