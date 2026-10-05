/**
 * Contrato del RPC `vac_saldos` (VAC-003) y de los movimientos. Sin 'use
 * client': lo usan páginas de servidor, el formato impreso y los formularios.
 */

export interface PeriodoVacaciones {
  /** Año de servicio: el "CICLO" de la base de Excel. */
  periodo: number
  /** Del aniversario N-1 al N: el "Período a disfrutar" del formato. */
  desde: string
  hasta: string
  derecho: number
  tomados: number
  restantes: number
}

export interface SaldoEmpleado {
  id: string
  nombre: string
  puesto: string | null
  area: string | null
  numero_empleado: string | null
  fecha_ingreso: string
  email: string | null
  jefe_id: string | null
  jefe_nombre: string | null
  activo: boolean
  en_ciclo1: boolean
  en_ciclo2: boolean
  /** Años de servicio cumplidos hoy (hora de México). */
  anios: number
  dias_trabajados: number
  proximo_aniversario: string
  dias_proximo: number
  periodos: PeriodoVacaciones[]
  restantes_total: number
  flotantes_anio: number
}

export interface Movimiento {
  id: string
  folio: number
  empleado_id: string
  tipo: 'vacaciones' | 'flotante'
  periodo: number | null
  dias: number
  fecha_inicio: string | null
  fecha_fin: string | null
  fecha_regreso: string | null
  fechas_texto: string | null
  observaciones: string | null
  origen: 'importado' | 'registro_rh'
  registrado_por: string | null
  created_at: string
  anulado_at: string | null
}

/** Datos fijos del formato GYC. */
export const EMPRESA = 'CREDIFLEXI'
export const CIUDAD = 'TOLUCA'

/**
 * El periodo al que se cargan días nuevos por defecto: el más viejo que todavía
 * tiene saldo. Es lo que hace la base de Excel (Nohemí terminó el ciclo 1 y
 * siguió con el 2).
 */
export function periodoSugerido(periodos: PeriodoVacaciones[]): number | null {
  return periodos.find(p => p.restantes > 0)?.periodo ?? periodos[periodos.length - 1]?.periodo ?? null
}
