/**
 * Reportes de seguimiento de vacaciones (VAC-009): calendario de ausencias,
 * aniversarios próximos y tiempos de respuesta. Puro: lo comparten la página
 * /vacaciones/reportes, "Mi equipo", el Excel y el informe ejecutivo en PDF.
 */

import { esHabil, fechaCorta, partesFecha, sumarDias } from './calendario'
import type { SaldoEmpleado } from './tipos'

// ── Contratos de los RPCs ───────────────────────────────────────────────────

export type EstadoAusencia = 'aprobada' | 'pendiente_jefe' | 'pendiente_rh'

/** Lo que regresa `vac_calendario`. */
export interface Calendario {
  ausencias: {
    empleado_id: string
    nombre: string
    puesto: string | null
    area: string | null
    jefe: string | null
    tipo: 'vacaciones' | 'flotante'
    fecha_inicio: string
    fecha_fin: string
    dias: number
    estado: EstadoAusencia
    origen: 'importado' | 'registro_rh' | 'solicitud'
  }[]
  festivos: { fecha: string; nombre: string }[]
}
export type Ausencia = Calendario['ausencias'][number]

/** Lo que regresa `vac_tiempos`. */
export interface TiempoSolicitud {
  folio: number
  tipo: 'vacaciones' | 'flotante'
  empleado: string
  jefe: string | null
  estado: 'pendiente_jefe' | 'pendiente_rh' | 'aprobada' | 'rechazada' | 'cancelada'
  dias: number
  fecha_inicio: string
  created_at: string
  jefe_at: string | null
  rh_at: string | null
  cancelada_at: string | null
  jefe_resultado: 'autorizada' | 'rechazada' | null
  horas_jefe: number | null
  horas_rh: number | null
  paso: 'jefe' | 'rh' | null
  espera_habil: number | null
}

// ── Colores (paleta de referencia, validada: tres categorías, todos los pares) ─
// Aqua queda bajo 3:1 sobre blanco: por eso siempre va con leyenda y lista.
export const COLOR_AUSENCIA = {
  vacaciones: '#2a78d6',
  flotante: '#1baf7a',
  tramite: '#eb6834',
} as const

export type ClaseAusencia = keyof typeof COLOR_AUSENCIA

export const ETIQUETA_AUSENCIA: Record<ClaseAusencia, string> = {
  vacaciones: 'Vacaciones aprobadas',
  flotante: 'Día flotante aprobado',
  tramite: 'En trámite',
}

export function claseDe(a: Ausencia): ClaseAusencia {
  if (a.estado !== 'aprobada') return 'tramite'
  return a.tipo === 'flotante' ? 'flotante' : 'vacaciones'
}

// ── Ventana de semanas ──────────────────────────────────────────────────────

export interface Semana {
  /** Lunes. */
  inicio: string
  /** Viernes. */
  fin: string
  /** Lunes a viernes, festivos incluidos (se marcan aparte). */
  dias: string[]
  etiqueta: string
}

export function lunesDe(iso: string): string {
  const dia = new Date(`${iso}T12:00:00Z`).getUTCDay() // 0 = domingo
  return sumarDias(iso, dia === 0 ? -6 : 1 - dia)
}

/** "13–17 oct" o "29 sep – 3 oct". */
function etiquetaSemana(inicio: string, fin: string): string {
  const a = partesFecha(inicio)
  const b = partesFecha(fin)
  return a.mes === b.mes
    ? `${a.dia}–${b.dia} ${b.mes.slice(0, 3)}`
    : `${a.dia} ${a.mes.slice(0, 3)} – ${b.dia} ${b.mes.slice(0, 3)}`
}

