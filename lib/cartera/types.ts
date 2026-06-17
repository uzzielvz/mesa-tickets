export type UploadEstado = 'pendiente' | 'procesando' | 'procesado' | 'error'

export interface CarteraUpload {
  id: string
  fecha_corte: string
  nombre_archivo: string
  drive_file_id: string | null
  storage_path: string | null
  subido_por: string | null
  procesado_por: string | null
  procesado_at: string | null
  estado: UploadEstado
  error_detalle: string | null
  rows_inserted: number | null
  created_at: string
  // Nombres resueltos desde profiles (no son columnas; se rellenan al consultar).
  subido_por_nombre?: string | null
  procesado_por_nombre?: string | null
}
