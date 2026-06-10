import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MOCK_FECHAS,
  mockResumen,
  mockPorCoordinacion,
  mockPorRecuperador,
  mockMora,
  mockCohort,
} from './mock-data'

/** Modo demo: tools devuelven datos sintéticos (permite tier gratuito de Gemini sin exponer datos reales). */
export const isMockMode = () => process.env.AI_ASSISTANT_MOCK === 'true'

/**
 * Tools del Asistente CrediFlexi (Fase IA-A, ticket AI-002).
 *
 * Envuelven los RPCs de cartera existentes. Se ejecutan server-side con el
 * cliente Supabase de la SESIÓN del usuario, por lo que los checks de permisos
 * de cada RPC (security definer + rol=admin OR acceso_cartera) aplican solos.
 *
 * PII (decisión 2026-06-09, PLAN §4): la tool de mora va SEUDONIMIZADA —
 * código de acreditado, saldos y días, sin nombres ni teléfonos de acreditados.
 */

const fechaCorteSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
  .describe('Fecha de corte en formato YYYY-MM-DD. Debe ser una de las fechas disponibles.')

/** Filas máximas de mora que se envían al modelo (vienen ordenadas por días desc). */
const MORA_MAX_FILAS = 30

type MoraCreditoRpc = {
  codigo_acreditado: string
  nombre_acreditado: string | null
  coordinacion: string
  codigo_recuperador: string | null
  nombre_recuperador: string | null
  ciclo: string
  dias_mora: number
  bucket: string
  saldo_total: number
  saldo_vencido: number
  pagos_vencidos: number | null
  dias_desde_ultimo_pago: number | null
  fecha_ultimo_pago: string | null
  alerta: string | null
  criticidad: string | null
  contacto: string | null
}

function rpcError(context: string, message: string) {
  return { error: `${context}: ${message}` }
}

