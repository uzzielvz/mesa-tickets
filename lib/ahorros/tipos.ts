/**
 * Contrato de los RPCs del visor de ahorros (AHO-003). La pantalla y el Excel
 * leen de aquí, nunca de las columnas de `aho_pagos`: la tabla es temporal
 * (regla 3) y el día que el origen cambie, solo cambia el RPC.
 *
 * Sin 'use client': lo usan la página (servidor), la ruta de descarga y los
 * componentes.
 */

/** Las columnas de rendimiento que trae el CSV: hasta el pago 10, 11, … 16. */
export const PAGOS_CORTE = [10, 11, 12, 13, 14, 15, 16] as const
export type PagoCorte = (typeof PAGOS_CORTE)[number]

/**
 * La plantilla de Felix fija la columna del pago 12. Él la cambia según la
 * semana de renovación, que no viene en el archivo; mientras no venga, el
 * asesor la elige y la pantalla dice cuál está viendo.
 */
export const CORTE_POR_DEFECTO: PagoCorte = 12

export type Rendimientos = Record<`${PagoCorte}`, number>

export interface SemanaAhorro {
  semana: number
  fecha_pago: string | null
  pago: number | null
  garantia: number | null
  confirmada: boolean | null
  falta_ahorro: boolean
}

export interface ClienteAhorro {
  cliente_id: string
  cantidad_prestada: number | null
  base_ahorro: number | null
  pago_semanal: number | null
  inicio_ciclo: string | null
  /** Σ garantías del ciclo. Es la columna "AHORRO ACUMULADO" de la plantilla. */
  ahorro: number
  pagado: number
  semanas_con_ahorro: number
  sin_credito: boolean
  /** Σ rendimiento_hasta_pagoN. NO incluye el rendimiento de la base. */
  rend: Rendimientos
  semanas: SemanaAhorro[]
}

export type BusquedaAhorros =
  | {
      encontrado: false
      motivo: 'grupo_invalido' | 'falta_ciclo' | 'sin_datos'
      grupo_id?: string
      ciclo?: string
      key_grupo?: string
      ciclos?: string[]
    }
  | {
      encontrado: true
      grupo_id: string
      ciclo: string
      key_grupo: string
      ciclos: string[]
      actualizado_at: string
      carga: { nombre_archivo: string; created_at: string } | null
      /** Todas las filas con `falta_pago`: el ciclo existe pero sin información. */
      sin_datos_credito: boolean
      resumen: {
        clientes: number
        prestado: number | null
        base: number | null
        ahorro: number
        rend: Rendimientos
      }
      clientes: ClienteAhorro[]
    }

export interface ResumenAhorros {
  grupos: number
  clientes: number
  ultima_carga: {
    nombre_archivo: string
    created_at: string
    estado: 'en_curso' | 'completa'
    grupos: number
    insertadas: number
    actualizadas: number
  } | null
  recientes: {
    key_grupo: string
    grupo_id: string
    ciclo: string
    clientes: number
    actualizado_at: string
  }[]
  /** Solo para quien carga; null para los asesores. */
  uso: { consultas_30d: number; descargas_30d: number; usuarios_30d: number } | null
}

export function leerCorte(n?: string): PagoCorte {
  const x = Number(n)
  return (PAGOS_CORTE as readonly number[]).includes(x) ? (x as PagoCorte) : CORTE_POR_DEFECTO
}

// ── Formato ──────────────────────────────────────────────────────────────────
const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2,
})

/** Siempre a dos decimales: es dinero de una clienta, no un tablero. */
export const pesos = (n: number | null | undefined) => (n === null || n === undefined ? '—' : MXN.format(n))

/** "000439" → "439": así lo dice la gente; la llave completa va en el detalle. */
export const sinCeros = (s: string) => s.replace(/^0+(?=\d)/, '')

export function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export function momento(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })
}
