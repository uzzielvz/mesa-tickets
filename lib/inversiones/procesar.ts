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
import type { TipoReporte } from '@/lib/inversiones/excel'

/** Postgres tiene límite de parámetros por sentencia; 500 filas va sobrado. */
const LOTE = 500

export type ResultadoProceso =
  | { ok: true; resumen: ResumenCalendario | null; avisos: string[] }
  | { ok: false; errores: string[] }

async function insertarEnLotes<T>(
  supabase: ReturnType<typeof createClient>,
  tabla: 'inv_pagos' | 'inv_pagos_validaciones',
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
  if (tipo === 'tablero') {
    // I4 todavía no existe. Se dice explícitamente en vez de dejar la carga en
    // `pendiente` sin explicación, que se lee como si algo hubiera fallado.
    return {
      ok: true,
      resumen: null,
      avisos: ['El Tablero Ejecutivo se guarda completo, pero todavía no se leen sus datos.'],
    }
  }

  const lectura = leerCalendario(wb)
  if (!lectura.ok) return { ok: false, errores: lectura.errores }

  // Idempotencia: fuera lo anterior de esta carga.
  const { error: errBorrado } = await supabase.from('inv_pagos').delete().eq('carga_id', cargaId)
  if (errBorrado) {
    return { ok: false, errores: [`No se pudo limpiar la carga previa: ${errBorrado.message}`] }
  }
  await supabase.from('inv_pagos_validaciones').delete().eq('carga_id', cargaId)

  const errPagos = await insertarEnLotes(
    supabase,
    'inv_pagos',
    lectura.pagos.map(p => ({ ...p, carga_id: cargaId })),
  )
  if (errPagos) {
    // Sin esto quedaría media carga guardada, que es peor que ninguna: las sumas
    // darían cifras plausibles y equivocadas.
    await supabase.from('inv_pagos').delete().eq('carga_id', cargaId)
    return { ok: false, errores: [`No se pudieron guardar los pagos: ${errPagos}`] }
  }

  if (lectura.validaciones.length > 0) {
    const errVal = await insertarEnLotes(
      supabase,
      'inv_pagos_validaciones',
      lectura.validaciones.map(v => ({ ...v, carga_id: cargaId })),
    )
    if (errVal) {
      await supabase.from('inv_pagos').delete().eq('carga_id', cargaId)
      return { ok: false, errores: [`No se pudieron guardar las validaciones: ${errVal}`] }
    }
  }

  return { ok: true, resumen: lectura.resumen, avisos: lectura.avisos }
}

/** Marca el desenlace en la bitácora. La carga nunca se queda sin estado. */
export async function marcarCarga(
  supabase: ReturnType<typeof createClient>,
  cargaId: string,
  resultado: ResultadoProceso,
  avisosPrevios: string[],
  filas: number,
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
      filas,
    })
    .eq('id', cargaId)
}
