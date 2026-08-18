import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { accessTokenDesdeRefresh, enviarCorreo, correoDeLaCuenta } from '@/lib/google/client'

// Diagnóstico del envío de notificaciones de la mesa.
//
// Existe porque el envío es best-effort y falla en silencio: sin esto, "no
// llegó el correo" puede ser falta de configuración, un token inválido, un
// rechazo de Gmail o simplemente que no había destinatarios — y todas se ven
// exactamente igual desde afuera.
//
// Solo lectura sobre la configuración: no cambia nada, solo reporta y manda
// un correo de prueba a quien lo pide. Restringido a admin.

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('profiles')
    .select('rol, email')
    .eq('id', user.id)
    .single()
  const p = perfil as { rol: string; email: string | null } | null
  if (p?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
  }

  const pasos: Record<string, unknown> = {}

  // 1) ¿Está configurado el remitente?
  const refreshToken = process.env.TICKETS_GOOGLE_REFRESH_TOKEN
  const senderEmail = process.env.TICKETS_SENDER_EMAIL
  pasos['1_variables'] = {
    TICKETS_SENDER_EMAIL: senderEmail ?? '(vacía)',
    TICKETS_GOOGLE_REFRESH_TOKEN: refreshToken
      ? `configurada (${refreshToken.length} caracteres)`
      : '(vacía)',
  }
  if (!refreshToken || !senderEmail) {
    pasos['diagnostico'] =
      'Faltan variables en Vercel. Agrégalas en Production y REDESPLIEGA: las variables nuevas no aplican a un deploy ya construido.'
    return NextResponse.json(pasos, { status: 200 })
  }

  // 2) ¿El refresh token sirve?
  let accessToken: string
  try {
    accessToken = await accessTokenDesdeRefresh(refreshToken)
    pasos['2_token'] = 'OK — Google entregó un access token'
  } catch (e) {
    pasos['2_token'] = `FALLÓ — ${e instanceof Error ? e.message : String(e)}`
    pasos['diagnostico'] =
      'El refresh token no sirve. Vuelve a correr scripts/google-token-plataforma.mjs y actualiza la variable.'
    return NextResponse.json(pasos, { status: 200 })
  }

  // 3) ¿De qué cuenta es realmente?
  let cuentaReal = '(desconocida)'
  try {
    cuentaReal = await correoDeLaCuenta(accessToken)
    pasos['3_cuenta'] = cuentaReal
    if (cuentaReal.toLowerCase() !== senderEmail.toLowerCase()) {
      pasos['3_aviso'] =
        `El token es de ${cuentaReal}, pero TICKETS_SENDER_EMAIL dice ${senderEmail}. Gmail enviará como ${cuentaReal}.`
    }
  } catch (e) {
    pasos['3_cuenta'] = `No se pudo leer — ${e instanceof Error ? e.message : String(e)}`
  }

  // 4) Envío real a quien pide la prueba.
  const destino = p?.email
  if (!destino) {
    pasos['4_envio'] = 'Tu perfil no tiene correo; no hay a dónde mandar la prueba.'
    return NextResponse.json(pasos, { status: 200 })
  }

  try {
    await enviarCorreo(accessToken, {
      to: [destino],
      subject: 'Prueba de notificaciones — Mesa de Ayuda',
      html: '<p>Si estás leyendo esto, las notificaciones de la mesa de tickets funcionan.</p>',
      from: `Mesa de Ayuda CrediFlexi <${senderEmail}>`,
    })
    pasos['4_envio'] = `Enviado a ${destino}. Revisa también spam.`
    pasos['diagnostico'] = 'Todo OK. Si el correo no llega, es entrega (spam/filtros), no configuración.'
  } catch (e) {
    pasos['4_envio'] = `FALLÓ — ${e instanceof Error ? e.message : String(e)}`
    pasos['diagnostico'] =
      'Gmail rechazó el envío. Si menciona el From, la dirección no es la cuenta autenticada ni un alias verificado suyo.'
  }

  return NextResponse.json(pasos, { status: 200 })
}
