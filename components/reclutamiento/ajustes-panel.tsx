'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Mail, RefreshCw, UserCog, Users } from 'lucide-react'
import {
  guardarAjustesDg, guardarDestinatariosAltas,
  guardarAjustesFactorial,
} from '@/lib/actions/ajustes'
import { DESTINATARIOS_ROLES } from '@/lib/schemas/reclutamiento'
import PlantillasEditor, { type PlantillaGuardada } from '@/components/reclutamiento/plantillas-editor'
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
  plantillas,
  factorialSyncActiva,
  faltanAjustes,
}: {
  dg: AjustesDg
  destinatarios: AjustesDestinatarios
  plantillas: Record<string, PlantillaGuardada>
  factorialSyncActiva: boolean
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
      <BloqueFactorial inicial={factorialSyncActiva} />
      <BloqueDestinatarios inicial={destinatarios} />

      <Bloque
        icono={Mail}
        titulo="Plantillas de correo"
        descripcion="El texto exacto que reciben candidatos y entrevistadores. Se aplica al siguiente envío."
      >
        <PlantillasEditor plantillas={plantillas} />
      </Bloque>
    </div>
  )
}

function BloqueFactorial({ inicial }: { inicial: boolean }) {
  const router = useRouter()
  const [activa, setActiva] = useState(inicial)
  const [guardando, setGuardando] = useState(false)

  async function alternar() {
    const nuevo = !activa
    setGuardando(true)
    const res = await guardarAjustesFactorial({ sync_activa: nuevo })
    setGuardando(false)
    if (res.ok) {
      setActiva(nuevo)
      toast.success(nuevo ? 'Sincronización con Factorial activada.' : 'Sincronización con Factorial desactivada.')
      router.refresh()
    } else toast.error(res.error)
  }

  return (
    <Bloque
      icono={RefreshCw}
      titulo="Sincronización con Factorial HR"
      descripcion="Cuando está activa, al contratar a un candidato se da de alta el empleado en Factorial. La contratación y sus correos funcionan igual con esto apagado."
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-ink-700">
          {activa ? 'Activada — se crearán empleados en Factorial.' : 'Desactivada — no se crea nada en Factorial.'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={activa}
          onClick={alternar}
          disabled={guardando}
          className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${activa ? 'bg-orange' : 'bg-[#D4D4D4]'}`}
        >
          <span className={`inline-block h-[16px] w-[16px] rounded-full bg-white shadow transition-transform ${activa ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
        </button>
      </div>
    </Bloque>
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
