import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, FileSearch } from 'lucide-react'
import type { RecEtapa } from '@/lib/supabase/types'
import type { SiguientePaso } from '@/lib/reclutamiento/etapas'

// Tarjeta de "qué hacer ahora". Ya no decide nada: solo renderiza el paso que
// calculó lib/reclutamiento/etapas.ts, el mismo que usa el kanban.
export default function CandidatoGuia({
  etapa,
  paso,
}: {
  etapa: RecEtapa
  paso: SiguientePaso | null
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

  if (!paso) return null

  const Icono = etapa === 'en_revision' ? FileSearch : ArrowRight

  // Solo se ofrece botón cuando el paso lleva a otra pantalla. Las acciones
  // directas y los formularios se ejecutan desde el pipeline, no desde aquí.
  const enlace = paso.accion.tipo === 'redirect' ? paso.accion.href : null
  const mostrarEnlace = enlace != null && !enlace.startsWith('/reclutamiento/candidatos/')

  const prog = paso.progreso
  const completo = prog != null && prog.registradas === prog.total

  return (
    <div className="rounded-md border border-[#ECECEC] bg-surface-sidebar px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icono size={16} className="mt-0.5 shrink-0 text-navy" />
          <div>
            <p className="text-[12.5px] font-medium text-ink-900">{paso.titulo}</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{paso.descripcion}</p>

            {prog && (
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  completo ? 'bg-[#f0fdf4] text-[#15803d]' : 'bg-surface-hover text-ink-600'
                }`}
              >
                {completo && <CheckCircle2 size={12} />}
                {prog.registradas} de {prog.total} evaluaciones registradas
                {completo && ' — listo para comité'}
              </span>
            )}

            {/* Qué impide avanzar y qué conviene revisar antes. */}
            {paso.bloqueos.map(b => (
              <p key={b} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#b91c1c]">
                <AlertTriangle size={12} className="shrink-0" /> {b}
              </p>
            ))}
            {paso.advertencias.map(a => (
              <p key={a} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#a16207]">
                <AlertTriangle size={12} className="shrink-0" /> {a}
              </p>
            ))}
          </div>
        </div>

        {mostrarEnlace && (
          <Link
            href={enlace!}
            className="inline-flex shrink-0 items-center gap-1.5 rounded bg-orange px-3 py-[7px] text-[12px] font-medium text-white transition-colors hover:bg-orange/90"
          >
            <ArrowRight size={13} />
            {paso.titulo}
          </Link>
        )}
      </div>
    </div>
  )
}