export function buildCarteraTools(supabase: SupabaseClient<any>) {
  return {
    obtenerFechasDisponibles: tool({
      description:
        'Lista las fechas de corte de cartera disponibles (uploads procesados), de la más reciente a la más antigua. Úsala primero si no sabes qué fecha consultar; la más reciente es el "último corte".',
      inputSchema: z.object({}),
      execute: async () => {
        if (isMockMode()) return { fechas: MOCK_FECHAS, ultimo_corte: MOCK_FECHAS[0] }
        const { data, error } = await supabase
          .from('cartera_uploads')
          .select('fecha_corte')
          .eq('estado', 'procesado')
          .order('fecha_corte', { ascending: false })
        if (error) return rpcError('Error consultando fechas', error.message)
        const fechas = Array.from(new Set((data ?? []).map(u => u.fecha_corte as string)))
        return { fechas, ultimo_corte: fechas[0] ?? null }
      },
    }),

    obtenerResumenCartera: tool({
      description:
        'Snapshot ejecutivo de la cartera a una fecha de corte: totales (créditos, cartera total, mora), distribución PAR en 8 buckets e indicadores PAR>30 / PAR>90. Acepta filtros opcionales por coordinación, recuperador o ciclo. Equivale al dashboard /cartera.',
      inputSchema: z.object({
        fecha_corte: fechaCorteSchema,
        coordinacion: z.string().optional().describe('Filtrar por coordinación (nombre exacto)'),
        codigo_recuperador: z.string().optional().describe('Filtrar por código de recuperador'),
        ciclo: z.string().optional().describe('Filtrar por ciclo'),
      }),
      execute: async ({ fecha_corte, coordinacion, codigo_recuperador, ciclo }) => {
        if (isMockMode()) return mockResumen(fecha_corte)
        const { data, error } = await supabase.rpc('cartera_resumen', {
          p_fecha_corte: fecha_corte,
          p_coordinacion: coordinacion ?? null,
          p_codigo_recuperador: codigo_recuperador ?? null,
          p_ciclo: ciclo ?? null,
        })
        if (error) return rpcError('Error en cartera_resumen', error.message)
        return data
      },
    }),

    obtenerPorCoordinacion: tool({
      description:
        'Cartera desglosada por coordinación (región): por cada una, totales, % mora, PAR>30/90 y los 8 buckets PAR. Ordenada de mayor a menor riesgo (pct_par_30 desc). Equivale al dashboard /cartera/coordinacion.',
      inputSchema: z.object({ fecha_corte: fechaCorteSchema }),
      execute: async ({ fecha_corte }) => {
        if (isMockMode()) return mockPorCoordinacion(fecha_corte)
        const { data, error } = await supabase.rpc('cartera_por_coordinacion', {
          p_fecha_corte: fecha_corte,
        })
        if (error) return rpcError('Error en cartera_por_coordinacion', error.message)
        return data
      },
    }),

    obtenerPorRecuperador: tool({
      description:
        'Cartera desglosada por recuperador (cobrador): código, nombre, coordinación, totales, % mora, PAR>30/90 y buckets. Ordenada de mayor a menor riesgo. Filtro opcional por coordinación. Equivale al dashboard /cartera/recuperador.',
      inputSchema: z.object({
        fecha_corte: fechaCorteSchema,
        coordinacion: z.string().optional().describe('Filtrar por coordinación (nombre exacto)'),
      }),
      execute: async ({ fecha_corte, coordinacion }) => {
        if (isMockMode()) return mockPorRecuperador(fecha_corte, coordinacion)
        const { data, error } = await supabase.rpc('cartera_por_recuperador', {
          p_fecha_corte: fecha_corte,
          p_coordinacion: coordinacion ?? null,
        })
        if (error) return rpcError('Error en cartera_por_recuperador', error.message)
        return data
      },
    }),

    obtenerMora: tool({
      description:
        `Bandeja operativa de mora: créditos con días de mora >= dias_min, ordenados por días desc. Devuelve datos SEUDONIMIZADOS (código de acreditado, sin nombre ni teléfono) y máximo ${MORA_MAX_FILAS} filas + agregados del total. Para ver nombres y contacto, el usuario debe ir a /cartera/mora. Equivale a la hoja "Mora" del Excel legacy.`,
      inputSchema: z.object({
        fecha_corte: fechaCorteSchema,
        coordinacion: z.string().optional().describe('Filtrar por coordinación (nombre exacto)'),
        dias_min: z.number().int().min(1).optional().describe('Días de mora mínimos (default 1)'),
      }),
      execute: async ({ fecha_corte, coordinacion, dias_min }) => {
        if (isMockMode()) return mockMora(fecha_corte, coordinacion, dias_min ?? 1)
        const { data, error } = await supabase.rpc('cartera_mora_operativa', {
          p_fecha_corte: fecha_corte,
          p_coordinacion: coordinacion ?? null,
          p_dias_min: dias_min ?? 1,
        })
        if (error) return rpcError('Error en cartera_mora_operativa', error.message)

        const resumen = data as { fecha_corte: string; coordinacion: string | null; dias_min: number; creditos: MoraCreditoRpc[] }
        const creditos = resumen?.creditos ?? []

        // Seudonimización: se omiten nombre_acreditado y contacto (PII de clientes).
        const filas = creditos.slice(0, MORA_MAX_FILAS).map(c => ({
          codigo_acreditado: c.codigo_acreditado,
          ciclo: c.ciclo,
          coordinacion: c.coordinacion,
          codigo_recuperador: c.codigo_recuperador,
          nombre_recuperador: c.nombre_recuperador,
          dias_mora: c.dias_mora,
          bucket: c.bucket,
          saldo_total: c.saldo_total,
          saldo_vencido: c.saldo_vencido,
          pagos_vencidos: c.pagos_vencidos,
          dias_desde_ultimo_pago: c.dias_desde_ultimo_pago,
          alerta: c.alerta,
        }))

        return {
          fecha_corte: resumen.fecha_corte,
          coordinacion: resumen.coordinacion,
          dias_min: resumen.dias_min,
          total_morosos: creditos.length,
          saldo_vencido_total: creditos.reduce((s, c) => s + (c.saldo_vencido ?? 0), 0),
          filas_incluidas: filas.length,
          nota: 'Datos seudonimizados: el detalle con nombre y contacto está en /cartera/mora.',
          creditos: filas,
        }
      },
    }),

    obtenerCohort: tool({
      description:
        'Comparativo de 2 cohortes de la cartera partidas por fecha de inicio de ciclo (antes/desde la fecha frontera): cada una con totales, PAR 8 buckets y PAR>30/90. Equivale a las hojas mensuales del Excel legacy y al dashboard /cartera/cohort.',
      inputSchema: z.object({
        fecha_corte: fechaCorteSchema,
        frontera: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('Fecha frontera YYYY-MM-DD que parte las cohortes (default 2026-04-01)'),
      }),
      execute: async ({ fecha_corte, frontera }) => {
        if (isMockMode()) return mockCohort(fecha_corte, frontera ?? '2026-04-01')
        const { data, error } = await supabase.rpc('cartera_cohort', {
          p_fecha_corte: fecha_corte,
          p_frontera: frontera ?? '2026-04-01',
        })
        if (error) return rpcError('Error en cartera_cohort', error.message)
        return data
      },
    }),
  }
}
