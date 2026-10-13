// Lo que consultan la página de reportes, el Excel de seguimiento y el informe
// ejecutivo (VAC-009): los tres dicen lo mismo porque leen lo mismo. Servidor.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { sumarDias } from './calendario'
import {
  agruparAusencias, aniversariosProximos, fueraPorSemana, resumirTiempos, semanasDesde,
  type Agrupar, type Calendario, type TiempoSolicitud,
} from './seguimiento'
import type { SaldoEmpleado } from './tipos'

export const DIAS_ANIVERSARIO = 60
export const DIAS_TIEMPOS = 90

export async function cargarSeguimiento(
  supabase: SupabaseClient<Database>,
  hoy: string,
  nSemanas: number,
  agrupar: Agrupar = 'jefe',
) {
  const semanas = semanasDesde(hoy, nSemanas)
  const [cal, sal, tie] = await Promise.all([
    supabase.rpc('vac_calendario', { p_desde: semanas[0].inicio, p_hasta: semanas[semanas.length - 1].fin }),
    supabase.rpc('vac_saldos', {}),
    supabase.rpc('vac_tiempos', { p_desde: sumarDias(hoy, -DIAS_TIEMPOS), p_hasta: hoy }),
  ])

  const calendario = (cal.data as unknown as Calendario | null) ?? { ausencias: [], festivos: [] }
  const saldos = (sal.data as unknown as SaldoEmpleado[] | null) ?? []
  const tiempos = (tie.data as unknown as TiempoSolicitud[] | null) ?? []
  const festivos = new Set(calendario.festivos.map(f => f.fecha))
  const activos = saldos.filter(e => e.activo)

  return {
    error: cal.error ?? sal.error ?? tie.error,
    hoy,
    semanas,
    calendario,
    saldos,
    tiempos,
    grupos: agruparAusencias(calendario.ausencias, agrupar),
    porSemana: fueraPorSemana(calendario.ausencias, semanas, festivos),
    personasFuera: new Set(calendario.ausencias.map(a => a.empleado_id)).size,
    aniversarios: aniversariosProximos(saldos, hoy, DIAS_ANIVERSARIO),
    resumen: resumirTiempos(tiempos),
    totales: {
      activos: activos.length,
      conDerecho: activos.filter(e => e.anios >= 1).length,
      porTomar: activos.reduce((a, e) => a + Math.max(Number(e.restantes_total), 0), 0),
      enTramite: activos.reduce((a, e) => a + Number(e.dias_en_tramite ?? 0), 0),
    },
  }
}

export type Seguimiento = Awaited<ReturnType<typeof cargarSeguimiento>>
