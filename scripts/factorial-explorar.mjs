// Spike de integración con Factorial (REC-067, solo lectura).
//
// Dos etapas:
//   1) OFFLINE (sin clave): descubre la estructura de recursos del SDK oficial
//      (@factorialco/api-client) imprimiendo namespaces > recursos > métodos.
//   2) ONLINE (con clave): lista catálogos reales (legal entities, locations,
//      teams, job catalog tree_nodes) para obtener los IDs que necesita el alta.
//      NO crea ni modifica nada.
//
// La clave se lee de .env.local (FACTORIAL_API_KEY) o de la variable de entorno.
// Base URL: producción por defecto; para demo exporta FACTORIAL_BASE_URL.
//
// Uso:
//   node scripts/factorial-explorar.mjs            # estructura + catálogos (si hay clave)
//   node scripts/factorial-explorar.mjs --tree     # solo estructura (offline)

import { readFileSync } from 'node:fs'
import { FactorialClient } from '@factorialco/api-client'

// --- cargar FACTORIAL_API_KEY desde .env.local ---
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
const apiKey = process.env.FACTORIAL_API_KEY || local.FACTORIAL_API_KEY
const baseUrl = process.env.FACTORIAL_BASE_URL || local.FACTORIAL_BASE_URL
const treeOnly = process.argv.includes('--tree')

// Instanciar no requiere clave válida (no hace red hasta que llamas un método).
const client = new FactorialClient({ apiKey: apiKey || 'placeholder', ...(baseUrl ? { baseUrl } : {}) })

// --- 1) Estructura del SDK (offline) ---
function describe(obj, depth = 0) {
  const pad = '  '.repeat(depth)
  for (const key of Object.keys(obj).sort()) {
    let val
    try { val = obj[key] } catch { continue }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      // ¿es un "recurso" (tiene métodos función) o un "namespace" (tiene sub-objetos)?
      const fns = Object.keys(val).filter((k) => {
        try { return typeof val[k] === 'function' } catch { return false }
      })
      const subs = Object.keys(val).filter((k) => {
        try { return val[k] && typeof val[k] === 'object' && !Array.isArray(val[k]) } catch { return false }
      })
      if (fns.length) {
        console.log(`${pad}${key}  ->  [${fns.sort().join(', ')}]`)
      } else {
        console.log(`${pad}${key}/`)
      }
      if (subs.length && depth < 2) describe(val, depth + 1)
    }
  }
}

console.log('=== Estructura de @factorialco/api-client (namespaces > recursos > métodos) ===\n')
describe(client)

if (treeOnly) process.exit(0)

// --- 2) Catálogos reales (online, solo lectura) ---
if (!apiKey) {
  console.log('\n[!] Sin FACTORIAL_API_KEY en .env.local ni en env: me quedo en la estructura.')
  console.log('    Agrega  FACTORIAL_API_KEY=...  a .env.local para listar catálogos reales.')
  process.exit(0)
}

console.log('\n=== Catálogos reales (solo lectura) ===')

// Intenta llamar un método de listado y muestra los primeros resultados de forma segura.
async function intentar(nombre, fn) {
  try {
    const res = await fn()
    // el SDK devuelve { data: { data, meta }, error }
    const payload = res?.data?.data ?? res?.data ?? res
    const items = Array.isArray(payload) ? payload : payload?.data ?? []
    console.log(`\n--- ${nombre}: ${Array.isArray(items) ? items.length : '?'} ---`)
    console.log(JSON.stringify(Array.isArray(items) ? items.slice(0, 5) : items, null, 2))
  } catch (e) {
    const detalle = e?.message || e?.error?.message || JSON.stringify(e?.error ?? e)
    console.log(`\n--- ${nombre}: ERROR -> ${detalle} ---`)
  }
}

// Las rutas exactas se ajustan tras ver la estructura del paso 1.
// Estos son los candidatos según la doc (companies/legal_entities, locations/locations,
// teams, job_catalog/tree_nodes). Si el nombre difiere, el catch lo reporta sin abortar.
await intentar('legal_entities', () => client.companies?.legalEntities?.list?.())
await intentar('locations',      () => client.locations?.locations?.list?.())
await intentar('teams',          () => client.teams?.teams?.list?.())
await intentar('job_catalog/tree_nodes', () => client.jobCatalog?.treeNodes?.list?.())
await intentar('job_catalog/levels', () => client.jobCatalog?.levels?.list?.())
await intentar('job_catalog/roles', () => client.jobCatalog?.roles?.list?.())
await intentar('employees (muestra)', () => client.employees?.employees?.list?.())

console.log('\nListo. Nada fue creado ni modificado (solo lectura).')
