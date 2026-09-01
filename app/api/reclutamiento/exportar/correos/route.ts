import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { construirCsv, cabecerasCsv } from '@/lib/utils/csv'
import {
  COLUMNAS_CORREOS, nombreArchivo, type CorreoExport,
} from '@/lib/reclutamiento/exportar'

export const runtime = 'nodejs'

// La pantalla muestra los últimos 200; el CSV saca bastante más a propósito.
// Quien exporta la bitácora normalmente está diagnosticando por qué un correo no
// llegó, y ahí 200 registros se acaban rápido.
const MAX_FILAS = 5000

/**
 * CSV de la bitácora de correos.
 *
 * A diferencia del CSV de candidatos, aquí no hay datos de candidatos más allá
 * del nombre y el correo al que se les escribió — pero es igualmente material
 * interno, así que se aplica el mismo criterio: permiso revalidado y registro en
 * `rec_exportaciones` antes de entregar.
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
  const estadoParam = url.searchParams.get('estado')
  const estado = estadoParam === 'error' || estadoParam === 'enviado' ? estadoParam : null

  let query = supabase
    .from('rec_correos_enviados')
    .select('candidato_id, plantilla_codigo, to_email, enviado_at, estado, error')
    .order('enviado_at', { ascending: false })
    .limit(MAX_FILAS)
  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'No se pudo leer la bitácora' }, { status: 500 })
  }

  // La fila tal como viene de la base: trae `candidato_id`, no el nombre.
  interface FilaCorreo extends Omit<CorreoExport, 'candidato_nombre'> {
    candidato_id: string | null
  }
  const correos = (data ?? []) as unknown as FilaCorreo[]

  // El nombre del candidato en una segunda consulta: la FK no está declarada en
  // los tipos generados, así que un join anidado no compilaría. Mismo enfoque
  // que la pantalla de /reclutamiento/correos.
  const ids = Array.from(new Set(correos.map(c => c.candidato_id).filter(Boolean))) as string[]
  let nombres: Record<string, string> = {}
  if (ids.length) {
    const { data: cands } = await supabase
      .from('rec_candidatos')
      .select('id, nombre')
      .in('id', ids)
    nombres = Object.fromEntries(
      ((cands ?? []) as { id: string; nombre: string }[]).map(c => [c.id, c.nombre]),
    )
  }

  const filas: CorreoExport[] = correos.map(c => ({
    ...c,
    candidato_nombre: c.candidato_id ? nombres[c.candidato_id] ?? null : null,
  }))

  const { error: errorBitacora } = await supabase
    .from('rec_exportaciones')
    .insert({
      recurso: 'correos',
      filtros: { estado },
      filas: filas.length,
      exportado_por: user.id,
    })

  if (errorBitacora) {
    return NextResponse.json(
      { error: 'No se pudo registrar la exportación; el archivo no se generó.' },
      { status: 500 },
    )
  }

  return new NextResponse(construirCsv(COLUMNAS_CORREOS, filas), {
    headers: cabecerasCsv(nombreArchivo('correos')),
  })
}