/** N semanas desde la de `hoy`, de lunes a viernes. */
export function semanasDesde(hoy: string, n: number): Semana[] {
  const lunes = lunesDe(hoy)
  return Array.from({ length: n }, (_, i) => {
    const inicio = sumarDias(lunes, i * 7)
    const fin = sumarDias(inicio, 4)
    return { inicio, fin, dias: [0, 1, 2, 3, 4].map(d => sumarDias(inicio, d)), etiqueta: etiquetaSemana(inicio, fin) }
  })
}

// ── Calendario ──────────────────────────────────────────────────────────────

export interface PersonaCalendario {
  empleado_id: string
  nombre: string
  puesto: string | null
  ausencias: Ausencia[]
}

export interface GrupoCalendario {
  grupo: string
  personas: PersonaCalendario[]
}

export type Agrupar = 'jefe' | 'area' | 'ninguno'

export function leerAgrupar(v: string | undefined | null): Agrupar {
  return v === 'area' ? 'area' : v === 'ninguno' ? 'ninguno' : 'jefe'
}

/** Personas con alguna ausencia, agrupadas por jefe o por área. */
export function agruparAusencias(ausencias: Ausencia[], agrupar: Agrupar): GrupoCalendario[] {
  const grupos = new Map<string, Map<string, PersonaCalendario>>()
  for (const a of ausencias) {
    const g = agrupar === 'ninguno' ? '' : agrupar === 'area' ? (a.area ?? 'Sin área asignada') : (a.jefe ?? 'Sin jefe asignado')
    if (!grupos.has(g)) grupos.set(g, new Map())
    const personas = grupos.get(g)!
    if (!personas.has(a.empleado_id)) {
      personas.set(a.empleado_id, { empleado_id: a.empleado_id, nombre: a.nombre, puesto: a.puesto, ausencias: [] })
    }
    personas.get(a.empleado_id)!.ausencias.push(a)
  }
  return Array.from(grupos.entries())
    .map(([grupo, personas]) => ({
      grupo,
      personas: Array.from(personas.values()).sort((x, y) => x.nombre.localeCompare(y.nombre)),
    }))
    .sort((x, y) => x.grupo.localeCompare(y.grupo))
}

/** Qué hay ese día para esa persona. Lo aprobado gana sobre lo que sigue en trámite. */
export function ausenciaEnDia(p: PersonaCalendario, dia: string): Ausencia | null {
  const delDia = p.ausencias.filter(a => a.fecha_inicio <= dia && dia <= a.fecha_fin)
  return delDia.find(a => a.estado === 'aprobada') ?? delDia[0] ?? null
}

export interface FueraSemana {
  semana: Semana
  /** Personas con al menos un día hábil fuera, con todo aprobado. */
  aprobadas: number
  /** Personas cuyo día fuera sigue en trámite (y ninguno aprobado esa semana). */
  tramite: number
  /** Días-persona hábiles fuera (aprobados + en trámite). */
  dias: number
}

/** Cuántas personas estarán fuera cada semana. Un festivo no cuenta como ausencia. */
export function fueraPorSemana(ausencias: Ausencia[], semanas: Semana[], festivos: Set<string>): FueraSemana[] {
  const personas = agruparAusencias(ausencias, 'ninguno')[0]?.personas ?? []
  return semanas.map(semana => {
    let aprobadas = 0
    let tramite = 0
    let dias = 0
    for (const p of personas) {
      let aprobada = false
      let enTramite = false
      for (const d of semana.dias) {
        if (festivos.has(d) || !esHabil(d)) continue
        const a = ausenciaEnDia(p, d)
        if (!a) continue
        dias++
        if (a.estado === 'aprobada') aprobada = true
        else enTramite = true
      }
      if (aprobada) aprobadas++
      else if (enTramite) tramite++
    }
    return { semana, aprobadas, tramite, dias }
  })
}

export function rangoAusencia(a: Ausencia): string {
  return a.fecha_inicio === a.fecha_fin ? fechaCorta(a.fecha_inicio) : `${fechaCorta(a.fecha_inicio)} – ${fechaCorta(a.fecha_fin)}`
}

