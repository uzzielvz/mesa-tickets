// Lectura de los ajustes del módulo de Reclutamiento (tabla rec_ajustes, REC-067).
//
// Recibe el cliente de Supabase por parámetro (mismo patrón que enviarCorreoAltas
// en lib/actions/comite.ts) para poder importarse igual desde Server Components y
// desde Server Actions sin arrastrar 'use server'.
//
// Regla: NUNCA devuelve correos de fallback. Si falta la configuración, marca
// `faltanAjustes` y las acciones que la necesiten fallan con un mensaje claro.
// Un fallback silencioso volvería a mandar correos a direcciones que el usuario
// creía haber cambiado — que es justo el problema que S7.5 vino a resolver.

import type { createClient } from '@/lib/supabase/server'
import { DESTINATARIOS_ROLES, type DestinatarioRol } from '@/lib/schemas/reclutamiento'

export interface AjustesDg {
  email: string
  nombre: string
  duracion_min: number
}

export type AjustesDestinatarios = Record<DestinatarioRol, string>

export interface AjustesReclutamiento {
  dg: AjustesDg
  altaDestinatarios: AjustesDestinatarios
  /** true si falta alguna fila o el correo de la DG está vacío */
  faltanAjustes: boolean
}

const DG_VACIO: AjustesDg = { email: '', nombre: '', duracion_min: 30 }

const DESTINATARIOS_VACIOS = Object.fromEntries(
  DESTINATARIOS_ROLES.map(r => [r.key, '']),
) as AjustesDestinatarios

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function leerAjustes(
  supabase: ReturnType<typeof createClient>,
): Promise<AjustesReclutamiento> {
  const { data } = await supabase.from('rec_ajustes').select('clave, valor')
  const filas = (data ?? []) as { clave: string; valor: Record<string, unknown> }[]
  const porClave = new Map(filas.map(f => [f.clave, f.valor ?? {}]))

  const dgRaw = porClave.get('dg')
  const dg: AjustesDg = dgRaw
    ? {
        email: texto(dgRaw.email),
        nombre: texto(dgRaw.nombre),
        duracion_min: Number(dgRaw.duracion_min) > 0 ? Number(dgRaw.duracion_min) : 30,
      }
    : DG_VACIO

  const destRaw = porClave.get('alta_destinatarios')
  const altaDestinatarios = destRaw
    ? (Object.fromEntries(
        DESTINATARIOS_ROLES.map(r => [r.key, texto(destRaw[r.key])]),
      ) as AjustesDestinatarios)
    : DESTINATARIOS_VACIOS

  return {
    dg,
    altaDestinatarios,
    faltanAjustes: !dgRaw || !destRaw || !dg.email,
  }
}
