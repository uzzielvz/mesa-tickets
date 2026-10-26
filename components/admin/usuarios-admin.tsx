'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Database } from '@/lib/supabase/types'

interface Profile { id: string; nombre_completo: string; email: string; rol: string; area_id: string | null; activo: boolean; acceso_tickets: boolean; acceso_score: boolean; acceso_cartera: boolean; acceso_reclutamiento: boolean; acceso_actividades: boolean; acceso_inversiones_carga: boolean; acceso_inversiones_pagos: boolean; acceso_inversiones_desempeno: boolean; acceso_ahorros: boolean; acceso_ahorros_carga: boolean; acceso_vacaciones_rh: boolean; acceso_auditor: boolean; acceso_auditor_carga: boolean; supervisa_tickets: boolean }
interface Area { id: string; nombre: string }

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
type CampoBandera = { [K in keyof Profile]: Profile[K] extends boolean ? K : never }[keyof Profile]

interface Permiso {
  campo: CampoBandera
  sub?: string                  // solo en módulos con más de un papel
  ayuda: string                 // tooltip del interruptor y del encabezado
  etiqueta: string              // toast: "<etiqueta> otorgado / retirado"
  avisos?: [string, string]     // toast a la medida: [al dar, al quitar]
  // Un constructor por bandera en vez de una clave computada: `{ [campo]: v }`
  // produce un índice de string que el tipo Update de Supabase rechaza.
  cambio: (v: boolean) => ProfileUpdate
}

interface Modulo { titulo: string; nombre: string; permisos: Permiso[] }

