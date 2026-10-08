/** Contrato de `aud_conciliacion` (AUD-003) y `aud_pendientes` (AUD-002). Sin 'use client'. */

// ── AUD-003: depósitos del banco contra lo que registró el promotor ─────────

export type EstadoConciliacion = 'sin_registro' | 'diferencia' | 'un_registro' | 'listo'

export interface DepositoDetalle {
  fecha_deposito: string
  monto: number
  periodo: number | null
}

export interface FilaConciliacion {
  grupo_id: string
  nombre_grupo: string | null
  ciclo: string
  fecha_deposito: string
  semanas: number[]
  monto_depositado: number
  n_depositos: number
  monto_registrado: number
  n_registros: number
  estado: EstadoConciliacion
  /** depositado − registrado. Negativo = se registró de más. */
  diferencia: number
  depositos: DepositoDetalle[]
}

interface CargaResumen {
  id: string
  nombre_archivo: string
  created_at: string
  fecha_min: string | null
  fecha_max: string | null
}

export interface Conciliacion {
  dep_carga: CargaResumen | null
  reg_carga: CargaResumen | null
  depositos_no_conciliados: number
  monto_no_conciliado: number
  conteo: Record<EstadoConciliacion, number>
  filas: FilaConciliacion[]
}

/** "$4,217" o "$2,555.50": decimales solo cuando el monto los trae. */
export function pesos(n: number): string {
  const entero = Math.abs(n - Math.round(n)) < 0.005
  return n.toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: 2,
  })
}

/**
 * La leyenda del estado, como la pidió Felix: la diferencia dice la dirección
 * en palabras, sin signo negativo.
 */
export function leyendaEstado(f: Pick<FilaConciliacion, 'estado' | 'diferencia'>): string {
  switch (f.estado) {
    case 'sin_registro': return 'Sin registro'
    case 'un_registro': return 'Debe ser un solo registro'
    case 'listo': return 'Listo para conciliar'
    case 'diferencia':
      return f.diferencia < 0
        ? `Registró ${pesos(-f.diferencia)} de más`
        : `Faltan ${pesos(f.diferencia)} por registrar`
  }
}

export const ETIQUETA_CONTEO: Record<EstadoConciliacion, string> = {
  listo: 'Listo para conciliar',
  sin_registro: 'Sin registro',
  diferencia: 'Con diferencia',
  un_registro: 'Debe ser un solo registro',
}

// ── AUD-002 ─────────────────────────────────────────────────────────────────

export interface DepositoPendiente {
  grupo_id: string
  nombre_grupo: string | null
  ciclo: string
  periodo: number | null
  fecha_deposito: string
  monto: number
  promotor: string | null
}

export interface PendientesAuditor {
  carga: {
    id: string
    nombre_archivo: string
    created_at: string
    fecha_min: string | null
    fecha_max: string | null
  } | null
  registros: number
  sin_conciliar: number
  monto_sin_conciliar: number
  grupos_pendientes: number
  /** Registros con promotor asignado. 0 mientras el archivo no traiga la columna. */
  con_promotor: number
  pendientes: DepositoPendiente[]
  resueltos_desde_anterior: number
}
