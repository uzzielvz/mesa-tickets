import type { createClient } from '@/lib/supabase/server'
import type { CarteraUpload } from './types'

type SupabaseServerClient = ReturnType<typeof createClient>

/**
 * Lee las cargas más recientes y resuelve los nombres de quién subió y quién
 * procesó cada reporte. Los campos subido_por/procesado_por apuntan a
 * auth.users; los nombres viven en profiles, así que se resuelven aparte.
 */
export async function obtenerUploadsRecientes(
  supabase: SupabaseServerClient,
  limite = 10,
): Promise<CarteraUpload[]> {
  const { data } = await supabase
    .from('cartera_uploads')
    .select(
      'id, fecha_corte, nombre_archivo, drive_file_id, storage_path, subido_por, procesado_por, procesado_at, estado, error_detalle, rows_inserted, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limite)

  const uploads = (data ?? []) as CarteraUpload[]

  const ids = Array.from(
    new Set(uploads.flatMap(u => [u.subido_por, u.procesado_por]).filter(Boolean)),
  ) as string[]
  if (ids.length === 0) return uploads

  const { data: perfiles } = await supabase
    .from('profiles')
    .select('id, nombre_completo')
    .in('id', ids)

  const nombrePorId = new Map((perfiles ?? []).map(p => [p.id, p.nombre_completo]))
  return uploads.map(u => ({
    ...u,
    subido_por_nombre: u.subido_por ? nombrePorId.get(u.subido_por) ?? null : null,
    procesado_por_nombre: u.procesado_por ? nombrePorId.get(u.procesado_por) ?? null : null,
  }))
}
