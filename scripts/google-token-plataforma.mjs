// Obtiene UNA VEZ el refresh_token de la cuenta que enviará las
// notificaciones de la mesa de tickets (plataformas@financieracrediflexi.com).
//
// El token vive como variable de entorno en Vercel, NO en la base de datos:
// así ningún usuario puede cambiar el remitente desde la aplicación, en
// ningún dispositivo. No hay UI que lo toque porque no hay dato que tocar.
//
// Uso:
//   node scripts/google-token-plataforma.mjs
//
// Requiere en .env.local (los mismos que ya usa el OAuth de reclutamiento):
//   GOOGLE_RECLUTAMIENTO_CLIENT_ID
//   GOOGLE_RECLUTAMIENTO_CLIENT_SECRET
//
// IMPORTANTE: en Google Cloud Console, el cliente OAuth debe tener
// `http://localhost:5599/callback` entre sus "Authorized redirect URIs".

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const PUERTO = 5599
const REDIRECT = `http://localhost:${PUERTO}/callback`
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
]

// .env.local a mano: el script corre fuera de Next.
function env() {
  const vars = {}
  try {
    for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = linea.match(/^([A-Z_]+)=(.*)$/)
      if (m) vars[m[1]] = m[2].trim()
    }
  } catch {
    // Si no hay archivo, se intenta con el entorno del proceso.
  }
  return {
    id: process.env.GOOGLE_RECLUTAMIENTO_CLIENT_ID ?? vars.GOOGLE_RECLUTAMIENTO_CLIENT_ID,
    secret: process.env.GOOGLE_RECLUTAMIENTO_CLIENT_SECRET ?? vars.GOOGLE_RECLUTAMIENTO_CLIENT_SECRET,
  }
}

const { id, secret } = env()
if (!id || !secret) {
  console.error('Faltan GOOGLE_RECLUTAMIENTO_CLIENT_ID / _SECRET en .env.local')
  process.exit(1)
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    // `select_account` obliga a elegir cuenta: con `consent` a secas, Google
    // usa la sesión abierta y terminas autorizando la cuenta equivocada.
    prompt: 'select_account consent',
  }).toString()

console.log('\n1) Abre esta liga e inicia sesión con plataformas@financieracrediflexi.com:\n')
console.log(authUrl)
console.log('\n2) Autoriza. El token aparecerá aquí abajo.\n')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`)
  if (url.pathname !== '/callback') { res.end('…'); return }

  const code = url.searchParams.get('code')
  if (!code) {
    res.end('Sin code. Reintenta.')
    return
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: id, client_secret: secret,
      redirect_uri: REDIRECT, grant_type: 'authorization_code',
    }),
  })
  const data = await r.json()

  if (!data.refresh_token) {
    res.end('Google no devolvió refresh_token. Revoca el acceso de la app en la cuenta y reintenta.')
    console.error('\nSin refresh_token:', data)
    server.close()
    return
  }

  // Confirmar con QUÉ cuenta se autorizó: es el error clásico.
  let cuenta = '(desconocida)'
  try {
    const perfil = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    }).then(x => x.json())
    cuenta = perfil.emailAddress ?? cuenta
  } catch { /* informativo */ }

  res.end('Listo. Regresa a la terminal y cierra esta pestaña.')
  console.log(`\nCuenta autorizada: ${cuenta}`)
  console.log('\nAgrega estas dos variables en Vercel (Production) y redespliega:\n')
  console.log(`TICKETS_SENDER_EMAIL=${cuenta}`)
  console.log(`TICKETS_GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`)
  if (cuenta !== 'plataformas@financieracrediflexi.com') {
    console.log('⚠  Ojo: autorizaste con otra cuenta. Vuelve a correr el script y elígela bien.\n')
  }
  server.close()
})

server.listen(PUERTO)
