import Link from 'next/link'
import { ArrowRight, CalendarClock, ClipboardCheck, FileSearch, CheckCircle2 } from 'lucide-react'
import type { RecEtapa } from '@/lib/supabase/types'

interface Guia {
  titulo: string
  descripcion: string
  accion?: { label: string; href: string; icon: typeof ArrowRight }
}

// Qué hacer en cada etapa: un paso claro y (cuando aplica) el botón que lleva a
// la acción correcta. La contratación NO se hace desde aquí: vive en Comité,
// que es donde se disparan los correos.
function guiaDe(etapa: RecEtapa, vacanteId: string): Guia | null {
  const comite = `/reclutamiento/comite?vacante=${vacanteId}`
  const agendar = `/reclutamiento/agendar?vacante=${vacanteId}`
  switch (etapa) {
    case 'en_revision':
      return {
        titulo: 'Revisa el CV',
        descripcion: 'Define la viabilidad del candidato en el formulario de abajo. Si es viable, el siguiente paso es agendar sus entrevistas.',
      }
    case 'viable':
      return {
        titulo: 'Agenda las entrevistas',
        descripcion: 'Este candidato pasó el filtro. Agenda la sesión de entrevistas y se enviarán las invitaciones con la liga de Meet.',
        accion: { label: 'Agendar entrevistas', href: agendar, icon: CalendarClock },
      }
    case 'entrevistas_agendadas':
      return {
        titulo: 'En espera de evaluaciones',
        descripcion: 'Los entrevistadores registran su evaluación por su liga. Cuando estén listas, revisa la decisión en Comité.',
        accion: { label: 'Ir a Comité', href: comite, icon: ClipboardCheck },
      }
    case 'comite':
      return {
        titulo: 'Decisión del comité',
        descripcion: 'Revisa las evaluaciones, deja las notas del comité y decide: pasar a entrevista final con la DG, contratar o descartar.',
        accion: { label: 'Abrir en Comité', href: comite, icon: ClipboardCheck },
      }
    case 'final_dg':
      return {
        titulo: 'Entrevista final con la DG',
        descripcion: 'El candidato está en la entrevista final con Dirección General. Al confirmar, continúa a la configuración del alta.',
        accion: { label: 'Abrir en Comité', href: comite, icon: ClipboardCheck },
      }
    case 'oferta':
      return {
        titulo: 'Configura el alta y contrata',
        descripcion: 'Último paso: confirma la contratación desde Comité. Ahí se envían el correo de bienvenida al candidato y las altas a los responsables.',
        accion: { label: 'Abrir en Comité', href: comite, icon: ClipboardCheck },
      }
    default:
      return null
  }
}

// Tarjeta de "qué hacer ahora": traduce la etapa actual en un paso claro con su
// botón. En etapas terminales (contratado / descartado) no se muestra.
export default function CandidatoGuia({
  etapa,
  vacanteId,
}: {
  etapa: RecEtapa
  vacanteId: string
}) {
  if (etapa === 'contratado') {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#15803d]" />
        <div>
          <p className="text-[12.5px] font-medium text-[#15803d]">Candidato contratado</p>
          <p className="text-[11.5px] text-[#15803d]/80">El flujo de reclutamiento terminó para este candidato.</p>
        </div>
      </div>
    )
  }

  const guia = guiaDe(etapa, vacanteId)
  if (!guia) return null

  const Icono = etapa === 'en_revision' ? FileSearch : ArrowRight

  return (
    <div className="rounded-md border border-[#ECECEC] bg-surface-sidebar px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icono size={16} className="mt-0.5 shrink-0 text-navy" />
          <div>
            <p className="text-[12.5px] font-medium text-ink-900">{guia.titulo}</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{guia.descripcion}</p>
          </div>
        </div>
        {guia.accion && (
          <Link
            href={guia.accion.href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded bg-orange px-3 py-[7px] text-[12px] font-medium text-white transition-colors hover:bg-orange/90"
          >
            <guia.accion.icon size={13} />
            {guia.accion.label}
          </Link>
        )}
      </div>
    </div>
  )
}
