/**
 * Sugerencia de cuenta para un nombre del reporte de antigüedad que la base no
 * encontró sola (AUD-004). La base solo acepta el mismo nombre exacto (sin
 * importar orden, acentos ni puntos); aquí se tolera un error de dedo por
 * palabra, como "Bentancourt" en la lista de altas contra "Betancourt" en
 * Yunius. Es solo una sugerencia: la confirma una persona. Sin 'use client'.
 */

export interface Candidato {
  email: string
  nombre: string
}

const palabras = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean)

/** Distancia de edición, cortada en `tope` + 1 para no gastar en lo que ya no sirve. */
function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let min = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      min = Math.min(min, cur[j])
    }
    if (min > tope) return tope + 1
    prev = cur
  }
  return prev[b.length]
}

/** Las palabras de `a` que tienen pareja en `b` (igual, un error de dedo, o el principio si `a` viene cortado). */
function parecidas(a: string[], b: string[], cortado: boolean): number {
  const libres = [...b]
  let n = 0
  a.forEach((w, i) => {
    const ultima = cortado && i === a.length - 1
    const k = libres.findIndex(x => x === w || (ultima && x.startsWith(w)) || (w.length >= 5 && distancia(w, x, 1) <= 1))
    if (k >= 0) { n++; libres.splice(k, 1) }
  })
  return n
}

/**
 * El candidato cuyo nombre coincide con todas las palabras (con tolerancia) y
 * tiene el mismo número de palabras. Si hay más de uno, ninguno: no se adivina.
 */
export function sugerirCuenta(nombre: string, candidatos: Candidato[]): Candidato | null {
  const p = palabras(nombre)
  if (p.length < 2) return null
  const cortado = nombre.trim().length >= 30
  const buenos = candidatos.filter(c => {
    const q = palabras(c.nombre)
    return q.length === p.length && parecidas(p, q, cortado) === p.length
  })
  return buenos.length === 1 ? buenos[0] : null
}
