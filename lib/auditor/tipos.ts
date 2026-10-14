/** Contrato de `aud_conciliacion` (AUD-003/004) y `aud_pendientes` (AUD-002). Sin 'use client'. */

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
  /** Del reporte de antigüedad (AUD-004); null si el grupo no viene ahí. */
  promotor: string | null
}

interface CargaResumen {
  id: string
  nombre_archivo: string
  created_at: string
  fecha_min: string | null
  fecha_max: string | null
}

// ── AUD-004: cada promotor ve solo lo suyo ──────────────────────────────────

/** Qué le toca ver a quien consulta (`aud_mi_papel`). */
export type PapelAuditor = 'todo' | 'gerente' | 'promotor'

/** activa = ya entró a la plataforma · sin_entrar = tiene correo pero no ha entrado. */
export type CuentaPromotor = 'activa' | 'sin_entrar' | 'sin_correo'

export interface PromotorPendiente {
  clave: string
  nombre: string
  gerente: string | null
  filas: number
  depositos: number
  monto: number
  /** null cuando consulta el propio promotor. */
  cuenta: CuentaPromotor | null
}

export interface Conciliacion {
  papel: PapelAuditor
  dep_carga: CargaResumen | null
  reg_carga: CargaResumen | null
  ant_carga: (Omit<CargaResumen, 'fecha_min' | 'fecha_max'> & { fecha_corte: string | null }) | null
  /** El promotor del filtro, si hay. */
  promotor: { clave: string; nombre: string } | null
  depositos_no_conciliados: number
  monto_no_conciliado: number
  /** Del alcance de quien consulta y del promotor elegido; el filtro de grupo no los toca. */
  conteo: Record<EstadoConciliacion, number>
  /** Lo pendiente de cada promotor dentro del alcance, sin el filtro de promotor. */
  promotores: PromotorPendiente[]
  /** Filas cuyo grupo no viene en el reporte de antigüedad. */
  sin_promotor: number
  filas: FilaConciliacion[]
}

/** Una persona del reporte de antigüedad vigente y su cuenta (`aud_personas_vigentes`). */
export interface PersonaReporte {
  clave: string
  nombre: string
  papel: 'promotor' | 'gerente'
  grupos: number
  email: string | null
  origen: 'auto' | 'manual'
  /** Ya existe un perfil con ese correo. */
  entro: boolean
}

export interface CandidatoCuenta {
  email: string
  nombre: string
}

export interface PersonasVigentes {
  personas: PersonaReporte[]
  candidatos: CandidatoCuenta[]
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
