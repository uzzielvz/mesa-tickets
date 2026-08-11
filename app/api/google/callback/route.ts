import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { intercambiarCode, correoDeLaCuenta } from '@/lib/google/client'
import { cifrar } from '@/lib/google/crypto'

// Callback del OAuth de Google: intercambia el code, cifra el refresh_token y
// lo guarda en rec_credenciales_google. La cuenta que autoriza queda como
// emisora de eventos/correos (reconectable en cualquier momento).

export async function GET(req: NextRequest) {
  // Se vuelve al módulo desde el que se pidió conectar, no siempre a
  // reclutamiento: la cuenta emisora ya es por módulo (TKT-046).
  const usoCookie = req.cookies.get('google_oauth_uso')?.value ?? 'ambos'
  const destino = usoCookie === 'tickets' ? '/tickets/area' : '/reclutamiento/agendar'
  const volver = (query: string) =>
    NextResponse.redirect(new URL(`${destino}?${query}`, req.url))

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

    const uso = usoCookie

    // Quién autorizó de verdad. Google es la fuente de verdad, no lo que
    // diga el usuario.
    let emailCuenta: string | null = null
    try {
      emailCuenta = await correoDeLaCuenta(tokens.access_token)
    } catch {
      emailCuenta = null
    }

    // El remitente de la mesa de tickets es una identidad de la PLATAFORMA,
    // no la cuenta de quien esté configurando. Se valida aquí, en el punto de
    // escritura: aunque alguien con permisos abra ?uso=tickets, si no autorizó
    // con la cuenta de plataforma no se guarda como emisora de tickets.
    const remitenteTickets = (process.env.TICKETS_SENDER_EMAIL ?? '').toLowerCase().trim()
    if (uso === 'tickets' && remitenteTickets && emailCuenta !== remitenteTickets) {
      return volver('google_error=cuenta_no_autorizada')
    }

    // El índice único por `uso` impide dos credenciales para el mismo módulo:
    // se libera la anterior antes de guardar la nueva.
    if (uso !== 'ambos') {
      await supabase
        .from('rec_credenciales_google')
        .update({ uso: 'ambos' })
        .eq('uso', uso)
        .neq('profile_id', user.id)
    }

    const { error } = await supabase
      .from('rec_credenciales_google')
      .upsert(
        {
          profile_id: user.id,
          refresh_token: cifrar(tokens.refresh_token),
          scope: tokens.scope ?? null,
          uso,
          email: emailCuenta,
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
