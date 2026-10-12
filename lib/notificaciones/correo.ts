// Correo de los avisos (NTF-001). Solo servidor: lo usan las dos rutas de
// /api/notificaciones. El texto lo escribe la base (cada módulo arma su
// título y cuerpo); aquí solo se envuelve y se manda.
//
// Remitente: el mismo de la mesa de tickets (TICKETS_GOOGLE_REFRESH_TOKEN +
// TICKETS_SENDER_EMAIL, en Vercel). Es la cuenta de la plataforma, no la de
// una persona, y ningún usuario la puede cambiar (TKT-048).

import { accessTokenDesdeRefresh, enviarCorreo } from '@/lib/google/client'
import type { CorreoPendiente, ResultadoCorreo } from './tipos'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mesa-tickets.vercel.app'
const REMITENTE = 'Plataforma CrediFlexi'

// El título y el cuerpo traen texto que escribieron personas (la nota de la
// solicitud, el motivo de un rechazo): nunca entra como HTML.
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function plantillaAviso(a: CorreoPendiente): { subject: string; html: string } {
  const url = `${SITE_URL}${a.liga ?? '/notificaciones'}`
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
  <p style="font-size:15px;font-weight:bold;margin:16px 0 4px">${escapar(a.titulo)}</p>
  ${a.cuerpo ? `<p style="font-size:13px;line-height:1.5;margin:6px 0;color:#444">${escapar(a.cuerpo)}</p>` : ''}
  <p style="margin:16px 0">
    <a href="${escapar(url)}"
       style="background:#F58220;color:#fff;text-decoration:none;font-size:13px;font-weight:bold;padding:8px 16px;border-radius:4px">
      Abrir en la plataforma
    </a>
  </p>
  <p style="font-size:11px;color:#999;margin-top:20px">
    Aviso automático de la plataforma de CrediFlexi. Entra con tu cuenta de Google de CrediFlexi.
    No respondas a este correo.
  </p>
</div>`.trim()
  return { subject: a.titulo, html }
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Manda los correos de una tanda de avisos. Nunca lanza: cada aviso regresa
 * `ok` o su error, y la base lleva la cuenta de intentos.
 *
 * Si el remitente no está configurado o Google no entrega el token, regresa
 * `[]` sin marcar nada: es un problema de configuración, no de ese correo, y
 * los avisos siguen pendientes para el siguiente intento.
 */
export async function mandarCorreosDeAvisos(pendientes: CorreoPendiente[]): Promise<ResultadoCorreo[]> {
  if (pendientes.length === 0) return []

  const refreshToken = process.env.TICKETS_GOOGLE_REFRESH_TOKEN
  const remitente = process.env.TICKETS_SENDER_EMAIL
  if (!refreshToken || !remitente) {
    console.warn('[avisos] TICKETS_GOOGLE_REFRESH_TOKEN/SENDER_EMAIL sin configurar: los correos quedan pendientes')
    return []
  }

  let accessToken: string
  try {
    accessToken = await accessTokenDesdeRefresh(refreshToken)
  } catch (e) {
    console.error('[avisos] Google no entregó el token; los correos quedan pendientes:', mensaje(e))
    return []
  }

  const resultados: ResultadoCorreo[] = []
  for (const p of pendientes) {
    try {
      const { subject, html } = plantillaAviso(p)
      await enviarCorreo(accessToken, { to: [p.para], subject, html, from: `${REMITENTE} <${remitente}>` })
      resultados.push({ id: p.id, ok: true })
    } catch (e) {
      console.error(`[avisos] correo ${p.id} no enviado:`, mensaje(e))
      resultados.push({ id: p.id, ok: false, error: mensaje(e) })
    }
  }
  return resultados
}
