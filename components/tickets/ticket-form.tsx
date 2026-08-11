'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { notificarTicketNuevo } from '@/lib/actions/tickets'
import type { ProblemField, TicketDatos, TicketPrioridad, TicketModalidad } from '@/lib/supabase/types'

interface Area { id: string; nombre: string }
interface CatalogItem {
  id: string
  area_id: string
  nombre: string
  leyenda: string
  responsable_default_id: string | null
  requiere_evidencia: boolean
  campos: ProblemField[] | null
  prioridad: TicketPrioridad
  sla_min: number | null
  modalidad: TicketModalidad
}

const prioridadBadge: Record<TicketPrioridad, string> = {
  alta: 'bg-red-50 text-red-700 border-red-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  baja: 'bg-gray-100 text-gray-600 border-gray-200',
}
const prioridadLabel: Record<TicketPrioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
const modalidadLabel: Record<TicketModalidad, string> = { remoto: 'Remoto', presencial: 'Presencial', ambas: 'Remoto o presencial' }
const chipClass = 'text-[11px] px-1.5 py-[1px] rounded-full border font-medium'
const slaLabel = (min: number | null) => (min == null ? 'Tiempo variable' : `~${min} min`)

/**
 * Ejemplos concretos de lo que cubre un tipo ("cambio de tinta", "no sirve
 * el escáner"…). Salen de las opciones del primer campo select del catálogo
 * — ahí viven las viñetas del "¿Qué engloba?" — y si el tipo no tiene, de la
 * leyenda. Todo editable en /admin/catalogo, sin desplegar.
 */
function ejemplosDe(item: CatalogItem): string | null {
  const opciones = (item.campos ?? [])
    .find(f => f.type === 'select' && (f.options ?? []).length > 0)
    ?.options
  if (opciones && opciones.length > 0) return opciones.join(' · ')
  return item.leyenda?.trim() || null
}

/** Prioridad, tiempo estimado y modalidad de un tipo de problema. */
function MetaChips({ item }: { item: CatalogItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`${chipClass} ${prioridadBadge[item.prioridad]}`}>
        {prioridadLabel[item.prioridad]}
      </span>
      <span className={`${chipClass} bg-white text-ink-500 border-[#ECECEC]`}>
        {slaLabel(item.sla_min)}
      </span>
      <span className={`${chipClass} bg-white text-ink-500 border-[#ECECEC]`}>
        {modalidadLabel[item.modalidad]}
      </span>
    </div>
  )
}

interface Props {
  areas: Area[]
  catalog: CatalogItem[]
  userId: string
  /** Preselección vía deep-link (ej. desde el asistente: /tickets/nuevo?area=...&tipo=...). */
  initialAreaId?: string
  initialProblemId?: string
}

const inputClass = 'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all'

// Acentos fuera: "camaras" tiene que encontrar "Cámaras".
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Atajos frecuentes, escritos como los dice la gente, no como se llama el
// tipo en el cat\u00e1logo. `tipo` es un fragmento del nombre del tipo (matching
// laxo, sin acentos): si el tipo se renombra o se desactiva, el atajo
// simplemente no se pinta \u2014 nunca un link muerto.
const FRECUENTES: { frase: string; tipo: string }[] = [
  { frase: 'No sirve la impresora o el esc\u00e1ner', tipo: 'impresoras' },
  { frase: 'No tengo acceso a Yunius u otro sistema', tipo: 'usuarios y accesos' },
  { frase: 'No hay internet o la red est\u00e1 lenta', tipo: 'problemas de red' },
  { frase: 'Mi computadora est\u00e1 fallando', tipo: 'soporte a equipo' },
  { frase: 'Necesito ayuda puntual del departamento de TI', tipo: 'servicio de ti' },
  { frase: 'El sistema me marca error', tipo: 'falla en el sistema' },
  { frase: 'La ficha de un cliente no se refleja', tipo: 'ficha no reflejada' },
  { frase: 'La mora de un cliente est\u00e1 mal calculada', tipo: 'error en mora' },
]