// Una columna por bandera, agrupadas por módulo. Los módulos con varios papeles
// llevan un segundo renglón de encabezado que dice qué es cada interruptor.
const MODULOS: Modulo[] = [
  {
    titulo: 'Tickets', nombre: 'Mesa de tickets',
    permisos: [
      { campo: 'acceso_tickets', sub: 'Acceso', ayuda: 'Usar la mesa de tickets', etiqueta: 'Acceso a Tickets', cambio: v => ({ acceso_tickets: v }) },
      // Supervisor de la mesa: ve las colas de TODAS las áreas sin ser admin
      // del sistema (TKT-043). Es ortogonal al rol, por eso va como interruptor.
      {
        campo: 'supervisa_tickets', sub: 'Supervisa',
        ayuda: 'Ver las colas de TODAS las áreas de la mesa (no da acceso de administrador)',
        etiqueta: 'Supervisión de la mesa',
        avisos: ['Ahora supervisa toda la mesa', 'Ya no supervisa la mesa'],
        cambio: v => ({ supervisa_tickets: v }),
      },
    ],
  },
  {
    titulo: 'Score', nombre: 'Score crediticio',
    permisos: [{ campo: 'acceso_score', ayuda: 'Usar el Score crediticio', etiqueta: 'Acceso a Score', cambio: v => ({ acceso_score: v }) }],
  },
  {
    titulo: 'Cartera', nombre: 'Cartera individual',
    permisos: [{ campo: 'acceso_cartera', ayuda: 'Consultar la Cartera individual', etiqueta: 'Acceso a Cartera', cambio: v => ({ acceso_cartera: v }) }],
  },
  {
    titulo: 'Reclut.', nombre: 'Reclutamiento',
    permisos: [{ campo: 'acceso_reclutamiento', ayuda: 'Usar Reclutamiento', etiqueta: 'Acceso a Reclutamiento', cambio: v => ({ acceso_reclutamiento: v }) }],
  },
  // Tablero directivo de actividades (ACT-001). Muestra el tiempo de cada
  // persona con nombre y apellido, así que nace cerrado y se abre uno por uno.
  {
    titulo: 'Activid.', nombre: 'Actividades',
    permisos: [{
      campo: 'acceso_actividades',
      ayuda: 'Ver el tablero de Actividades (muestra el tiempo de cada persona por nombre)',
      etiqueta: 'Acceso a Actividades',
      cambio: v => ({ acceso_actividades: v }),
    }],
  },
  /**
   * Inversiones (INV-001) tiene TRES banderas, no una, porque son tres papeles
   * distintos: quien sube los reportes (Felix), quien ve el calendario de pagos
   * (Tesorería) y quien ve el tablero de desempeño (Dirección). Tener uno no da
   * los otros — y los archivos traen CLABE de los fondeadores, así que la
   * separación no es cosmética.
   */
  {
    titulo: 'Inversiones', nombre: 'Inversiones',
    permisos: [
      { campo: 'acceso_inversiones_carga', sub: 'Carga', ayuda: 'Subir reportes de inversiones', etiqueta: 'Acceso de carga', cambio: v => ({ acceso_inversiones_carga: v }) },
      { campo: 'acceso_inversiones_pagos', sub: 'Pagos', ayuda: 'Ver el Calendario de Pagos a Fondeadores (incluye CLABE)', etiqueta: 'Acceso a pagos', cambio: v => ({ acceso_inversiones_pagos: v }) },
      { campo: 'acceso_inversiones_desempeno', sub: 'Desempeño', ayuda: 'Ver el Tablero Ejecutivo de Cartera', etiqueta: 'Acceso a desempeño', cambio: v => ({ acceso_inversiones_desempeno: v }) },
    ],
  },
  // Ahorros (AHO-001): dos papeles. Quien consulta (asesores, gerentes) y quien
  // sube el CSV ya cuadrado (Data Science). Quien carga también consulta.
  {
    titulo: 'Ahorros', nombre: 'Ahorros',
    permisos: [
      { campo: 'acceso_ahorros', sub: 'Consulta', ayuda: 'Consultar ahorros por grupo y descargar el Excel', etiqueta: 'Acceso a ahorros', cambio: v => ({ acceso_ahorros: v }) },
      { campo: 'acceso_ahorros_carga', sub: 'Carga', ayuda: 'Subir el CSV de ahorros ya cuadrado (también consulta)', etiqueta: 'Acceso de carga de ahorros', cambio: v => ({ acceso_ahorros_carga: v }) },
    ],
  },
  // Vacaciones (VAC-001): Gente y Cultura ve a todo el personal y sus saldos.
  {
    titulo: 'Vacac.', nombre: 'Vacaciones',
    permisos: [{
      campo: 'acceso_vacaciones_rh',
      ayuda: 'Administrar Vacaciones (Gente y Cultura: ve nombres, antigüedad y saldos de todo el personal)',
      etiqueta: 'Acceso a Vacaciones',
      cambio: v => ({ acceso_vacaciones_rh: v }),
    }],
  },
  // Auditor (AUD-001): los mismos dos papeles — quien consulta y quien sube el archivo.
  {
    titulo: 'Auditor', nombre: 'Auditor de depósitos',
    permisos: [
      { campo: 'acceso_auditor', sub: 'Consulta', ayuda: 'Ver los depósitos sin conciliar de toda la cartera', etiqueta: 'Acceso al auditor', cambio: v => ({ acceso_auditor: v }) },
      { campo: 'acceso_auditor_carga', sub: 'Carga', ayuda: 'Subir los archivos del Auditor y asignar la cuenta de cada promotor (también consulta)', etiqueta: 'Acceso de carga del auditor', cambio: v => ({ acceso_auditor_carga: v }) },
    ],
  },
]

const selectClass = 'bg-white border border-[#ECECEC] rounded px-2 py-1 text-[12.5px] text-ink-900 outline-none focus:border-orange transition-all'
const thClass = 'text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium whitespace-nowrap'