// ── Aniversarios ────────────────────────────────────────────────────────────

export interface Aniversario {
  id: string
  nombre: string
  puesto: string | null
  jefe: string | null
  fecha: string
  cumple: number
  gana: number
  porTomar: number
  faltan: number
}

/** Quién cumple un año más de servicio en los próximos `dias` días. */
export function aniversariosProximos(saldos: SaldoEmpleado[], hoy: string, dias: number): Aniversario[] {
  const limite = sumarDias(hoy, dias)
  const dif = (a: string, b: string) =>
    Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
  return saldos
    .filter(e => e.activo && e.proximo_aniversario >= hoy && e.proximo_aniversario <= limite)
    .map(e => ({
      id: e.id, nombre: e.nombre, puesto: e.puesto, jefe: e.jefe_nombre,
      fecha: e.proximo_aniversario, cumple: e.anios + 1, gana: e.dias_proximo,
      porTomar: Math.max(Number(e.restantes_total), 0), faltan: dif(hoy, e.proximo_aniversario),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ── Tiempos de respuesta ────────────────────────────────────────────────────

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/** "45 min", "6 h", "2.5 días". */
export function duracion(horas: number | null): string {
  if (horas === null) return '—'
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`
  if (horas < 48) return `${Math.round(horas)} h`
  return `${(horas / 24).toLocaleString('es-MX', { maximumFractionDigits: 1 })} días`
}

export interface PorJefe {
  jefe: string
  solicitudes: number
  respondidas: number
  rechazadas: number
  mediana: number | null
  maxima: number | null
  pendientes: number
  esperaMaxima: number | null
}

export interface ResumenTiempos {
  medianaJefe: number | null
  medianaRh: number | null
  respondidasJefe: number
  respondidasRh: number
  /** Pendientes con 2 días hábiles o más en el mismo paso. */
  atoradas: TiempoSolicitud[]
  pendientes: number
  porJefe: PorJefe[]
}

export function resumirTiempos(tiempos: TiempoSolicitud[]): ResumenTiempos {
  const num = (v: number | null): v is number => v !== null
  const hJefe = tiempos.map(t => (t.horas_jefe === null ? null : Number(t.horas_jefe))).filter(num)
  const hRh = tiempos.map(t => (t.horas_rh === null ? null : Number(t.horas_rh))).filter(num)

  const porJefe = new Map<string, TiempoSolicitud[]>()
  for (const t of tiempos) {
    if (!t.jefe) continue
    porJefe.set(t.jefe, [...(porJefe.get(t.jefe) ?? []), t])
  }

  return {
    medianaJefe: mediana(hJefe),
    medianaRh: mediana(hRh),
    respondidasJefe: hJefe.length,
    respondidasRh: hRh.length,
    pendientes: tiempos.filter(t => t.paso !== null).length,
    atoradas: tiempos
      .filter(t => t.paso !== null && (t.espera_habil ?? 0) >= 2)
      .sort((a, b) => (b.espera_habil ?? 0) - (a.espera_habil ?? 0)),
    porJefe: Array.from(porJefe.entries())
      .map(([jefe, ts]) => {
        const horas = ts.map(t => (t.horas_jefe === null ? null : Number(t.horas_jefe))).filter(num)
        const pendientes = ts.filter(t => t.paso === 'jefe')
        return {
          jefe,
          solicitudes: ts.length,
          respondidas: horas.length,
          rechazadas: ts.filter(t => t.jefe_resultado === 'rechazada').length,
          mediana: mediana(horas),
          maxima: horas.length ? Math.max(...horas) : null,
          pendientes: pendientes.length,
          esperaMaxima: pendientes.length ? Math.max(...pendientes.map(t => t.espera_habil ?? 0)) : null,
        }
      })
      .sort((a, b) => b.pendientes - a.pendientes || (b.mediana ?? 0) - (a.mediana ?? 0)),
  }
}
