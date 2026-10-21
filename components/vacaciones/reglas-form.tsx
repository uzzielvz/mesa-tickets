'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { fechaLarga } from '@/lib/vacaciones/calendario'
import type { ReglasVacaciones } from '@/lib/vacaciones/tipos'

const campo =
  'w-full bg-white border border-[#ECECEC] rounded px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-colors'
const etiqueta = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium'

/**
 * Las dos reglas que solo decide la política de la empresa (VAC-010): si las
 * vacaciones vencen y cuántos días flotantes hay por año. Vacías, todo sigue
 * como antes. Al guardar, los saldos de todos se recalculan solos.
 */
export default function ReglasVacacionesForm({ reglas, hoy }: { reglas: ReglasVacaciones; hoy: string }) {
  const router = useRouter()
  const [f, setF] = useState({
    meses: reglas.meses_vigencia?.toString() ?? '',
    desde: reglas.vigencia_desde ?? '',
    flotantes: reglas.flotantes_por_anio?.toString() ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  const entero = (s: string) => (s.trim() === '' ? null : Number(s))
  const meses = entero(f.meses)
  const flotantes = entero(f.flotantes)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (meses !== null && (!Number.isInteger(meses) || meses < 1 || meses > 60)) {
      toast.error('La vigencia va de 1 a 60 meses. Déjala vacía si las vacaciones no vencen.')
      return
    }
    if (flotantes !== null && (!Number.isInteger(flotantes) || flotantes < 0 || flotantes > 30)) {
      toast.error('Los días flotantes van de 0 a 30. Déjalo vacío si no hay tope.')
      return
    }
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('vac_guardar_reglas', {
      p_meses_vigencia: meses,
      p_vigencia_desde: meses !== null && f.desde ? f.desde : null,
      p_flotantes_por_anio: flotantes,
    })
    setGuardando(false)
    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`)
      return
    }
    toast.success('Reglas guardadas. Los saldos ya se recalcularon.')
    router.refresh()
  }

  return (
    <form onSubmit={guardar} className="px-5 py-4 flex flex-col gap-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Las vacaciones vencen a los</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={60}
              value={f.meses}
              onChange={e => setF({ ...f, meses: e.target.value })}
              placeholder="no vencen"
              className={campo}
            />
            <span className="text-[12px] text-ink-500 whitespace-nowrap">meses</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Lo acumulado cuenta desde</span>
          <input
            type="date"
            value={f.desde}
            onChange={e => setF({ ...f, desde: e.target.value })}
            disabled={meses === null}
            className={`${campo} disabled:bg-surface-sidebar disabled:text-ink-400`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Días flotantes por año</span>
          <input
            type="number"
            min={0}
            max={30}
            value={f.flotantes}
            onChange={e => setF({ ...f, flotantes: e.target.value })}
            placeholder="sin tope"
            className={campo}
          />
        </label>
      </div>

      <ul className="text-[12px] text-ink-500 leading-relaxed list-disc pl-4">
        <li>
          {meses === null
            ? 'Las vacaciones no vencen: los días de cada año de servicio se acumulan.'
            : `Los días de cada año de servicio vencen ${meses} ${meses === 1 ? 'mes' : 'meses'} después del aniversario en que se ganan. Lo que no se tomó deja de contar como disponible; el historial no se borra.`}
        </li>
        {meses !== null && (
          <li>
            {f.desde
              ? `Transición: nada vence antes del ${fechaLarga(addMonths(f.desde, meses))}. Lo acumulado tiene ${meses} ${meses === 1 ? 'mes' : 'meses'} contados desde el ${fechaLarga(f.desde)}.`
              : 'Sin transición: los periodos viejos vencen hoy mismo si ya pasó su plazo. Pon una fecha para darle tiempo a lo acumulado.'}
          </li>
        )}
        <li>
          {flotantes === null
            ? 'Los días flotantes no tienen tope.'
            : `Cada persona puede pedir hasta ${flotantes} ${flotantes === 1 ? 'día flotante' : 'días flotantes'} por año calendario. Una solicitud que lo rebase se rechaza al enviarla.`}
        </li>
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="text-[13px] font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-60 rounded px-3.5 py-1.5 transition-colors"
        >
          {guardando ? 'Guardando…' : 'Guardar reglas'}
        </button>
        {meses !== null && !f.desde && (
          <button
            type="button"
            onClick={() => setF({ ...f, desde: hoy })}
            className="text-[12px] text-navy font-medium hover:underline"
          >
            Usar hoy como arranque
          </button>
        )}
      </div>
    </form>
  )
}

/** 'YYYY-MM-DD' + n meses, igual que `make_interval(months => n)` en la base. */
function addMonths(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const anio = Math.floor(total / 12)
  const mes = total % 12
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}
