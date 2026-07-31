import { createClient } from '@/lib/supabase/server'
import AjustesPanel from '@/components/reclutamiento/ajustes-panel'
import VolverPipeline from '@/components/reclutamiento/volver-pipeline'
import { leerAjustes } from '@/lib/reclutamiento/ajustes'
import { PLANTILLAS_CC } from '@/lib/schemas/reclutamiento'

export const metadata = { title: 'Ajustes — Reclutamiento' }

export default async function AjustesReclutamientoPage() {
  const supabase = createClient()

  const [ajustes, { data: tplData }] = await Promise.all([
    leerAjustes(supabase),
    supabase
      .from('rec_plantillas_correo')
      .select('codigo, cc_emails')
      .in('codigo', PLANTILLAS_CC.map(p => p.codigo)),
  ])

  const ccPorPlantilla = Object.fromEntries(
    ((tplData ?? []) as { codigo: string; cc_emails: string[] | null }[])
      .map(t => [t.codigo, t.cc_emails ?? []]),
  ) as Record<string, string[]>

  return (
    <div className="flex flex-col gap-5">
      <VolverPipeline />
      <div>
        <h1 className="text-[18px] font-semibold text-ink-900">Ajustes de Reclutamiento</h1>
        <p className="text-[13px] text-ink-400 mt-0.5">
          Destinatarios de los correos del módulo. Se aplican de inmediato, sin desplegar.
        </p>
      </div>

      <AjustesPanel
        dg={ajustes.dg}
        destinatarios={ajustes.altaDestinatarios}
        ccPorPlantilla={ccPorPlantilla}
        faltanAjustes={ajustes.faltanAjustes}
      />
    </div>
  )
}
