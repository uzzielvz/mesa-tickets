// Cliente mínimo de Google (OAuth + Calendar + Gmail) vía REST, sin dependencias.
// La cuenta emisora es la que autorizó en /api/google/conectar (hoy: Uzziel;
// mañana se reconecta con reclutamiento@ sin cambiar código).

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
]

export const TIMEZONE_MX = 'America/Mexico_City'

function clientId(): string {
  const v = process.env.GOOGLE_RECLUTAMIENTO_CLIENT_ID
  if (!v) throw new Error('GOOGLE_RECLUTAMIENTO_CLIENT_ID no configurado')
  return v
}

function clientSecret(): string {
  const v = process.env.GOOGLE_RECLUTAMIENTO_CLIENT_SECRET
  if (!v) throw new Error('GOOGLE_RECLUTAMIENTO_CLIENT_SECRET no configurado')
  return v
}

// URL de consentimiento (access_type=offline + prompt=consent garantizan refresh_token).
export function urlAutorizacion(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export async function intercambiarCode(code: string, redirectUri: string): Promise<{
  refresh_token?: string
  access_token: string
  scope?: string
}> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange falló: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function accessTokenDesdeRefresh(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Refresh token falló: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

// ── Calendar ────────────────────────────────────────────────────────────────

export interface EventoMeetInput {
  titulo: string
  descripcion: string
  inicioIso: string // '2026-07-09T09:00:00' (hora local MX, sin offset)
  finIso: string
  attendees: string[] // emails (candidato + entrevistadores)
}

export interface EventoMeetResult {
  eventId: string
  meetUrl: string
}

// Crea el evento con liga de Meet e invita (sendUpdates=all manda la invitación
// de Calendar a todos los attendees).
export async function crearEventoMeet(accessToken: string, ev: EventoMeetInput): Promise<EventoMeetResult> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: ev.titulo,
        description: ev.descripcion,
        start: { dateTime: ev.inicioIso, timeZone: TIMEZONE_MX },
        end: { dateTime: ev.finIso, timeZone: TIMEZONE_MX },
        attendees: ev.attendees.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    },
  )
  if (!res.ok) throw new Error(`Calendar falló: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const meetUrl: string =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === 'video')?.uri ??
    ''
  return { eventId: data.id as string, meetUrl }
}

// ── Gmail ───────────────────────────────────────────────────────────────────

export interface CorreoAdjunto {
  filename: string
  mimeType: string
  contentBase64: string // contenido del archivo ya codificado en base64 estándar
}

export interface CorreoInput {
  to: string[]
  subject: string
  html: string
  adjuntos?: CorreoAdjunto[]
}

export interface CorreoResult {
  messageId: string
  threadId: string
}

// Asunto con acentos → RFC 2047.
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

export async function enviarCorreo(accessToken: string, correo: CorreoInput): Promise<CorreoResult> {
  const adjuntos = correo.adjuntos ?? []
  let mime: string

  if (adjuntos.length === 0) {
    // Correo simple: solo cuerpo HTML.
    mime = [
      `To: ${correo.to.join(', ')}`,
      `Subject: ${encodeSubject(correo.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(correo.html, 'utf8').toString('base64'),
    ].join('\r\n')
  } else {
    // multipart/mixed: cuerpo HTML + uno o más adjuntos (p.ej. los CV).
    const boundary = `mea_${crypto.randomUUID()}`
    const partes: string[] = [
      `To: ${correo.to.join(', ')}`,
      `Subject: ${encodeSubject(correo.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(correo.html, 'utf8').toString('base64'),
    ]
    for (const a of adjuntos) {
      partes.push(
        `--${boundary}`,
        `Content-Type: ${a.mimeType}; name="${a.filename}"`,
        `Content-Disposition: attachment; filename="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        // El base64 del adjunto se parte en líneas de 76 chars (MIME).
        a.contentBase64.replace(/(.{76})/g, '$1\r\n'),
      )
    }
    partes.push(`--${boundary}--`)
    mime = partes.join('\r\n')
  }

  const raw = Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) throw new Error(`Gmail falló: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return { messageId: data.id as string, threadId: data.threadId as string }
}
