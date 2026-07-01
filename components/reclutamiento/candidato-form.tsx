'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { crearCandidato, actualizarCandidato } from '@/lib/actions/reclutamiento'
import {
  FUENTES, FUENTE_LABEL, ETAPAS, ETAPA_LABEL,
  REVISIONES_CV, REVISION_CV_LABEL, MOTIVOS_DESCARTE, MOTIVO_DESCARTE_LABEL,
  CV_MIME_TYPES, CV_MAX_BYTES,
} from '@/lib/schemas/reclutamiento'
import type { RecEtapa, RecFuente, RecRevisionCv, RecMotivoDescarte } from '@/lib/supabase/types'

const inputClass =
  'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all w-full'
const selectClass =
  'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 outline-none focus:border-orange transition-all w-full'

interface Vacante { id: string; titulo: string; estado: 'abierta' | 'cerrada' }

interface InitialData {
  id: string
  vacante_id: string
  nombre: string
  email: string | null
  telefono: string | null
  fuente: RecFuente | null
  etapa: RecEtapa
  revision_cv: RecRevisionCv | null
  motivo_descarte: RecMotivoDescarte | null
  cv_storage_path: string | null
  notas: string | null
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[12.5px] font-medium text-ink-700">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default function CandidatoForm({
  vacantes,
  vacanteIdInicial,
  initialData,
}: {
  vacantes: Vacante[]
  vacanteIdInicial?: string
  initialData?: InitialData
}) {
  const router = useRouter()
  const isEdit = !!initialData

  const [vacanteId, setVacanteId] = useState(initialData?.vacante_id ?? vacanteIdInicial ?? vacantes[0]?.id ?? '')
  const [nombre, setNombre] = useState(initialData?.nombre ?? '')
  const [email, setEmail] = useState(initialData?.email ?? '')
  const [telefono, setTelefono] = useState(initialData?.telefono ?? '')
  const [fuente, setFuente] = useState<string>(initialData?.fuente ?? '')
  const [etapa, setEtapa] = useState<RecEtapa>(initialData?.etapa ?? 'postulado')
  const [revisionCv, setRevisionCv] = useState<string>(initialData?.revision_cv ?? '')
  const [motivoDescarte, setMotivoDescarte] = useState<string>(initialData?.motivo_descarte ?? '')
  const [notas, setNotas] = useState(initialData?.notas ?? '')

  const [cvPath, setCvPath] = useState(initialData?.cv_storage_path ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const requiereMotivo = revisionCv === 'no_viable' || etapa === 'descartado'

  function onSelectFile(f: File | null) {
    if (!f) { setArchivo(null); return }
    if (!CV_MIME_TYPES.includes(f.type as (typeof CV_MIME_TYPES)[number])) {
      toast.error('El CV debe ser PDF, DOC o DOCX')
      return
    }
    if (f.size > CV_MAX_BYTES) {
      toast.error('El CV no debe superar los 10 MB')
      return
    }
    setArchivo(f)
  }

  async function subirCv(): Promise<string | null> {
    if (!archivo) return cvPath || null
    const supabase = createClient()
    const path = `${vacanteId}/${crypto.randomUUID()}-${sanitize(archivo.name)}`
    const { error } = await supabase.storage.from('reclutamiento').upload(path, archivo, {
      contentType: archivo.type,
      upsert: false,
    })
    if (error) {
      toast.error('Error al subir el CV')
      return null
    }
    return path
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!vacanteId) { toast.error('Selecciona una vacante'); return }
    if (nombre.trim().length < 2) { toast.error('El nombre debe tener al menos 2 caracteres'); return }
    if (requiereMotivo && !motivoDescarte) { toast.error('Indica el motivo del descarte'); return }

    setLoading(true)

    let finalPath: string | null = cvPath || null
    if (archivo) {
      finalPath = await subirCv()
      if (finalPath === null) { setLoading(false); return }
    }

    const payload = {
      vacante_id: vacanteId,
      nombre: nombre.trim(),
      email,
      telefono,
      fuente: fuente || null,
      etapa,
      revision_cv: revisionCv || null,
      motivo_descarte: requiereMotivo ? (motivoDescarte || null) : null,
      cv_storage_path: finalPath ?? '',
      notas,
    }

    const result = isEdit
      ? await actualizarCandidato(initialData!.id, payload)
      : await crearCandidato(payload)

    if (result.ok) {
      toast.success(isEdit ? 'Candidato actualizado' : 'Candidato registrado')
      router.push(`/reclutamiento/candidatos?vacante=${vacanteId}`)
      router.refresh()
    } else {
      toast.error(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      {/* Datos del candidato */}
      <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label required>Nombre completo</Label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del candidato" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Correo</Label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Teléfono</Label>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="10 dígitos" className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label required>Vacante</Label>
            <select value={vacanteId} onChange={e => setVacanteId(e.target.value)} className={selectClass}>
              {vacantes.map(v => (
                <option key={v.id} value={v.id}>{v.titulo}{v.estado === 'cerrada' ? ' (cerrada)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Fuente</Label>
            <select value={fuente} onChange={e => setFuente(e.target.value)} className={selectClass}>
              <option value="">Sin especificar</option>
              {FUENTES.map(f => <option key={f} value={f}>{FUENTE_LABEL[f]}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Etapa</Label>
            <select value={etapa} onChange={e => setEtapa(e.target.value as RecEtapa)} className={selectClass}>
              {ETAPAS.map(et => <option key={et} value={et}>{ETAPA_LABEL[et]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Revisión de CV */}
      <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-4">
        <p className="text-[11px] uppercase tracking-[0.4px] font-semibold text-ink-400">Revisión de CV</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Resultado de la revisión</Label>
            <select
              value={revisionCv}
              onChange={e => {
                const v = e.target.value
                setRevisionCv(v)
                if (v !== 'no_viable' && etapa !== 'descartado') setMotivoDescarte('')
              }}
              className={selectClass}
            >
              <option value="">Sin revisar</option>
              {REVISIONES_CV.map(r => <option key={r} value={r}>{REVISION_CV_LABEL[r]}</option>)}
            </select>
          </div>

          {requiereMotivo && (
            <div className="flex flex-col gap-1.5">
              <Label required>Motivo del descarte</Label>
              <select value={motivoDescarte} onChange={e => setMotivoDescarte(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                {MOTIVOS_DESCARTE.map(m => <option key={m} value={m}>{MOTIVO_DESCARTE_LABEL[m]}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Carga de CV */}
        <div className="flex flex-col gap-1.5">
          <Label>Curriculum (PDF, DOC o DOCX · máx. 10 MB)</Label>
          {archivo ? (
            <div className="flex items-center justify-between border border-[#ECECEC] rounded px-3 py-2">
              <span className="flex items-center gap-2 text-[12.5px] text-ink-700 min-w-0">
                <FileText size={14} className="shrink-0 text-ink-400" />
                <span className="truncate">{archivo.name}</span>
              </span>
              <button type="button" onClick={() => setArchivo(null)} className="text-ink-300 hover:text-red-400 transition-colors p-1">
                <X size={14} />
              </button>
            </div>
          ) : cvPath ? (
            <div className="flex items-center justify-between border border-[#ECECEC] rounded px-3 py-2">
              <span className="flex items-center gap-2 text-[12.5px] text-ink-700 min-w-0">
                <FileText size={14} className="shrink-0 text-ink-400" />
                <span className="truncate">CV cargado</span>
              </span>
              <button type="button" onClick={() => setCvPath('')} className="text-ink-300 hover:text-red-400 transition-colors p-1" title="Quitar CV">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 border-2 border-dashed border-[#DCDCDC] hover:border-[#BBBBBB] rounded px-3 py-3 text-[12.5px] text-ink-500 cursor-pointer transition-colors">
              <Upload size={14} className="text-ink-400" />
              Selecciona el archivo del CV
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={e => onSelectFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Notas</Label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} placeholder="Observaciones internas..." className={`${inputClass} resize-y`} />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-5 py-[8px] transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar candidato'}
        </button>
        <button type="button" onClick={() => router.back()} disabled={loading} className="border border-[#ECECEC] text-ink-700 text-[12.5px] font-medium rounded px-5 py-[8px] hover:bg-surface-hover transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}