export default function TicketForm({ areas, catalog, userId, initialAreaId, initialProblemId }: Props) {
  const router = useRouter()

  // Preselección desde deep-link: solo si el tipo existe, está activo y (si se dio área) le pertenece.
  const initialProblem =
    catalog.find(
      c => c.id === initialProblemId && (!initialAreaId || c.area_id === initialAreaId),
    ) ?? null

  const [selectedProblem, setSelectedProblem] = useState<CatalogItem | null>(initialProblem)
  const [busqueda, setBusqueda] = useState('')
  const [datos, setDatos] = useState<TicketDatos>({})
  const [comentario, setComentario] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(false)

  const [problemError, setProblemError] = useState('')
  const [comentarioError, setComentarioError] = useState('')
  const [evidenciaError, setEvidenciaError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const areaNombre = (id: string) => areas.find(a => a.id === id)?.nombre ?? ''
  const campos: ProblemField[] = selectedProblem?.campos ?? []

  // El usuario describe su síntoma; el área es una consecuencia, no una
  // decisión. Se busca sobre nombre, instrucciones, área y hasta las opciones
  // de los campos select (ahí viven frases como "instalar impresora").
  const q = normalizar(busqueda.trim())
  const visibles = q === ''
    ? catalog
    : catalog.filter(c => {
        const texto = [
          c.nombre,
          c.leyenda,
          areaNombre(c.area_id),
          ...(c.campos ?? []).flatMap(f => f.options ?? []),
        ].join(' ')
        return normalizar(texto).includes(q)
      })

  // Agrupadas por área, en el orden del catálogo de áreas.
  const grupos = areas
    .map(a => ({ area: a, tipos: visibles.filter(c => c.area_id === a.id) }))
    .filter(g => g.tipos.length > 0)

  // Atajos que sí existen en el catálogo activo.
  const frecuentes = FRECUENTES
    .map(f => ({ ...f, item: catalog.find(c => normalizar(c.nombre).includes(normalizar(f.tipo))) }))
    .filter((f): f is typeof f & { item: CatalogItem } => f.item != null)

  function handleProblemChange(problemId: string) {
    const problem = catalog.find(c => c.id === problemId) ?? null
    setSelectedProblem(problem)
    setDatos({})
    setProblemError('')
    setEvidenciaError('')
    setFieldErrors({})
  }

  function setCampo(key: string, value: string) {
    setDatos(d => ({ ...d, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(e => ({ ...e, [key]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProblem) { setProblemError('Selecciona un tipo de problema'); return }

    // Validar campos dinámicos
    const errs: Record<string, string> = {}
    for (const c of campos) {
      const v = (datos[c.key] ?? '').trim()
      if (c.required && !v) {
        errs[c.key] = `${c.label} es obligatorio`
      } else if (v && c.type === 'number' && Number.isNaN(Number(v))) {
        errs[c.key] = `${c.label} debe ser numérico`
      }
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    if (comentario.trim().length < 10) {
      setComentarioError('El comentario debe tener al menos 10 caracteres')
      return
    }
    setComentarioError('')

    if (selectedProblem.requiere_evidencia && (!files || files.length === 0)) {
      setEvidenciaError('Debes adjuntar al menos un archivo de evidencia')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Mapeo de compatibilidad: si los campos dinámicos usan keys
    // reservadas (grupo / cliente / ciclo_cliente), también las
    // escribimos en las columnas legacy para que las vistas y los
    // tickets viejos se sigan viendo igual.
    const grupo = (datos.grupo ?? '').trim() || null
    const cliente = (datos.cliente ?? '').trim() || null
    const ciclo_cliente = (datos.ciclo_cliente ?? '').trim() || null

    // Limpiar datos: solo campos definidos, con trim
    const datosLimpios: TicketDatos = {}
    for (const c of campos) {
      const v = (datos[c.key] ?? '').trim()
      if (v) datosLimpios[c.key] = v
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        problem_catalog_id: selectedProblem.id,
        levantado_por_id: userId,
        // Sin responsable: el ticket nace en la cola de su área y lo toma
        // quien pueda atenderlo (TKT-031). Antes se asignaba al
        // `responsable_default_id` del catálogo o, si el catálogo no tenía
        // uno, a quien levantaba el ticket — que se quedaba atendiéndose solo.
        // El `area_id` lo pone un trigger a partir del tipo de problema.
        grupo,
        cliente,
        ciclo_cliente,
        datos: datosLimpios,
      })
      .select('id, numero')
      .single()

    if (ticketError || !ticket) {
      setLoading(false)
      toast.error(ticketError?.message ?? 'No se pudo crear el ticket')
      return
    }

    // Insertar la primera respuesta y capturar su id para asociar los
    // adjuntos iniciales — así se muestran correctamente en el hilo.
    const { data: firstResponse, error: respError } = await supabase
      .from('ticket_responses')
      .insert({
        ticket_id: ticket.id,
        orden: 1,
        autor_id: userId,
        contenido: comentario.trim(),
        tipo: 'mensaje',
      })
      .select('id')
      .single()

    if (respError || !firstResponse) {
      setLoading(false)
      toast.error('Ticket creado pero falló la primera respuesta. Contacta soporte.')
      return
    }

    if (files && files.length > 0) {
      const results = await Promise.all(Array.from(files).map(async (file) => {
        const path = `${ticket.id}/${Date.now()}-${file.name}`
        const { data: upload, error: upErr } = await supabase.storage
          .from('ticket-attachments')
          .upload(path, file)

        if (upErr || !upload) return { ok: false, name: file.name }

        const { error: attErr } = await supabase.from('ticket_attachments').insert({
          ticket_id: ticket.id,
          response_id: firstResponse.id,
          storage_path: upload.path,
          nombre_original: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by_id: userId,
        })
        return { ok: !attErr, name: file.name }
      }))

      const fallidos = results.filter(r => !r.ok).map(r => r.name)
      if (fallidos.length > 0) {
        toast.error(`No se subieron: ${fallidos.join(', ')}`)
      }
    }

    // Fire-and-forget: el correo al área no puede retrasar la navegación
    // ni convertir un envío fallido en un ticket "fallido".
    void notificarTicketNuevo(ticket.id).catch(() => {})

    toast.success(`Ticket #${ticket.numero} creado`)
    router.push(`/tickets/${ticket.numero}`)
  }

  function renderField(c: ProblemField) {
    const value = datos[c.key] ?? ''
    const err = fieldErrors[c.key]
    const common = {
      id: `f-${c.key}`,
      placeholder: c.placeholder ?? '',
    }

    return (
      <div key={c.key} className="flex flex-col gap-1.5">
        <label htmlFor={common.id} className="text-[12.5px] font-medium text-ink-700">
          {c.label}
          {c.required && <span className="text-red-500"> *</span>}
        </label>
        {c.type === 'textarea' ? (
          <textarea
            {...common}
            value={value}
            rows={3}
            onChange={e => setCampo(c.key, e.target.value)}
            className={`${inputClass} resize-none`}
          />
        ) : c.type === 'select' ? (
          <select
            {...common}
            value={value}
            onChange={e => setCampo(c.key, e.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona...</option>
            {(c.options ?? []).map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={e => setCampo(c.key, e.target.value)}
            className={inputClass}
          />
        )}
        {err && <p className="text-[12px] text-red-600">{err}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
      {/* Un solo paso: el usuario describe su problema, no adivina el
          organigrama. El área es un dato de la tarjeta y el ruteo a la cola
          sale del tipo elegido. */}
      <div className="flex flex-col gap-2">
        <label className="text-[12.5px] font-medium text-ink-700">¿Cuál es el problema?</label>

        {selectedProblem ? (
          // Ya elegido: se colapsa a una tarjeta para que el formulario no crezca de más.
          <div className="border border-orange rounded-md px-3 py-2.5 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-[13px] font-medium text-ink-900">{selectedProblem.nombre}</span>
              <MetaChips item={selectedProblem} />
              <span className="text-[11.5px] text-ink-400">
                Lo atiende {areaNombre(selectedProblem.area_id)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleProblemChange('')}
              className="shrink-0 text-[12px] font-medium text-orange hover:underline"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Busca: impresora, red, accesos, ficha…"
              autoFocus
              className={inputClass}
            />

            {/* Atajos en el lenguaje del usuario. Se ocultan al buscar:
                ahí los resultados ya son la respuesta. */}
            {q === '' && frecuentes.length > 0 && (
              <div className="border border-[#ECECEC] rounded-md px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium mb-1.5">
                  Frecuentes
                </p>
                <div className="flex flex-col gap-1">
                  {frecuentes.map(f => (
                    <button
                      key={f.frase}
                      type="button"
                      onClick={() => handleProblemChange(f.item.id)}
                      className="text-left w-fit text-[12.5px] text-navy hover:text-orange hover:underline transition-colors"
                    >
                      {f.frase}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {grupos.length === 0 ? (
              <div className="border border-[#ECECEC] rounded-md px-4 py-5 text-center">
                <p className="text-[12.5px] text-ink-500">
                  Nada coincide con «{busqueda.trim()}».
                </p>
                <p className="text-[12px] text-ink-400 mt-1">
                  Elige el tipo que más se parezca y explica el detalle en el comentario —
                  el área lo redirige si hace falta.
                </p>
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="mt-2 text-[12px] font-medium text-orange hover:underline"
                >
                  Ver todos los tipos
                </button>
              </div>
            ) : (
              grupos.map(g => (
                <div key={g.area.id} className="flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium mt-1">
                    {g.area.nombre}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.tipos.map(c => {
                      const ejemplos = ejemplosDe(c)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleProblemChange(c.id)}
                          className="text-left bg-white border border-[#ECECEC] rounded-md px-3 py-2.5 flex flex-col gap-1.5 hover:border-orange hover:bg-surface-hover transition-colors"
                        >
                          <span className="text-[13px] font-medium text-ink-900">{c.nombre}</span>
                          {ejemplos && (
                            <span className="text-[11.5px] text-ink-400 leading-snug line-clamp-2">
                              {ejemplos}
                            </span>
                          )}
                          <MetaChips item={c} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {problemError && <p className="text-[12px] text-red-600">{problemError}</p>}
      </div>

      {selectedProblem && (
        <div className="bg-surface-sidebar border border-[#ECECEC] rounded-md px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium mb-1">Instrucciones</p>
          <p className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">{selectedProblem.leyenda}</p>
        </div>
      )}

      {selectedProblem && campos.map(renderField)}

      {selectedProblem && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">Comentario</label>
          <textarea
            value={comentario}
            onChange={e => { setComentario(e.target.value); if (comentarioError) setComentarioError('') }}
            rows={4}
            placeholder="Describe el problema con detalle..."
            className={`${inputClass} resize-none`}
          />
          {comentarioError && <p className="text-[12px] text-red-600">{comentarioError}</p>}
        </div>
      )}

      {selectedProblem && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-ink-700">
            Evidencia {selectedProblem.requiere_evidencia ? <span className="text-red-500">*</span> : <span className="text-ink-400 font-normal">(opcional)</span>}
          </label>
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={e => { setFiles(e.target.files); setEvidenciaError('') }}
            className="text-[12.5px] text-ink-700 file:mr-3 file:py-[5px] file:px-3 file:rounded file:border file:border-[#ECECEC] file:text-[12px] file:font-medium file:text-ink-700 file:bg-white hover:file:bg-surface-hover file:cursor-pointer"
          />
          {evidenciaError && <p className="text-[12px] text-red-600">{evidenciaError}</p>}
        </div>
      )}

      {selectedProblem && (
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Levantar ticket'}
          </button>
        </div>
      )}
    </form>
  )
}
