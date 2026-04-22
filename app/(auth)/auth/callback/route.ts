import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_DOMAIN = '@financieracrediflexi.com'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const email = data.user.email ?? ''

      // Rechazar correos fuera del dominio corporativo
      if (!email.endsWith(ALLOWED_DOMAIN)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=domain`)
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
