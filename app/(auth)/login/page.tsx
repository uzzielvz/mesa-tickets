'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.endsWith('@financieracrediflexi.com')) {
      setError('Solo se permiten correos @financieracrediflexi.com')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError('Error al enviar el enlace. Intenta de nuevo.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

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
              Te enviaremos un enlace de acceso a tu correo corporativo.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-ink-700" htmlFor="email">
                  Correo corporativo
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="nombre@financieracrediflexi.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="
                    bg-white border border-[#ECECEC] rounded px-3 py-[7px]
                    text-[13px] text-ink-900 placeholder:text-ink-400
                    outline-none transition-all
                    focus:border-orange focus:ring-[3px] focus:ring-orange/15
                  "
                />
              </div>

              {error && (
                <p className="text-[12px] text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="
                  bg-orange hover:bg-orange-dark text-white
                  text-[12.5px] font-medium rounded px-[14px] py-[7px]
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1
                "
              >
                {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
