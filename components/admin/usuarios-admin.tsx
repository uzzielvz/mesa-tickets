'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Profile { id: string; nombre_completo: string; email: string; rol: string; area_id: string | null; activo: boolean; acceso_score: boolean }
interface Area { id: string; nombre: string }

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  responsable: 'Responsable',
  usuario: 'Usuario',
}

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
    const { error } = await supabase.from('profiles').update({ rol: nuevoRol }).eq('id', id)
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

  async function toggleScoreAccess(id: string, actual: boolean) {
    setSaving(id)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ acceso_score: !actual }).eq('id', id)
    if (error) { toast.error('Error al actualizar acceso.'); setSaving(null); return }
    toast.success(actual ? 'Acceso a Score retirado' : 'Acceso a Score otorgado')
    router.refresh()
    setSaving(null)
  }

  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden max-w-3xl">
      {/* Headers */}
      <div className="hidden md:grid grid-cols-[1fr_130px_150px_100px] px-5 py-2 border-b border-[#ECECEC] bg-surface-sidebar">
        {['Usuario', 'Rol', 'Área', 'Score'].map(h => (
          <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
        ))}
      </div>

      {profiles.map((profile, i) => (
        <div
          key={profile.id}
          className={`grid grid-cols-1 md:grid-cols-[1fr_130px_150px_100px] items-center px-5 py-3 gap-2 ${i < profiles.length - 1 ? 'border-b border-[#F5F5F5]' : ''} ${saving === profile.id ? 'opacity-50' : ''}`}
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
        </div>
      ))}
    </div>
  )
}
