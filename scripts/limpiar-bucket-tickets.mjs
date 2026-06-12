// Vacía el bucket 'ticket-attachments' (limpieza pre go-live).
// Requiere el service_role_key porque borrar archivos de otros usuarios
// no es posible con la anon key (lo bloquea RLS de Storage).
//
// Uso (PowerShell / bash):
//   SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key> node scripts/limpiar-bucket-tickets.mjs
//
// La URL se lee de .env.local (NEXT_PUBLIC_SUPABASE_URL).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'ticket-attachments'

// --- cargar NEXT_PUBLIC_SUPABASE_URL desde .env.local ---
function envLocal() {
  try {
    const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    return Object.fromEntries(
      txt.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        })
    )
  } catch {
    return {}
  }
}

const local = envLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL (en .env.local o env).')
  process.exit(1)
}
if (!key) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY. Pásalo así:')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/limpiar-bucket-tickets.mjs')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// Lista recursiva de todos los paths de archivo del bucket.
async function listarTodo(prefix = '') {
  const paths = []
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      // carpeta (prefijo): recursar
      paths.push(...(await listarTodo(full)))
    } else {
      paths.push(full)
    }
  }
  return paths
}

const paths = await listarTodo()
console.log(`Archivos encontrados en '${BUCKET}': ${paths.length}`)
if (paths.length === 0) {
  console.log('Bucket ya está vacío. Nada que hacer.')
  process.exit(0)
}

// Borrar en lotes de 100
let borrados = 0
for (let i = 0; i < paths.length; i += 100) {
  const lote = paths.slice(i, i + 100)
  const { error } = await supabase.storage.from(BUCKET).remove(lote)
  if (error) {
    console.error('Error borrando lote:', error.message)
    process.exit(1)
  }
  borrados += lote.length
  console.log(`  borrados ${borrados}/${paths.length}`)
}

console.log(`Listo. ${borrados} archivos eliminados del bucket '${BUCKET}'.`)
