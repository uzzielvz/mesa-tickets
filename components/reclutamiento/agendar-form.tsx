'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock, CheckCircle2, Link2, Mail, RefreshCw, XCircle } from 'lucide-react'
import { agendarSesion, type ResultadoCandidato } from '@/lib/actions/agendamiento'
import { calcularCascada, ENTREVISTADORES_DEFAULT } from '@/lib/schemas/reclutamiento'
import type { CandidatoViable } from '@/app/(dashboard)/reclutamiento/agendar/page'

interface Vacante {
  id: string
  titulo: string
  estado: 'abierta' | 'cerrada'
}

const GOOGLE_ERROR_MSG: Record<string, string> = {
  estado_invalido: 'La autorización de Google expiró o fue inválida. Intenta conectar de nuevo.',
  sin_refresh_token: 'Google no entregó el token. Vuelve a conectar y acepta todos los permisos.',
  guardado: 'No se pudo guardar la credencial de Google. Intenta de nuevo.',
  intercambio: 'Falló el intercambio con Google. Intenta de nuevo.',
}

const inputClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'
const labelClass = 'text-[11.5px] font-medium text-ink-500'

export default function AgendarForm({
  vacantes,
  vacanteId,
  candidatos,
  googleConectado,
  googleQuery,
  googleError,
}: {
  vacantes: Vacante[]
  vacanteId: string | null
  candidatos: CandidatoViable[]
  googleConectado: boolean
  googleQuery: string | null
  googleError: string | null
}) {
  const router = useRouter()
  // Orden de selección = lugar en la cascada.
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [fecha, setFecha] = useState('')
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [conPausa, setConPausa] = useState(false)
  const [pausaDespuesDe, setPausaDespuesDe] = useState(2)
  const [pausaMinutos, setPausaMinutos] = useState(20)
  const [entrevistadores, setEntrevistadores] = useState(
    ENTREVISTADORES_DEFAULT.map(e => ({ ...e })),
  )
  const [enviando, setEnviando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoCandidato[] | null>(null)
  const [agendaEnviada, setAgendaEnviada] = useState(false)

  const cascada = useMemo(() => {
    if (!/^\d{2}:\d{2}$/.test(horaInicio) || seleccion.length === 0) return []
    return calcularCascada({
      horaInicio,
      numCandidatos: seleccion.length,
      numEntrevistadores: entrevistadores.length,
      pausaDespuesDe: conPausa ? pausaDespuesDe : null,
      pausaMinutos: conPausa ? pausaMinutos : null,
    })
  }, [horaInicio, seleccion.length, entrevistadores.length, conPausa, pausaDespuesDe, pausaMinutos])

  function toggle(id: string) {
    setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function setEntrevistador(i: number, campo: 'nombre' | 'email', valor: string) {
    setEntrevistadores(prev => prev.map((e, idx) => idx === i ? { ...e, [campo]: valor } : e))
  }

  async function enviar() {
    if (!vacanteId) return
    setEnviando(true)
    setResultados(null)
    const res = await agendarSesion({
      vacante_id: vacanteId,
      candidato_ids: seleccion,
      fecha,
      hora_inicio: horaInicio,
      pausa_despues_de: conPausa ? pausaDespuesDe : null,
      pausa_minutos: conPausa ? pausaMinutos : null,
      entrevistadores,
    })
    setEnviando(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setResultados(res.resultados)
    setAgendaEnviada(res.agendaEnviada)
    const okCount = res.resultados.filter(r => r.evento && r.correo).length
    if (okCount === res.resultados.length) {
      toast.success('Entrevistas agendadas y correos enviados.')
    } else {
      toast.warning('Agendamiento con incidencias; revisa el detalle.')
    }
    router.refresh()
  }

  const nombrePorId = useMemo(
    () => new Map(candidatos.map(c => [c.id, c.nombre])),
    [candidatos],
  )

  // ── Resultado post-envío ──
  if (resultados) {
    return (
      <div className="flex flex-col gap-4 max-w-[720px]">
        <div className="bg-white border border-[#ECECEC] rounded-md p-4 flex flex-col gap-3">
          <h2 className="text-[14px] font-semibold text-ink-900">Resultado del agendamiento</h2>
          {resultados.map(r => (
            <div key={r.candidatoId} className="flex flex-col gap-1 border-b border-border-subtle last:border-b-0 pb-2.5 last:pb-0">
              <div className="flex items-center gap-2">
                {r.evento && r.correo
                  ? <CheckCircle2 size={14} className="text-[#15803d]" />
                  : <XCircle size={14} className="text-[#b91c1c]" />}
                <span className="text-[13px] font-medium text-ink-900">{r.nombre}</span>
                <span className="text-[12px] text-ink-400">{r.horario}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pl-6 text-[11.5px] text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={11} /> Evento: {r.evento ? 'creado' : 'falló'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mail size={11} /> Correo: {r.correo ? 'enviado' : 'falló'}
                </span>
                {r.meetUrl && (
                  <a href={r.meetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-navy hover:underline">
                    <Link2 size={11} /> Meet
                  </a>
                )}
              </div>
              {r.error && <p className="pl-6 text-[11px] text-[#b91c1c]">{r.error}</p>}
            </div>
          ))}
          <p className="text-[12px] text-ink-500">
            Agenda a entrevistadores: {agendaEnviada ? 'enviada' : 'no enviada'}.
          </p>
        </div>
        <button
          onClick={() => { setResultados(null); setSeleccion([]) }}
          className="self-start text-[12.5px] font-medium text-navy border border-[#ECECEC] rounded px-4 py-[7px] hover:bg-surface-hover transition-colors"
        >
          Agendar otra sesión
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      {/* ── Estado de la cuenta de Google ── */}
      {googleError && (
        <div className="bg-[#fee2e2] border border-[#fecaca] rounded-md px-4 py-3 text-[12.5px] text-[#b91c1c]">
          {GOOGLE_ERROR_MSG[googleError] ?? 'Error al conectar Google.'}
        </div>
      )}
      {googleQuery === 'conectado' && (
        <div className="bg-[#dcfce7] border border-[#bbf7d0] rounded-md px-4 py-3 text-[12.5px] text-[#15803d]">
          Cuenta de Google conectada correctamente.
        </div>
      )}
      <div className="bg-white border border-[#ECECEC] rounded-md px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${googleConectado ? 'bg-[#15803d]' : 'bg-[#b91c1c]'}`} />
          <span className="text-[12.5px] text-ink-700">
            {googleConectado
              ? 'Cuenta emisora de Google conectada (Calendar + Gmail).'
              : 'Sin cuenta de Google conectada. Conéctala para poder agendar y enviar correos.'}
          </span>
        </div>
        <a
          href="/api/google/conectar"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-navy border border-[#ECECEC] rounded px-3 py-[5px] hover:bg-surface-hover transition-colors whitespace-nowrap"
        >
          <RefreshCw size={12} />
          {googleConectado ? 'Reconectar' : 'Conectar Google'}
        </a>
      </div>

      {/* ── Vacante y candidatos ── */}
      <div className="bg-white border border-[#ECECEC] rounded-md p-4 flex flex-col gap-3">
        <label className={labelClass}>Vacante</label>
        <select
          value={vacanteId ?? ''}
          onChange={e => { setSeleccion([]); router.push(`/reclutamiento/agendar?vacante=${e.target.value}`) }}
          className={inputClass}
        >
          {vacantes.map(v => (
            <option key={v.id} value={v.id}>
              {v.titulo}{v.estado === 'cerrada' ? ' (cerrada)' : ''}
            </option>
          ))}
        </select>

        <label className={labelClass}>
          Candidatos viables ({seleccion.length} seleccionado{seleccion.length !== 1 ? 's' : ''} — el orden de selección define el turno)
        </label>
        {candidatos.length === 0 ? (
          <p className="text-[12.5px] text-ink-400">
            No hay candidatos en etapa Viable para esta vacante. Muévelos desde el pipeline.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {candidatos.map(c => {
              const pos = seleccion.indexOf(c.id)
              return (
                <label key={c.id} className="flex items-center gap-2.5 text-[12.5px] text-ink-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pos >= 0}
                    onChange={() => toggle(c.id)}
                    disabled={!c.email}
                    className="accent-[#1e3a5f]"
                  />
                  <span className={c.email ? '' : 'text-ink-300'}>
                    {c.nombre}
                    <span className="text-ink-400"> · {c.email ?? 'sin correo'}</span>
                  </span>
                  {pos >= 0 && (
                    <span className="text-[10.5px] text-orange font-medium">#{pos + 1}</span>
                  )}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Parámetros de la sesión ── */}
      <div className="bg-white border border-[#ECECEC] rounded-md p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 max-w-[400px]">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Hora de inicio</label>
            <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className={inputClass} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[12.5px] text-ink-700 cursor-pointer">
          <input type="checkbox" checked={conPausa} onChange={e => setConPausa(e.target.checked)} className="accent-[#1e3a5f]" />
          Agregar pausa entre candidatos
        </label>
        {conPausa && (
          <div className="grid grid-cols-2 gap-3 max-w-[400px]">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Después del candidato #</label>
              <input
                type="number" min={1} max={Math.max(seleccion.length, 1)}
                value={pausaDespuesDe}
                onChange={e => setPausaDespuesDe(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Minutos de pausa</label>
              <input
                type="number" min={5} max={120} step={5}
                value={pausaMinutos}
                onChange={e => setPausaMinutos(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Entrevistadores (rotación en ese orden) ── */}
      <div className="bg-white border border-[#ECECEC] rounded-md p-4 flex flex-col gap-3">
        <label className={labelClass}>Entrevistadores (rotan en este orden, bloques de 20 min)</label>
        {entrevistadores.map((e, i) => (
          <div key={i} className="grid grid-cols-[24px_1fr_1.4fr] gap-2 items-center">
            <span className="text-[11.5px] text-ink-400">{i + 1}.</span>
            <input
              value={e.nombre}
              onChange={ev => setEntrevistador(i, 'nombre', ev.target.value)}
              placeholder="Nombre"
              className={inputClass}
            />
            <input
              value={e.email}
              onChange={ev => setEntrevistador(i, 'email', ev.target.value)}
              placeholder="correo@financieracrediflexi.com"
              className={inputClass}
            />
          </div>
        ))}
      </div>

      {/* ── Preview de la cascada ── */}
      {cascada.length > 0 && (
        <div className="bg-white border border-[#ECECEC] rounded-md p-4 flex flex-col gap-2">
          <label className={labelClass}>Vista previa de la cascada</label>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-ink-400">
                  <th className="py-1.5 pr-3 font-medium">Candidato</th>
                  <th className="py-1.5 pr-3 font-medium">Horario</th>
                  <th className="py-1.5 pr-3 font-medium">{entrevistadores[0].nombre || 'Entrevistador 1'}</th>
                  <th className="py-1.5 pr-3 font-medium">{entrevistadores[1].nombre || 'Entrevistador 2'}</th>
                  <th className="py-1.5 font-medium">{entrevistadores[2].nombre || 'Entrevistador 3'}</th>
                </tr>
              </thead>
              <tbody>
                {cascada.map((b, i) => (
                  <tr key={i} className="border-t border-border-subtle text-ink-700">
                    <td className="py-1.5 pr-3">{nombrePorId.get(seleccion[i]) ?? `#${i + 1}`}</td>
                    <td className="py-1.5 pr-3 font-medium text-ink-900">{b.inicio}–{b.fin}</td>
                    <td className="py-1.5 pr-3">{b.bloques[0]}</td>
                    <td className="py-1.5 pr-3">{b.bloques[1]}</td>
                    <td className="py-1.5">{b.bloques[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={enviar}
        disabled={
          enviando || !googleConectado || !vacanteId || seleccion.length === 0 ||
          !fecha || !/^\d{2}:\d{2}$/.test(horaInicio) ||
          entrevistadores.some(e => !e.nombre.trim() || !e.email.includes('@'))
        }
        className="self-start bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-5 py-[8px] transition-colors disabled:opacity-50"
      >
        {enviando ? 'Agendando y enviando correos…' : 'Agendar y enviar correos'}
      </button>
    </div>
  )
}
