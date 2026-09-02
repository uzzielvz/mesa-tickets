/**
 * Ingesta de los hechos de una carga (I2).
 *
 * Vive aparte de las rutas porque lo usan dos: la carga inicial y el
 * reprocesamiento. **Reprocesar tiene que ser posible sin volver a subir el
 * archivo** — el original ya está en Storage, y cada vez que se corrija el
 * parser habrá que reconstruir lo que se guardó con la versión anterior. Sin eso
 * la única salida sería borrar y pedirle a Felix que suba de nuevo.
 *
 * Recibe el cliente de Supabase por parámetro, igual que `leerAjustes` de
 * Reclutamiento, para no crear uno nuevo dentro de una ruta que ya tiene el suyo.
 */

import type ExcelJS from 'exceljs'
import type { createClient } from '@/lib/supabase/server'
import { leerCalendario, type ResumenCalendario } from '@/lib/inversiones/calendario'
import { leerTablero, type ResumenTablero } from '@/lib/inversiones/tablero'
import type { TipoReporte } from '@/lib/inversiones/excel'

/**
 * Postgres tiene límite de parámetros por sentencia y `inv_movimientos` tiene 66
 * columnas: 200 filas × 68 ≈ 13,600 parámetros, cómodo bajo el tope de 65,535.
 */
const LOTE = 200

/** Tablas de hechos, en el orden en que se limpian y se llenan. */
const TABLAS_CALENDARIO = ['inv_pagos', 'inv_pagos_validaciones'] as const
const TABLAS_TABLERO = [
  'inv_movimientos', 'inv_cumplimiento', 'inv_ranking',
  'inv_tablero_resumen', 'inv_posiciones', 'inv_eventos', 'inv_validaciones',
] as const

type TablaHechos = (typeof TABLAS_CALENDARIO)[number] | (typeof TABLAS_TABLERO)[number]

export type ResultadoProceso =
  | { ok: true; resumen: ResumenCalendario | ResumenTablero | null; avisos: string[]; filas: number }
  | { ok: false; errores: string[] }

async function insertarEnLotes<T>(
  supabase: ReturnType<typeof createClient>,
  tabla: TablaHechos,
  filas: T[],
): Promise<string | null> {
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(tabla).insert(lote as any)
    if (error) return error.message
  }
  return null
}

/**
 * Parsea el libro y deja los hechos de esta carga en la base.
 *
 * Es idempotente: primero borra lo que hubiera de esta misma carga. Correrlo dos
 * veces deja exactamente el mismo resultado que correrlo una.
 */
export async function procesarCarga(
  supabase: ReturnType<typeof createClient>,
  cargaId: string,
  tipo: TipoReporte,
  wb: ExcelJS.Workbook,
): Promise<ResultadoProceso> {
  const tablas = tipo === 'calendario' ? TABLAS_CALENDARIO : TABLAS_TABLERO

  const limpiar = async () => {
    for (const t of tablas) await supabase.from(t).delete().eq('carga_id', cargaId)
  }

  // Idempotencia: fuera lo anterior de esta carga antes de escribir.
  await limpiar()

  /**
   * Guarda un conjunto. Si algo falla, borra TODO lo de esta carga: media carga
   * guardada es peor que ninguna, porque las sumas darían cifras plausibles y
   * equivocadas.
   */
  const guardar = async (
    tabla: TablaHechos,
    filas: Record<string, unknown>[],
  ): Promise<string | null> => {
    if (filas.length === 0) return null
    const err = await insertarEnLotes(
      supabase, tabla, filas.map(f => ({ ...f, carga_id: cargaId })),
    )
    if (err) {
      await limpiar()
      return `No se pudo guardar ${tabla}: ${err}`
    }
    return null
  }

  if (tipo === 'calendario') {
    const lectura = leerCalendario(wb)
    if (!lectura.ok) return { ok: false, errores: lectura.errores }

    for (const [tabla, filas] of [
      ['inv_pagos', lectura.pagos],
      ['inv_pagos_validaciones', lectura.validaciones],
    ] as const) {
      const err = await guardar(tabla, filas as unknown as Record<string, unknown>[])
      if (err) return { ok: false, errores: [err] }
    }

    return {
      ok: true,
      resumen: lectura.resumen,
      avisos: lectura.avisos,
      filas: lectura.resumen.filas,
    }
  }

  const lectura = leerTablero(wb)
  if (!lectura.ok) return { ok: false, errores: lectura.errores }

  for (const [tabla, filas] of [
    ['inv_movimientos', lectura.movimientos],
    ['inv_cumplimiento', lectura.cumplimiento],
    ['inv_ranking', lectura.ranking],
    ['inv_tablero_resumen', lectura.tableroResumen],
    ['inv_posiciones', lectura.posiciones],
    ['inv_eventos', lectura.eventos],
    ['inv_validaciones', lectura.validaciones],
  ] as const) {
    const err = await guardar(tabla, filas)
    if (err) return { ok: false, errores: [err] }
  }

  return {
    ok: true,
    resumen: lectura.resumen,
    avisos: lectura.avisos,
    // Las filas que cuentan son los hechos, no la suma de las siete tablas: es
    // la cifra que se compara contra el archivo cuando algo no cuadra.
    filas: lectura.resumen.movimientos,
  }
}

/** Marca el desenlace en la bitácora. La carga nunca se queda sin estado. */
export async function marcarCarga(
  supabase: ReturnType<typeof createClient>,
  cargaId: string,
  resultado: ResultadoProceso,
  avisosPrevios: string[],
): Promise<void> {
  const avisos = resultado.ok
    ? [...avisosPrevios, ...resultado.avisos]
    : avisosPrevios

  await supabase
    .from('inv_cargas')
    .update({
      estado: resultado.ok ? 'procesado' : 'error',
      error_detalle: resultado.ok ? null : resultado.errores.join(' · '),
      avisos,
      // `filas` cuenta los HECHOS de la carga: pagos en el Calendario,
      // movimientos en el Tablero. No es la suma de todas las tablas.
      filas: resultado.ok ? resultado.filas : 0,
    })
    .eq('id', cargaId)
}
