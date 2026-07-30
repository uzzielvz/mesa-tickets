'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Mail, UserCog, Users } from 'lucide-react'
import {
  guardarAjustesDg, guardarDestinatariosAltas, guardarCcPlantilla,
} from '@/lib/actions/ajustes'
import { DESTINATARIOS_ROLES, PLANTILLAS_CC } from '@/lib/schemas/reclutamiento'
import type { AjustesDg, AjustesDestinatarios } from '@/lib/reclutamiento/ajustes'

const inputClass =
  'bg-white border border-[#ECECEC] rounded px-2.5 py-[7px] text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all w-full'
const labelClass = 'text-[11.5px] font-medium text-ink-500'
const botonClass =
  'self-start inline-flex items-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-[12px] font-medium rounded px-4 py-[7px] disabled:opacity-50 transition-colors'

function Bloque({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: typeof Mail
  titulo: string
  descripcion: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-[#ECECEC] rounded-md p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Icono size={15} className="text-orange mt-[2px] shrink-0" />
        <div>
          <h2 className="text-[13.5px] font-semibold text-ink-900">{titulo}</h2>
          <p className="text-[11.5px] text-ink-400 mt-0.5">{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function AjustesPanel({
  dg,
  destinatarios,
  ccPorPlantilla,
  faltanAjustes,
}: {
  dg: AjustesDg
  destinatarios: AjustesDestinatarios
  ccPorPlantilla: Record<string, string[]>
  faltanAjustes: boolean
}) {
  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      {faltanAjustes && (
        <div className="flex items-start gap-2 border border-[#fde68a] bg-[#fffbeb] rounded-md px-3 py-2.5">
          <AlertTriangle size={14} className="text-[#a16207] mt-[2px] shrink-0" />
          <p className="text-[12px] text-[#a16207]">
            Falta el correo del Director General. Sin él no se puede agendar la entrevista
            final ni pasar un candidato de comité a la etapa con la DG.
          </p>
        </div>
      )}

      <BloqueDg inicial={dg} />
      <BloqueDestinatarios inicial={destinatarios} />
      <BloqueCc inicial={ccPorPlantilla} />
    </div>
  )
}

function BloqueDg({ inicial }: { inicial: AjustesDg }) {
  const router = useRouter()
  const [email, setEmail] = useState(inicial.email)
  const [nombre, setNombre] = useState(inicial.nombre)
  const [duracion, setDuracion] = useState(String(inicial.duracion_min))
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    const res = await guardarAjustesDg({
      email, nombre, duracion_min: Number(duracion),
    })
    setGuardando(false)
    if (res.ok) { toast.success('Datos de la Dirección General guardados.'); router.refresh() }
    else toast.error(res.error)
  }

  return (
    <Bloque
      icono={UserCog}
      titulo="Dirección General"
      descripcion="Con quién se agenda la entrevista final. Recibe la invitación de Google Meet."
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Correo</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="director@…" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Nombre y apellido" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Duración (min)</label>
          <input type="number" min={15} max={180} value={duracion}
            onChange={e => setDuracion(e.target.value)} className={inputClass} />
        </div>
      </div>
      <button onClick={guardar} disabled={guardando} className={botonClass}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </Bloque>
  )
}

function BloqueDestinatarios({ inicial }: { inicial: AjustesDestinatarios }) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, string>>({ ...inicial })
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    const res = await guardarDestinatariosAltas(valores)
    setGuardando(false)
    if (res.ok) { toast.success('Destinatarios de altas guardados.'); router.refresh() }
    else toast.error(res.error)
  }

  return (
    <Bloque
      icono={Users}
      titulo="Destinatarios del correo de altas"
      descripcion="Solo prellenan el formulario de alta de cada candidato; ahí se pueden cambiar caso por caso."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DESTINATARIOS_ROLES.map(rol => (
          <div key={rol.key} className="flex flex-col gap-1">
            <label className={labelClass}>{rol.label}</label>
            <input
              type="email"
              value={valores[rol.key] ?? ''}
              onChange={e => setValores(prev => ({ ...prev, [rol.key]: e.target.value }))}
              placeholder="correo@…"
              className={inputClass}
            />
          </div>
        ))}
      </div>
      <button onClick={guardar} disabled={guardando} className={botonClass}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </Bloque>
  )
}

function BloqueCc({ inicial }: { inicial: Record<string, string[]> }) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(PLANTILLAS_CC.map(p => [p.codigo, (inicial[p.codigo] ?? []).join(', ')])),
  )
  const [guardando, setGuardando] = useState<string | null>(null)

  async function guardar(codigo: string) {
    setGuardando(codigo)
    const cc_emails = (valores[codigo] ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const res = await guardarCcPlantilla({ codigo, cc_emails })
    setGuardando(null)
    if (res.ok) { toast.success('Copias guardadas.'); router.refresh() }
    else toast.error(res.error)
  }

  return (
    <Bloque
      icono={Mail}
      titulo="Copias (CC) por plantilla"
      descripcion="Quién recibe copia de cada correo automático. Separa varios con comas."
    >
      <div className="flex flex-col gap-3">
        {PLANTILLAS_CC.map(p => (
          <div key={p.codigo} className="flex flex-col gap-1">
            <label className={labelClass}>{p.label}</label>
            <div className="flex gap-2">
              <input
                value={valores[p.codigo] ?? ''}
                onChange={e => setValores(prev => ({ ...prev, [p.codigo]: e.target.value }))}
                placeholder="correo@…, otro@…"
                className={inputClass}
              />
              <button
                onClick={() => guardar(p.codigo)}
                disabled={guardando === p.codigo}
                className="shrink-0 text-[11.5px] font-medium text-navy border border-[#ECECEC] rounded px-3 py-[6px] hover:bg-surface-hover disabled:opacity-50 transition-colors"
              >
                {guardando === p.codigo ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Bloque>
  )
}
