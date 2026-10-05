/** Contrato de `aud_pendientes` (AUD-002). Sin 'use client': lo usan página y componentes. */

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
