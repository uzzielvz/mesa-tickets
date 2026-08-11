import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import type { TicketWithStatus } from '@/lib/supabase/types'

export default async function MetricasPage() {
  const supabase = createClient()

  const { data: rawTickets } = await supabase.from('tickets_with_status').select('*')
  const tickets = (rawTickets ?? []) as unknown as TicketWithStatus[]

  const { data: areas } = await supabase.from('areas').select('id, nombre').eq('activo', true)

  const total = tickets.length
  // 'Sin tomar' es el número que de verdad exige acción: nadie los ha
  // reclamado de la cola de su área.
  const sinTomar = tickets.filter(t => t.responsable_id === null && t.status === 'abierto').length
  const enCurso = tickets.filter(
    t => t.status === 'en_revision' || t.status === 'programado',
  ).length
  const resueltos = tickets.filter(t => t.status === 'resuelto').length
  const cerrados = tickets.filter(t => t.status === 'cerrado').length

  // Tickets por área
  const porArea = (areas ?? []).map(area => ({
    nombre: area.nombre,
    total: tickets.filter(t => t.area_nombre === area.nombre).length,
    sinTomar: tickets.filter(
      t => t.area_nombre === area.nombre && t.responsable_id === null && t.status === 'abierto',
    ).length,
    cerrados: tickets.filter(t => t.area_nombre === area.nombre && t.status === 'cerrado').length,
  }))

  return (
    <div>
      <Header title="Métricas" subtitle="Volumen y actividad del sistema." />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-8">
        {/* Resumen global */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Resumen global</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: total },
              { label: 'Sin tomar', value: sinTomar },
              { label: 'En curso', value: enCurso },
              { label: 'Resueltos', value: resueltos },
              { label: 'Cerrados', value: cerrados },
            ].map(s => (
              <div key={s.label} className="border border-[#ECECEC] rounded-md px-5 py-4">
                <span className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium block mb-1">{s.label}</span>
                <span className="text-[28px] font-semibold text-navy tracking-tight leading-none">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Por área */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">Por área</p>
          <div className="border border-[#ECECEC] rounded-md overflow-hidden">
            <div className="hidden md:grid grid-cols-4 px-5 py-2 border-b border-[#ECECEC] bg-surface-sidebar">
              {['Área', 'Total', 'Sin tomar', 'Cerrados'].map(h => (
                <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
              ))}
            </div>
            {porArea.map((area, i) => (
              <div
                key={area.nombre}
                className={`grid grid-cols-2 md:grid-cols-4 px-5 py-3 ${i < porArea.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
              >
                <span className="text-[13px] font-medium text-ink-900">{area.nombre}</span>
                <span className="text-[13px] text-ink-700">{area.total}</span>
                <span className="text-[13px] text-ink-700">{area.sinTomar}</span>
                <span className="text-[13px] text-ink-700">{area.cerrados}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
