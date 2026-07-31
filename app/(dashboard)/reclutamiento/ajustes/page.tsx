import { createClient } from '@/lib/supabase/server'
import AjustesPanel from '@/components/reclutamiento/ajustes-panel'
import VolverPipeline from '@/components/reclutamiento/volver-pipeline'
import { leerAjustes } from '@/lib/reclutamiento/ajustes'
import { PLANTILLA_CODIGOS } from '@/lib/reclutamiento/plantillas'
import type { PlantillaGuardada } from '@/components/reclutamiento/plantillas-editor'

export const metadata = { title: 'Ajustes — Reclutamiento' }

export default async function AjustesReclutamientoPage() {
  const supabase = createClient()

  const [ajustes, { data: tplData }] = await Promise.all([
    leerAjustes(supabase),
    supabase
      .from('rec_plantillas_correo')
      .select('codigo, asunto, cuerpo, cc_emails')
      .in('codigo', PLANTILLA_CODIGOS),
  ])

  const filas = (tplData ?? []) as {
    codigo: string; asunto: string; cuerpo: string; cc_emails: string[] | null
  }[]
  const plantillas = Object.fromEntries(
    filas.map(t => [t.codigo, { asunto: t.asunto, cuerpo: t.cuerpo, cc_emails: t.cc_emails ?? [] }]),
  ) as Record<string, PlantillaGuardada>

  return (
    <div className="flex flex-col gap-5">
      <VolverPipeline />
      <div>
        <h1 className="text-[18px] font-semibold text-ink-900">Ajustes de Reclutamiento</h1>
        <p className="text-[13px] text-ink-400 mt-0.5">
          Destinatarios y texto de los correos del módulo. Se aplican de inmediato, sin desplegar.
        </p>
      </div>

      <AjustesPanel
        dg={ajustes.dg}
        destinatarios={ajustes.altaDestinatarios}
        plantillas={plantillas}
        factorialSyncActiva={ajustes.factorialSyncActiva}
        faltanAjustes={ajustes.faltanAjustes}
      />
    </div>
  )
}
