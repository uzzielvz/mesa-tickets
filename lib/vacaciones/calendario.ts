/**
 * Calendario laboral del módulo de Vacaciones. Puro: lo usan el formulario de
 * registro (navegador), el formato impreso y el import (servidor).
 *
 * Regla de conteo, verificada contra la base de Gente y Cultura (2026-10-04):
 * los días de vacaciones son hábiles de LUNES A VIERNES — 23 de 26 registros
 * con fechas legibles cuadran exacto así. Además se saltan los días de
 * descanso obligatorio del Art. 74 LFT: no son días de vacaciones. RH puede
 * corregir el número a mano si un caso no encaja.
 */

/** Art. 74 LFT. Los lunes "movibles" ya resueltos por año. */
export const FESTIVOS: Record<string, string> = {
  '2025-01-01': 'Año Nuevo',
  '2025-02-03': 'Día de la Constitución',
  '2025-03-17': 'Natalicio de Benito Juárez',
  '2025-05-01': 'Día del Trabajo',
  '2025-09-16': 'Día de la Independencia',
  '2025-11-17': 'Día de la Revolución',
  '2025-12-25': 'Navidad',
  '2026-01-01': 'Año Nuevo',
  '2026-02-02': 'Día de la Constitución',
  '2026-03-16': 'Natalicio de Benito Juárez',
  '2026-05-01': 'Día del Trabajo',
  '2026-09-16': 'Día de la Independencia',
  '2026-11-16': 'Día de la Revolución',
  '2026-12-25': 'Navidad',
  '2027-01-01': 'Año Nuevo',
  '2027-02-01': 'Día de la Constitución',
  '2027-03-15': 'Natalicio de Benito Juárez',
  '2027-05-01': 'Día del Trabajo',
  '2027-09-16': 'Día de la Independencia',
  '2027-11-15': 'Día de la Revolución',
  '2027-12-25': 'Navidad',
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Las fechas se manejan como 'YYYY-MM-DD' y se operan en UTC para que la zona no mueva el día. */
const aFecha = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)
const aIso = (d: Date) => d.toISOString().slice(0, 10)

export function sumarDias(iso: string, n: number): string {
  const d = aFecha(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return aIso(d)
}

export function esHabil(iso: string): boolean {
  const dia = aFecha(iso).getUTCDay()
  return dia !== 0 && dia !== 6 && !(iso in FESTIVOS)
}

/** Días hábiles entre dos fechas, ambas incluidas. */
export function diasHabiles(inicio: string, fin: string): number {
  if (!inicio || !fin || fin < inicio) return 0
  let n = 0
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) if (esHabil(d)) n++
  return n
}

/** Festivos que caen dentro del rango: se enseñan para que RH sepa por qué no cuentan. */
export function festivosEntre(inicio: string, fin: string): { fecha: string; nombre: string }[] {
  if (!inicio || !fin || fin < inicio) return []
  return Object.entries(FESTIVOS)
    .filter(([f]) => f >= inicio && f <= fin)
    .map(([fecha, nombre]) => ({ fecha, nombre }))
}

/** "Fecha en que deberá presentarse a trabajar": el siguiente día hábil después del último día. */
export function fechaRegreso(fin: string): string {
  let d = sumarDias(fin, 1)
  while (!esHabil(d)) d = sumarDias(d, 1)
  return d
}

export function partesFecha(iso: string): { dia: number; mes: string; anio: number } {
  const d = aFecha(iso)
  return { dia: d.getUTCDate(), mes: MESES[d.getUTCMonth()], anio: d.getUTCFullYear() }
}

/** "4 de octubre de 2026" */
export function fechaLarga(iso: string | null): string {
  if (!iso) return '—'
  const { dia, mes, anio } = partesFecha(iso)
  return `${dia} de ${mes} de ${anio}`
}

/** "4 oct 2026" */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  return aFecha(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Hoy en México, 'YYYY-MM-DD'. */
export function hoyMexico(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

/** "2 años, 7 meses" — lo que la base escribía como texto "2AÑOS7MESES20DIAS". */
export function antiguedad(ingreso: string, hoy: string): string {
  const a = aFecha(ingreso)
  const b = aFecha(hoy)
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  if (b.getUTCDate() < a.getUTCDate()) meses--
  if (meses < 0) return 'aún no ingresa'
  const anios = Math.floor(meses / 12)
  const m = meses % 12
  if (anios === 0) return m === 1 ? '1 mes' : `${m} meses`
  const tA = anios === 1 ? '1 año' : `${anios} años`
  return m === 0 ? tA : `${tA}, ${m === 1 ? '1 mes' : `${m} meses`}`
}

/** Llave de una persona: sin acentos, mayúsculas, espacios simples. */
export function nombreClave(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim()
}
