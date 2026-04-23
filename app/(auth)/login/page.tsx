'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DOMAIN = '@financieracrediflexi.com'

function LoginForm() {
  const searchParams = useSearchParams()
  const domainError = searchParams.get('error') === 'domain'

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(
    domainError ? `Solo se permiten cuentas ${DOMAIN}` : ''
  )

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: {
          hd: 'financieracrediflexi.com', // Google muestra solo cuentas del dominio
        },
      },
    })
    if (authError) {
      setError('Error al conectar con Google. Intenta de nuevo.')
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.endsWith(DOMAIN)) {
      setError(`Solo se permiten correos ${DOMAIN}`)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })

    if (authError) {
      setError('Error al enviar el enlace. Intenta de nuevo.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  const inputClass = `
    bg-white border border-[#ECECEC] rounded px-3 py-[7px]
    text-[13px] text-ink-900 placeholder:text-ink-400
    outline-none transition-all w-full
    focus:border-orange focus:ring-[3px] focus:ring-orange/15
  `

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-[360px] px-6">

        {/* Branding */}
        <div className="flex items-center gap-2 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-orange flex-shrink-0" />
          <span className="text-[15px] font-semibold text-navy tracking-tight">CrediFlexi</span>
          <span className="text-[11px] text-ink-400 font-normal">/ Tickets</span>
        </div>

        {sent ? (
          <>
            <h1 className="text-[22px] font-semibold text-navy tracking-[-0.4px] mb-2">
              Revisa tu correo
            </h1>
            <p className="text-[13px] text-ink-500 leading-relaxed">
              Enviamos un enlace de acceso a{' '}
              <span className="text-ink-900 font-medium">{email}</span>.
              El enlace expira en 1 hora.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold text-navy tracking-[-0.4px] mb-1">
              Acceder
            </h1>
            <p className="text-[13px] text-ink-500 mb-8">
              Usa tu cuenta corporativa de CrediFlexi.
            </p>

            {/* Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="
                w-full flex items-center justify-center gap-2.5
                border border-[#ECECEC] rounded px-[14px] py-[7px]
                text-[12.5px] font-medium text-ink-900
                hover:bg-surface-hover transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed mb-4
              "
            >
              {/* Google icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Redirigiendo...' : 'Continuar con Google'}
            </button>

            {/* Divisor */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[#ECECEC]" />
              <span className="text-[11px] text-ink-400">o con magic link</span>
              <div className="flex-1 h-px bg-[#ECECEC]" />
            </div>

            {/* Magic link */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                id="email"
                type="email"
                placeholder={`nombre${DOMAIN}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={inputClass}
              />

              {error && <p className="text-[12px] text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email}
                className="
                  bg-orange hover:bg-orange-dark text-white
                  text-[12.5px] font-medium rounded px-[14px] py-[7px]
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {loading ? 'Enviando...' : 'Enviar magic link'}
              </button>
            </form>

            <p className="text-[11px] text-ink-400 text-center mt-6">
              Solo cuentas @financieracrediflexi.com
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