function Interruptor({ activo, disabled, onClick, titulo, etiqueta }: {
  activo: boolean
  disabled: boolean
  onClick: () => void
  titulo: string
  etiqueta: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={titulo}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent align-middle
        transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed
        ${activo ? 'bg-navy' : 'bg-[#DCDCDC]'}
      `}
    >
      <span className={`
        inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
        ${activo ? 'translate-x-4' : 'translate-x-0'}
      `} />
    </button>
  )
}

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

  async function togglePermiso(id: string, permiso: Permiso, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update(permiso.cambio(!actual)).eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    const [otorgado, retirado] = permiso.avisos ?? [`${permiso.etiqueta} otorgado`, `${permiso.etiqueta} retirado`]
    toast.success(actual ? retirado : otorgado)
    router.refresh()
    setSaving(null)
  }

  return (
    <div className="border border-[#ECECEC] rounded-md overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-surface-sidebar">
            <th rowSpan={2} className={`${thClass} sticky left-0 z-20 bg-surface-sidebar text-left pl-5 pr-3 py-2 border-b border-r border-[#ECECEC]`}>
              Usuario
            </th>
            <th rowSpan={2} className={`${thClass} text-left px-3 py-2 border-b border-[#ECECEC]`}>Rol</th>
            <th rowSpan={2} className={`${thClass} text-left px-3 py-2 border-b border-[#ECECEC]`}>Área</th>
            {MODULOS.map(m => {
              const varios = m.permisos.length > 1
              return (
                <th
                  key={m.titulo}
                  colSpan={m.permisos.length}
                  rowSpan={varios ? 1 : 2}
                  title={varios ? m.nombre : m.permisos[0].ayuda}
                  className={`${thClass} px-2 text-center border-l border-[#ECECEC] ${varios ? 'pt-2 pb-0.5' : 'py-2 border-b'}`}
                >
                  {m.titulo}
                </th>
              )
            })}
          </tr>
          <tr className="bg-surface-sidebar">
            {MODULOS.filter(m => m.permisos.length > 1).flatMap(m => m.permisos.map((p, j) => (
              <th
                key={p.campo}
                title={p.ayuda}
                className={`px-2 pb-2 text-[11px] font-normal text-ink-500 text-center whitespace-nowrap border-b border-[#ECECEC] ${j === 0 ? 'border-l' : ''}`}
              >
                {p.sub}
              </th>
            )))}
          </tr>
        </thead>

        <tbody>
          {profiles.map((profile, i) => {
            const enCurso = saving === profile.id
            // Fondo opaco en cada celda: la columna de usuario es sticky y sin
            // fondo dejaría ver los interruptores que pasan por debajo.
            const celda = `bg-white group-hover:bg-surface-sidebar transition-colors ${i < profiles.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`
            return (
              <tr key={profile.id} className={`group ${enCurso ? 'opacity-50' : ''}`}>
                <td className={`${celda} sticky left-0 z-10 pl-5 pr-3 py-3 border-r border-r-[#ECECEC]`}>
                  <div className="w-[170px] md:w-[200px]">
                    <p className="text-[13px] font-medium text-ink-900 truncate" title={profile.nombre_completo}>{profile.nombre_completo}</p>
                    <p className="text-[11.5px] text-ink-400 truncate" title={profile.email}>{profile.email}</p>
                  </div>
                </td>

                <td className={`${celda} px-3 py-3`}>
                  <select
                    value={profile.rol}
                    onChange={e => updateRol(profile.id, e.target.value, profile.rol)}
                    className={selectClass}
                  >
                    <option value="usuario">Usuario</option>
                    <option value="responsable">Responsable</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>

                <td className={`${celda} px-3 py-3`}>
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
                </td>

                {MODULOS.flatMap(m => m.permisos.map((p, j) => {
                  const activo = profile[p.campo] === true
                  return (
                    <td key={p.campo} className={`${celda} px-2 py-3 text-center ${j === 0 ? 'border-l border-l-[#ECECEC]' : ''}`}>
                      <Interruptor
                        activo={activo}
                        disabled={enCurso}
                        onClick={() => togglePermiso(profile.id, p, activo)}
                        titulo={`${activo ? 'Quitar' : 'Dar'}: ${p.ayuda}`}
                        etiqueta={`${m.nombre}${p.sub ? ` · ${p.sub}` : ''} — ${profile.nombre_completo}`}
                      />
                    </td>
                  )
                }))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
