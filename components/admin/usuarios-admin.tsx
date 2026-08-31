'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Profile { id: string; nombre_completo: string; email: string; rol: string; area_id: string | null; activo: boolean; acceso_tickets: boolean; acceso_score: boolean; acceso_cartera: boolean; acceso_reclutamiento: boolean; acceso_actividades: boolean; acceso_inversiones_carga: boolean; acceso_inversiones_pagos: boolean; acceso_inversiones_desempeno: boolean; supervisa_tickets: boolean }
interface Area { id: string; nombre: string }

const selectClass = 'bg-white border border-[#ECECEC] rounded px-2 py-1 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'

export default function UsuariosAdmin({ profiles, areas }: { profiles: Profile[]; areas: Area[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)

  async function updateRol(id: string, nuevoRol: string, rolActual: string) {
    if (rolActual === 'admin' && nuevoRol !== 'admin') {
      if (!confirm('¿Seguro que quieres quitar el rol de Administrador a este usuario?')) return
    }
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ rol: nuevoRol as 'admin' | 'responsable' | 'usuario' }).eq('id', id)
    if (error) { toast.error('Error al actualizar el rol.'); setSaving(null); return }
    toast.success('Rol actualizado')
    router.refresh()
    setSaving(null)
  }

  async function updateArea(id: string, area_id: string) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ area_id: area_id || null }).eq('id', id)
    if (error) { toast.error('Error al actualizar el área.'); setSaving(null); return }
    toast.success('Área actualizada')
    router.refresh()
    setSaving(null)
  }

  async function toggleTicketsAccess(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ acceso_tickets: !actual }).eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? 'Acceso a Tickets retirado' : 'Acceso a Tickets otorgado')
    router.refresh()
    setSaving(null)
  }

  async function toggleScoreAccess(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ acceso_score: !actual }).eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? 'Acceso a Score retirado' : 'Acceso a Score otorgado')
    router.refresh()
    setSaving(null)
  }

  async function toggleCarteraAccess(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ acceso_cartera: !actual }).eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? 'Acceso a Cartera retirado' : 'Acceso a Cartera otorgado')
    router.refresh()
    setSaving(null)
  }

  async function toggleReclutamientoAccess(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ acceso_reclutamiento: !actual }).eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? 'Acceso a Reclutamiento retirado' : 'Acceso a Reclutamiento otorgado')
    router.refresh()
    setSaving(null)
  }

  // Tablero directivo de actividades (ACT-001). Muestra el tiempo de cada
  // persona con nombre y apellido, así que nace cerrado y se abre uno por uno.
  async function toggleActividadesAccess(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ acceso_actividades: !actual }).eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? 'Acceso a Actividades retirado' : 'Acceso a Actividades otorgado')
    router.refresh()
    setSaving(null)
  }

  /**
   * Inversiones (INV-001) tiene TRES banderas, no una, porque son tres papeles
   * distintos: quien sube los reportes (Felix), quien ve el calendario de pagos
   * (Tesorería) y quien ve el tablero de desempeño (Dirección). Tener uno no da
   * los otros — y los archivos traen CLABE de los fondeadores, así que la
   * separación no es cosmética.
   */
  // Un constructor por bandera en vez de una clave computada: `{ [campo]: v }`
  // produce un índice de string que el tipo Update de Supabase rechaza.
  const CAMBIO_INV = {
    carga:     (v: boolean) => ({ acceso_inversiones_carga: v }),
    pagos:     (v: boolean) => ({ acceso_inversiones_pagos: v }),
    desempeno: (v: boolean) => ({ acceso_inversiones_desempeno: v }),
  } as const

  async function toggleInversiones(
    id: string,
    clave: keyof typeof CAMBIO_INV,
    actual: boolean,
    etiqueta: string,
  ) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update(CAMBIO_INV[clave](!actual))
      .eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? `${etiqueta} retirado` : `${etiqueta} otorgado`)
    router.refresh()
    setSaving(null)
  }

  // Supervisor de la mesa: ve las colas de TODAS las áreas sin ser admin
  // del sistema (TKT-043). Es ortogonal al rol, por eso va como toggle.
  async function toggleSupervisaTickets(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ supervisa_tickets: !actual }).eq('id', id)
    if (error) { toast.error('Error al actualizar la supervisión.'); setSaving(null); return }
    toast.success(actual ? 'Ya no supervisa la mesa' : 'Ahora supervisa toda la mesa')
    router.refresh()
    setSaving(null)
  }

  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden max-w-4xl">
      {/* Headers */}
      <div className="hidden md:grid grid-cols-[1fr_110px_130px_70px_70px_70px_76px_84px_116px_88px] px-5 py-2 border-b border-[#ECECEC] bg-surface-sidebar">
        {['Usuario', 'Rol', 'Área', 'Tickets', 'Score', 'Cartera', 'Reclut.', 'Activid.', 'Inversiones', 'Supervisa'].map(h => (
          <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
        ))}
      </div>

      {profiles.map((profile, i) => (
        <div
          key={profile.id}
          className={`grid grid-cols-1 md:grid-cols-[1fr_110px_130px_70px_70px_70px_76px_84px_116px_88px] items-center px-5 py-3 gap-2 ${i < profiles.length - 1 ? 'border-b border-[#F5F5F5]' : ''} ${saving === profile.id ? 'opacity-50' : ''}`}
        >
          <div>
            <p className="text-[13px] font-medium text-ink-900">{profile.nombre_completo}</p>
            <p className="text-[11.5px] text-ink-400">{profile.email}</p>
          </div>

          <select
            value={profile.rol}
            onChange={e => updateRol(profile.id, e.target.value, profile.rol)}
            className={selectClass}
          >
            <option value="usuario">Usuario</option>
            <option value="responsable">Responsable</option>
            <option value="admin">Administrador</option>
          </select>

          <select
            value={profile.area_id ?? ''}
            onChange={e => updateArea(profile.id, e.target.value)}
            className={selectClass}
          >
            <option value="">Sin área</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>

          {/* Toggle acceso Mesa de tickets */}
          <button
            onClick={() => toggleTicketsAccess(profile.id, profile.acceso_tickets)}
            disabled={saving === profile.id}
            title={profile.acceso_tickets ? 'Quitar acceso a Tickets' : 'Dar acceso a Tickets'}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
              ${profile.acceso_tickets ? 'bg-navy' : 'bg-[#DCDCDC]'}
            `}
          >
            <span className={`
              inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${profile.acceso_tickets ? 'translate-x-4' : 'translate-x-0'}
            `} />
          </button>

          {/* Toggle acceso Score Crediticio */}
          <button
            onClick={() => toggleScoreAccess(profile.id, profile.acceso_score)}
            disabled={saving === profile.id}
            title={profile.acceso_score ? 'Quitar acceso a Score' : 'Dar acceso a Score'}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
              ${profile.acceso_score ? 'bg-orange' : 'bg-[#DCDCDC]'}
            `}
          >
            <span className={`
              inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${profile.acceso_score ? 'translate-x-4' : 'translate-x-0'}
            `} />
          </button>

          {/* Toggle acceso Cartera Individual */}
          <button
            onClick={() => toggleCarteraAccess(profile.id, profile.acceso_cartera)}
            disabled={saving === profile.id}
            title={profile.acceso_cartera ? 'Quitar acceso a Cartera' : 'Dar acceso a Cartera'}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
              ${profile.acceso_cartera ? 'bg-navy' : 'bg-[#DCDCDC]'}
            `}
          >
            <span className={`
              inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${profile.acceso_cartera ? 'translate-x-4' : 'translate-x-0'}
            `} />
          </button>

          {/* Toggle acceso Reclutamiento */}
          <button
            onClick={() => toggleReclutamientoAccess(profile.id, profile.acceso_reclutamiento)}
            disabled={saving === profile.id}
            title={profile.acceso_reclutamiento ? 'Quitar acceso a Reclutamiento' : 'Dar acceso a Reclutamiento'}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
              ${profile.acceso_reclutamiento ? 'bg-navy' : 'bg-[#DCDCDC]'}
            `}
          >
            <span className={`
              inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${profile.acceso_reclutamiento ? 'translate-x-4' : 'translate-x-0'}
            `} />
          </button>

          {/* Toggle acceso Actividades */}
          <button
            onClick={() => toggleActividadesAccess(profile.id, profile.acceso_actividades)}
            disabled={saving === profile.id}
            title={profile.acceso_actividades
              ? 'Quitar acceso al tablero de Actividades'
              : 'Dar acceso al tablero de Actividades (muestra el tiempo de cada persona por nombre)'}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
              ${profile.acceso_actividades ? 'bg-navy' : 'bg-[#DCDCDC]'}
            `}
          >
            <span className={`
              inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${profile.acceso_actividades ? 'translate-x-4' : 'translate-x-0'}
            `} />
          </button>

          {/* Inversiones — tres papeles en una sola columna: Carga · Pagos · Desempeño */}
          <div className="flex items-center gap-1.5">
            {([
              ['carga', 'acceso_inversiones_carga', 'C', 'Subir reportes de inversiones', 'Acceso de carga'],
              ['pagos', 'acceso_inversiones_pagos', 'P', 'Ver el Calendario de Pagos a Fondeadores (incluye CLABE)', 'Acceso a pagos'],
              ['desempeno', 'acceso_inversiones_desempeno', 'D', 'Ver el Tablero Ejecutivo de Cartera', 'Acceso a desempeño'],
            ] as const).map(([clave, campo, letra, ayuda, etiqueta]) => {
              const activo = profile[campo] === true
              return (
                <button
                  key={campo}
                  onClick={() => toggleInversiones(profile.id, clave, activo, etiqueta)}
                  disabled={saving === profile.id}
                  title={`${activo ? 'Quitar' : 'Dar'}: ${ayuda}`}
                  className={`
                    h-5 w-5 rounded text-[10px] font-semibold leading-none
                    transition-colors cursor-pointer disabled:cursor-not-allowed
                    ${activo ? 'bg-navy text-white' : 'bg-[#ECECEC] text-ink-400'}
                  `}
                >
                  {letra}
                </button>
              )
            })}
          </div>

          {/* Supervisa toda la mesa: ve las colas de todas las áreas */}
          <button
            onClick={() => toggleSupervisaTickets(profile.id, profile.supervisa_tickets)}
            disabled={saving === profile.id}
            title={profile.supervisa_tickets
              ? 'Dejar de ver las colas de todas las áreas'
              : 'Ver las colas de TODAS las áreas de la mesa (no da acceso de administrador)'}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
              transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
              ${profile.supervisa_tickets ? 'bg-orange' : 'bg-[#DCDCDC]'}
            `}
          >
            <span className={`
              inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
              ${profile.supervisa_tickets ? 'translate-x-4' : 'translate-x-0'}
            `} />
          </button>
        </div>
      ))}
    </div>
  )
}
