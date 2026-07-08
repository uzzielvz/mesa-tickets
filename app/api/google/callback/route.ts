import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { intercambiarCode } from '@/lib/google/client'
import { cifrar } from '@/lib/google/crypto'

// Callback del OAuth de Google: intercambia el code, cifra el refresh_token y
// lo guarda en rec_credenciales_google. La cuenta que autoriza queda como
// emisora de eventos/correos (reconectable en cualquier momento).

export async function GET(req: NextRequest) {
  const volver = (query: string) =>
    NextResponse.redirect(new URL(`/reclutamiento/agendar?${query}`, req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('google_oauth_state')?.value

  if (!code || !state || !cookieState || state !== cookieState) {
    return volver('google_error=estado_invalido')
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const redirectUri = new URL('/api/google/callback', req.url).toString()
    const tokens = await intercambiarCode(code, redirectUri)

    if (!tokens.refresh_token) {
      // Pasa si Google no re-emite el refresh (cuenta ya autorizada sin prompt=consent).
      return volver('google_error=sin_refresh_token')
    }

    const { error } = await supabase
      .from('rec_credenciales_google')
      .upsert(
        {
          profile_id: user.id,
          refresh_token: cifrar(tokens.refresh_token),
          scope: tokens.scope ?? null,
          actualizado_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' },
      )
    if (error) return volver('google_error=guardado')

    return volver('google=conectado')
  } catch {
    return volver('google_error=intercambio')
  }
}
