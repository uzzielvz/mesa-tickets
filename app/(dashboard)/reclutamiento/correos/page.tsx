import Link from 'next/link'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import VolverPipeline from '@/components/reclutamiento/volver-pipeline'
import { plantillaMeta } from '@/lib/reclutamiento/plantillas'
import type { RecPlantillaCodigo } from '@/lib/supabase/types'

export const metadata = { title: 'Correos enviados — Reclutamiento' }

const LIMITE = 200

interface CorreoRow {
  id: string
  candidato_id: string | null
  plantilla_codigo: RecPlantillaCodigo | null
  to_email: string
  enviado_at: string
  estado: 'enviado' | 'error'
  error: string | null
}

const FILTROS = [
  { valor: '', label: 'Todos' },
  { valor: 'error', label: 'Con error' },
  { valor: 'enviado', label: 'Enviados' },
] as const

function fechaHora(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

export default async function CorreosPage({
  searchParams,
}: {
  searchParams: { estado?: string }
}) {
  const supabase = createClient()
  const estado = searchParams.estado === 'error' || searchParams.estado === 'enviado'
    ? searchParams.estado
    : null

  let query = supabase
    .from('rec_correos_enviados')
    .select('id, candidato_id, plantilla_codigo, to_email, enviado_at, estado, error')
    .order('enviado_at', { ascending: false })
    .limit(LIMITE)
  if (estado) query = query.eq('estado', estado)

  const { data } = await query
  const correos = (data ?? []) as CorreoRow[]

  // El nombre del candidato en una segunda consulta: la FK no está declarada en
  // los tipos generados, así que un join anidado no compilaría.
  const ids = Array.from(new Set(correos.map(c => c.candidato_id).filter(Boolean))) as string[]
  let nombres: Record<string, string> = {}
  if (ids.length) {
    const { data: cands } = await supabase.from('rec_candidatos').select('id, nombre').in('id', ids)
    nombres = Object.fromEntries(((cands ?? []) as { id: string; nombre: string }[]).map(c => [c.id, c.nombre]))
  }

  const fallidos = correos.filter(c => c.estado === 'error').length

  return (
    <div className="flex flex-col gap-5">
      <VolverPipeline />
      <div>
        <h1 className="text-[18px] font-semibold text-ink-900">Correos enviados</h1>
        <p className="text-[13px] text-ink-400 mt-0.5">
          Bitácora de todo lo que el módulo mandó por Gmail. Últimos {LIMITE} registros
          {estado === null && fallidos > 0 && `, ${fallidos} con error`}.
        </p>
      </div>

      <div className="flex gap-1.5">
        {FILTROS.map(f => {
          const activo = (estado ?? '') === f.valor
          return (
            <Link
              key={f.valor}
              href={f.valor ? `/reclutamiento/correos?estado=${f.valor}` : '/reclutamiento/correos'}
              className={`text-[12px] font-medium rounded px-3 py-[5px] border transition-colors ${
                activo
                  ? 'border-orange bg-orange/10 text-orange-dark'
                  : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {correos.length === 0 ? (
        <p className="text-[13px] text-ink-400 py-10 text-center">
          {estado ? 'No hay correos con ese estado.' : 'Todavía no se ha enviado ningún correo.'}
        </p>
      ) : (
        <div className="border border-[#ECECEC] rounded-md overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[#ECECEC] text-left text-[11px] uppercase tracking-[0.4px] text-ink-400">
                <th className="font-semibold px-3 py-2 whitespace-nowrap">Fecha</th>
                <th className="font-semibold px-3 py-2">Correo</th>
                <th className="font-semibold px-3 py-2">Destinatario</th>
                <th className="font-semibold px-3 py-2">Candidato</th>
                <th className="font-semibold px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F4]">
              {correos.map(c => (
                <tr key={c.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-ink-500">{fechaHora(c.enviado_at)}</td>
                  <td className="px-3 py-2 text-ink-700">
                    {(c.plantilla_codigo && plantillaMeta(c.plantilla_codigo)?.label) ?? c.plantilla_codigo ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-ink-700 break-all">{c.to_email}</td>
                  <td className="px-3 py-2 text-ink-700">
                    {c.candidato_id
                      ? (
                        <Link
                          href={`/reclutamiento/candidatos/${c.candidato_id}/editar`}
                          className="text-navy hover:underline"
                        >
                          {nombres[c.candidato_id] ?? 'Ver candidato'}
                        </Link>
                      )
                      : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {c.estado === 'enviado' ? (
                      <span className="inline-flex items-center gap-1 text-[#15803d]">
                        <CheckCircle2 size={12} /> Enviado
                      </span>
                    ) : (
                      <span className="inline-flex items-start gap-1 text-[#b91c1c]" title={c.error ?? undefined}>
                        <AlertCircle size={12} className="mt-[2px] shrink-0" />
                        <span className="line-clamp-2">{c.error ?? 'Error'}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
