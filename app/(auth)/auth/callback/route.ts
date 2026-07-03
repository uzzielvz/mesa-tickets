import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_DOMAIN = '@financieracrediflexi.com'

// Correos externos permitidos (pruebas/invitados), separados por coma.
const EXTRA_EMAILS = (process.env.NEXT_PUBLIC_AUTH_EMAILS_EXTRA ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = data.user.email ?? ''

      // Rechazar correos fuera del dominio corporativo (salvo allowlist)
      if (!email.endsWith(ALLOWED_DOMAIN) && !EXTRA_EMAILS.includes(email.toLowerCase())) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=domain`)
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
