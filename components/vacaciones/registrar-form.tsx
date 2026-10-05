'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Printer, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { diasHabiles, fechaRegreso, festivosEntre, fechaCorta } from '@/lib/vacaciones/calendario'
import { periodoSugerido, type PeriodoVacaciones } from '@/lib/vacaciones/tipos'

const campo =
  'w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-colors'
const etiqueta = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium'

/**
 * Registro de días por Gente y Cultura. Los días hábiles y la fecha de regreso
 * se calculan solos (lunes a viernes, sin festivos de ley), pero se pueden
 * corregir: la base histórica tiene casos que no encajan en la regla y RH es
 * quien sabe.
 *
 * Al guardar queda listo el formato prellenado para imprimir y firmar.
 */
export default function RegistrarDias({
  empleadoId,
  periodos,
}: {
  empleadoId: string
  periodos: PeriodoVacaciones[]
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<'vacaciones' | 'flotante'>(periodos.length > 0 ? 'vacaciones' : 'flotante')
  const [periodo, setPeriodo] = useState<number | null>(periodoSugerido(periodos))
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [diasManual, setDiasManual] = useState<string | null>(null)
  const [regresoManual, setRegresoManual] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [registrado, setRegistrado] = useState<string | null>(null)

  const finEfectivo = fin || inicio
  const diasCalculados = useMemo(() => (inicio ? diasHabiles(inicio, finEfectivo) : 0), [inicio, finEfectivo])
  const regresoCalculado = useMemo(() => (finEfectivo ? fechaRegreso(finEfectivo) : ''), [finEfectivo])
  const festivos = useMemo(() => (inicio ? festivosEntre(inicio, finEfectivo) : []), [inicio, finEfectivo])

  const dias = diasManual !== null ? Number(diasManual) : diasCalculados
  const regreso = regresoManual ?? regresoCalculado
  const elegido = periodos.find(p => p.periodo === periodo)
  const quedarian = tipo === 'vacaciones' && elegido ? elegido.restantes - dias : null

  function limpiar() {
    setInicio(''); setFin(''); setDiasManual(null); setRegresoManual(null); setObservaciones('')
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!inicio) { toast.error('Falta la fecha de inicio.'); return }
    if (finEfectivo < inicio) { toast.error('La fecha final es anterior a la de inicio.'); return }
    if (!(dias > 0)) { toast.error('Los días a disfrutar deben ser más de cero.'); return }
    if (tipo === 'vacaciones' && !periodo) { toast.error('Elige a qué periodo se cargan.'); return }

    setGuardando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('vac_movimientos')
      .insert({
        empleado_id: empleadoId,
        tipo,
        periodo: tipo === 'vacaciones' ? periodo : null,
        dias,
        fecha_inicio: inicio,
        fecha_fin: finEfectivo,
        fecha_regreso: regreso || null,
        observaciones: observaciones.trim() || null,
        origen: 'registro_rh',
        registrado_por: user?.id ?? null,
      })
      .select('id')
      .single()
    setGuardando(false)

    if (error || !data) {
      toast.error(`No se pudo registrar: ${error?.message ?? 'sin respuesta'}`)
      return
    }
    toast.success(tipo === 'vacaciones' ? 'Vacaciones registradas' : 'Día flotante registrado')
    setRegistrado(data.id)
    limpiar()
    router.refresh()
  }

  return (
    <form onSubmit={guardar} className="px-5 py-4 flex flex-col gap-3">
      <div className="flex gap-1.5">
        {([['vacaciones', 'Vacaciones'], ['flotante', 'Día flotante']] as const).map(([k, t]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTipo(k)}
            disabled={k === 'vacaciones' && periodos.length === 0}
            className={`text-[12px] font-medium rounded px-3 py-[5px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              tipo === k ? 'border-navy bg-navy text-white' : 'border-[#ECECEC] text-ink-500 hover:bg-surface-hover'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tipo === 'vacaciones' && periodos.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Se cargan al periodo</span>
          <select value={periodo ?? ''} onChange={e => setPeriodo(Number(e.target.value))} className={campo}>
            {periodos.map(p => (
              <option key={p.periodo} value={p.periodo}>
                {`Año ${p.periodo} (${p.desde.slice(0, 4)}–${p.hasta.slice(0, 4)}) · quedan ${p.restantes} de ${p.derecho}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Del</span>
          <input type="date" value={inicio} onChange={e => { setInicio(e.target.value); setDiasManual(null); setRegresoManual(null) }} className={campo} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Al</span>
          <input type="date" value={fin} min={inicio || undefined} onChange={e => { setFin(e.target.value); setDiasManual(null); setRegresoManual(null) }} className={campo} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Días a disfrutar</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={diasManual ?? (inicio ? String(diasCalculados) : '')}
            onChange={e => setDiasManual(e.target.value)}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Regresa a trabajar</span>
          <input type="date" value={regreso} onChange={e => setRegresoManual(e.target.value)} className={campo} />
        </label>
      </div>

      {inicio && (
        <p className="text-[11.5px] text-ink-500">
          {diasCalculados} {diasCalculados === 1 ? 'día hábil' : 'días hábiles'} de lunes a viernes
          {festivos.length > 0 && <> · no cuentan: {festivos.map(f => `${fechaCorta(f.fecha)} (${f.nombre})`).join(', ')}</>}
          {diasManual !== null && Number(diasManual) !== diasCalculados && <> · corregido a mano</>}
        </p>
      )}

      {quedarian !== null && quedarian < 0 && (
        <p className="flex items-start gap-1.5 text-[12px] text-[#8A6100]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          El periodo quedaría en {quedarian}. Se puede registrar, pero revisa si van a otro periodo.
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className={etiqueta}>Observaciones</span>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className={campo} />
      </label>

      <button
        type="submit"
        disabled={guardando}
        className="self-start text-[13px] font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-60 rounded px-3.5 py-1.5 transition-colors"
      >
        {guardando ? 'Guardando…' : 'Registrar'}
      </button>

      {registrado && (
        <a
          href={`/formato/vacaciones/${registrado}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-navy font-medium hover:underline"
        >
          <Printer size={13} /> Imprimir el formato para firmas
        </a>
      )}
    </form>
  )
}
