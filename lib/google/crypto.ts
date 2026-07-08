import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

// Cifrado simétrico AES-256-GCM del refresh_token de Google antes de guardarlo
// en rec_credenciales_google. La llave vive en GOOGLE_TOKEN_ENCRYPTION_KEY
// (cualquier cadena larga; se deriva con SHA-256 a 32 bytes).

function key(): Buffer {
  const k = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!k) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY no configurada')
  return createHash('sha256').update(k).digest()
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, enc].map(b => b.toString('base64')).join('.')
}

export function descifrar(payload: string): string {
  const [iv, tag, enc] = payload.split('.').map(p => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
