import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { construirCsv, cabecerasCsv } from '@/lib/utils/csv'
import {
  COLUMNAS_CANDIDATOS, nombreArchivo, type CandidatoExport,
} from '@/lib/reclutamiento/exportar'
import { ETAPAS } from '@/lib/schemas/reclutamiento'
import type { RecEtapa } from '@/lib/supabase/types'

export const runtime = 'nodejs'

// Tope de seguridad, no de producto: hoy una vacante trae decenas de candidatos.
// Existe para que un error no intente materializar la tabla entera en memoria.
const MAX_FILAS = 5000

/**
 * CSV de los candidatos de una vacante.
 *
 * ⚠ Este archivo lleva nombre, correo y teléfono de personas que en su mayoría
 * NO fueron contratadas, a un archivo fuera de la plataforma donde ya no aplica
 * ninguna RLS. Por eso:
 *   - el permiso se revalida aquí, no se hereda de la pantalla;
 *   - la exportación se registra en `rec_exportaciones` ANTES de entregar el
 *     archivo, y si no se puede registrar, no se entrega.
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_reclutamiento')
    .eq('id', user.id)
    .single()

  const perfil = profile as { rol?: string; acceso_reclutamiento?: boolean } | null
  const puede = perfil?.rol === 'admin' || perfil?.acceso_reclutamiento === true
  if (!puede) return NextResponse.json({ error: 'Sin acceso a Reclutamiento' }, { status: 403 })

  const url = new URL(request.url)
  const vacante = url.searchParams.get('vacante')
  const etapaParam = url.searchParams.get('etapa')
  // Solo se acepta una etapa del catálogo: lo que venga en el query no entra
  // crudo a la consulta.
  const etapa: RecEtapa | null = ETAPAS.includes(etapaParam as RecEtapa)
    ? (etapaParam as RecEtapa)
    : null

  if (!vacante) {
    return NextResponse.json({ error: 'Falta la vacante' }, { status: 400 })
  }

  let query = supabase
    .from('rec_candidatos')
    .select('nombre, email, telefono, fuente, etapa, revision_cv, motivo_descarte, cv_storage_path, etapa_actualizada_at, created_at')
    .eq('vacante_id', vacante)
    .order('created_at', { ascending: false })
    .limit(MAX_FILAS)
  if (etapa) query = query.eq('etapa', etapa)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'No se pudieron leer los candidatos' }, { status: 500 })
  }

  const filas = (data ?? []) as unknown as CandidatoExport[]

  // El registro va ANTES de entregar el archivo, y falla cerrado: si no se puede
  // dejar rastro de quién se llevó los datos, no se entregan los datos.
  const { error: errorBitacora } = await supabase
    .from('rec_exportaciones')
    .insert({
      recurso: 'candidatos',
      filtros: { vacante, etapa },
      filas: filas.length,
      exportado_por: user.id,
    })

  if (errorBitacora) {
    return NextResponse.json(
      { error: 'No se pudo registrar la exportación; el archivo no se generó.' },
      { status: 500 },
    )
  }

  return new NextResponse(construirCsv(COLUMNAS_CANDIDATOS, filas), {
    headers: cabecerasCsv(nombreArchivo('candidatos')),
  })
}
