import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import UploadForm from '@/components/cartera/upload-form'
import { obtenerUploadsRecientes } from '@/lib/cartera/uploads'

export default async function CargarPage() {
  const supabase = createClient()
  const uploads = await obtenerUploadsRecientes(supabase)

  return (
    <div>
      <Header
        title="Cargar reporte"
        subtitle="Sube el Excel de Yunius para procesar la cartera individual."
      />
      <div className="px-5 md:px-9 pb-12">
        <UploadForm uploads={uploads} />
      </div>
    </div>
  )
}
