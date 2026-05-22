import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import UploadForm from '@/components/cartera/upload-form'
import type { CarteraUpload } from '@/lib/cartera/types'

export default async function CargarPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('cartera_uploads')
    .select('id, fecha_corte, nombre_archivo, drive_file_id, subido_por, estado, error_detalle, rows_inserted, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <Header
        title="Cargar reporte"
        subtitle="Sube el Excel de Yunius para procesar la cartera individual."
      />
      <div className="px-5 md:px-9 pb-12">
        <UploadForm uploads={(data ?? []) as CarteraUpload[]} />
      </div>
    </div>
  )
}
