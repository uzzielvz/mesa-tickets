'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { descifrar } from '@/lib/google/crypto'
import { accessTokenDesdeRefresh, crearEventoMeet, enviarCorreo } from '@/lib/google/client'
import {
  agendarSesionSchema,
  calcularCascada,
  type BloqueCascada,
} from '@/lib/schemas/reclutamiento'
import type { RecPlantillaCodigo } from '@/lib/supabase/types'

// REC-030 — Agendamiento masivo de entrevistas Fase 2.
// Por cada candidato seleccionado: crea el evento de Calendar con liga de Meet
// (invita al candidato y a los 3 entrevistadores), envía el correo de
// confirmación, registra la entrevista y transiciona la etapa. Al final envía
// la agenda consolidada a los entrevistadores. Todo queda en bitácora.

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

export interface ResultadoCandidato {
  candidatoId: string
  nombre: string
  horario: string // '09:00–10:00'
  meetUrl: string | null
  evento: boolean
  correo: boolean
  transicion: boolean
  error: string | null
}

interface Candidato {
  id: string
  nombre: string
  email: string | null
  etapa: string
  cv_storage_path: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Reemplaza {{placeholder}} en asunto/cuerpo de plantilla.
function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`)
}

// Cuerpo de plantilla (texto plano) → HTML simple para Gmail.
function aHtml(texto: string): string {
  return texto
    .split('\n')
    .map(l => (l.trim().startsWith('*') ? `&bull;${escapeHtml(l.trim().slice(1))}` : escapeHtml(l)))
    .join('<br>')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Content-Type del adjunto según la extensión del CV.
function tipoPorNombre(path: string): string {
  const ext = path.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

// Nombre de archivo seguro (sin acentos ni caracteres raros) para el header MIME.
function nombreArchivoSeguro(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\- ]/g, '').trim()
}

// '2026-06-24' → 'miércoles 24 de junio de 2026' (sin sorpresas de zona horaria).
function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d)
}

// ── Acción principal ─────────────────────────────────────────────────────────

export async function agendarSesion(raw: unknown): Promise<Result<{
  sesionId: string
  resultados: ResultadoCandidato[]
  agendaEnviada: boolean
  agendaError: string | null
}>> {
  const parsed = agendarSesionSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // 1) Credencial de Google (la cuenta emisora más reciente).
  const { data: cred } = await supabase
    .from('rec_credenciales_google')
    .select('refresh_token')
    .order('actualizado_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cred) return { ok: false, error: 'Conecta una cuenta de Google antes de agendar.' }

  let accessToken: string
  try {
    accessToken = await accessTokenDesdeRefresh(descifrar((cred as { refresh_token: string }).refresh_token))
  } catch {
    return { ok: false, error: 'La conexión con Google expiró. Reconecta la cuenta e intenta de nuevo.' }
  }

  // 2) Vacante, candidatos y plantillas.
  const { data: vacante } = await supabase
    .from('rec_vacantes')
    .select('titulo')
    .eq('id', d.vacante_id)
    .single()
  if (!vacante) return { ok: false, error: 'La vacante no existe.' }
  const tituloVacante = (vacante as { titulo: string }).titulo

  const { data: candidatosData } = await supabase
    .from('rec_candidatos')
    .select('id, nombre, email, etapa, cv_storage_path')
    .in('id', d.candidato_ids)
  const candidatos = (candidatosData ?? []) as Candidato[]

  if (candidatos.length !== d.candidato_ids.length) {
    return { ok: false, error: 'Alguno de los candidatos seleccionados ya no existe.' }
  }
  const sinEmail = candidatos.filter(c => !c.email)
  if (sinEmail.length > 0) {
    return { ok: false, error: `Sin correo registrado: ${sinEmail.map(c => c.nombre).join(', ')}.` }
  }
  // Conserva el orden en que se seleccionaron (define el lugar en la cascada).
  const ordenados = d.candidato_ids.map(id => candidatos.find(c => c.id === id)!)

  const { data: plantillasData } = await supabase
    .from('rec_plantillas_correo')
    .select('codigo, asunto, cuerpo')
    .in('codigo', ['agendamiento_fase2', 'agenda_entrevistadores'])
    .eq('activa', true)
  const plantillas = (plantillasData ?? []) as { codigo: RecPlantillaCodigo; asunto: string; cuerpo: string }[]
  const tplCandidato = plantillas.find(p => p.codigo === 'agendamiento_fase2')
  const tplAgenda = plantillas.find(p => p.codigo === 'agenda_entrevistadores')
  if (!tplCandidato || !tplAgenda) {
    return { ok: false, error: 'Faltan plantillas de correo (agendamiento_fase2 / agenda_entrevistadores).' }
  }

  // 3) Sesión + cascada.
  const cascada = calcularCascada({
    horaInicio: d.hora_inicio,
    numCandidatos: ordenados.length,
    pausaDespuesDe: d.pausa_despues_de,
    pausaMinutos: d.pausa_minutos,
  })
  const fechaTxt = fechaLarga(d.fecha)

  const { data: sesion, error: errSesion } = await supabase
    .from('rec_sesiones_entrevistas')
    .insert({
      vacante_id: d.vacante_id,
      fase: 2,
      fecha: d.fecha,
      hora_inicio: d.hora_inicio,
      pausa_despues_de: d.pausa_despues_de ?? null,
      pausa_minutos: d.pausa_minutos ?? null,
      entrevistadores: d.entrevistadores,
      descripcion: `Cascada Fase 2 — ${tituloVacante} — ${fechaTxt}`,
      creada_por_id: user.id,
    })
    .select('id')
    .single()
  if (errSesion || !sesion) return { ok: false, error: 'No se pudo crear la sesión de entrevistas.' }
  const sesionId = (sesion as { id: string }).id

  const [e1, e2, e3] = d.entrevistadores
  const resultados: ResultadoCandidato[] = []

  // 4) Por candidato: evento Meet → entrevista → correo → transición.
  for (let i = 0; i < ordenados.length; i++) {
    const c = ordenados[i]
    const b: BloqueCascada = cascada[i]
    const r: ResultadoCandidato = {
      candidatoId: c.id,
      nombre: c.nombre,
      horario: `${b.inicio}–${b.fin}`,
      meetUrl: null,
      evento: false,
      correo: false,
      transicion: false,
      error: null,
    }
    resultados.push(r)

    let meetUrl = ''
    let eventId = ''
    try {
      const descripcion = [
        `Entrevista Fase 2 — ${tituloVacante}`,
        `Candidato: ${c.nombre}`,
        '',
        'Rotación de entrevistadores (misma videollamada):',
        `• ${e1.nombre}: ${b.bloques[0]} – ${b.bloques[1]}`,
        `• ${e2.nombre}: ${b.bloques[1]} – ${b.bloques[2]}`,
        `• ${e3.nombre}: ${b.bloques[2]} – ${b.fin}`,
      ].join('\n')
      const ev = await crearEventoMeet(accessToken, {
        titulo: `Entrevista ${tituloVacante} — ${c.nombre}`,
        descripcion,
        inicioIso: `${d.fecha}T${b.inicio}:00`,
        finIso: `${d.fecha}T${b.fin}:00`,
        attendees: [c.email!, e1.email, e2.email, e3.email],
      })
      meetUrl = ev.meetUrl
      eventId = ev.eventId
      r.meetUrl = meetUrl || null
      r.evento = true
    } catch (err) {
      r.error = `Calendar: ${err instanceof Error ? err.message : 'error desconocido'}`
      continue // sin evento no hay liga ni correo; sigue con el siguiente candidato
    }

    await supabase.from('rec_entrevistas').insert({
      sesion_id: sesionId,
      candidato_id: c.id,
      fecha_hora: `${d.fecha}T${b.inicio}:00-06:00`,
      estado: 'programada',
      gcal_event_id: eventId,
      meet_url: meetUrl || null,
    })

    const vars = {
      nombre_candidato: c.nombre,
      vacante: tituloVacante,
      fecha: fechaTxt,
      hora_inicio: b.inicio,
      hora_fin: b.fin,
      link_meet: meetUrl,
      entrevistador_1: e1.nombre, hora_1: b.bloques[0],
      entrevistador_2: e2.nombre, hora_2: b.bloques[1],
      entrevistador_3: e3.nombre, hora_3: b.bloques[2],
    }
    try {
      const correo = await enviarCorreo(accessToken, {
        to: [c.email!],
        subject: render(tplCandidato.asunto, vars),
        html: aHtml(render(tplCandidato.cuerpo, vars)),
      })
      r.correo = true
      await supabase.from('rec_correos_enviados').insert({
        candidato_id: c.id,
        plantilla_codigo: 'agendamiento_fase2',
        to_email: c.email!,
        estado: 'enviado',
        gmail_message_id: correo.messageId,
        gmail_thread_id: correo.threadId,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error desconocido'
      r.error = `Gmail: ${msg}`
      await supabase.from('rec_correos_enviados').insert({
        candidato_id: c.id,
        plantilla_codigo: 'agendamiento_fase2',
        to_email: c.email!,
        estado: 'error',
        error: msg,
      })
    }

    // Transición viable → entrevistas_agendadas (la RPC valida el DAG).
    const { error: errTrans } = await supabase.rpc('rec_transicion_etapa', {
      p_candidato_id: c.id,
      p_etapa_destino: 'entrevistas_agendadas',
      p_motivo_descarte: null,
      p_notas: `Entrevista Fase 2 agendada: ${fechaTxt} ${b.inicio}–${b.fin}`,
    })
    r.transicion = !errTrans
  }

  // 5) Agenda consolidada a los entrevistadores (tabla HTML).
  let agendaEnviada = false
  let agendaError: string | null = null
  const conEvento = resultados.filter(r => r.evento)
  if (conEvento.length > 0) {
    const td = 'style="border:1px solid #ccc;padding:6px 10px;text-align:center"'
    const filas = conEvento.map((r, idx) => {
      const b = cascada[resultados.indexOf(r)]
      return `<tr><td ${td}>${escapeHtml(r.nombre)}</td>` +
        `<td ${td}>${b.bloques[0]}</td><td ${td}>${b.bloques[1]}</td><td ${td}>${b.bloques[2]}</td>` +
        `<td ${td}>${r.meetUrl ? `<a href="${r.meetUrl}">${r.meetUrl}</a>` : '—'}</td></tr>`
    }).join('')
    const tabla =
      `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">` +
      `<tr><th ${td}>Candidato</th><th ${td}>${escapeHtml(e1.nombre)}</th><th ${td}>${escapeHtml(e2.nombre)}</th>` +
      `<th ${td}>${escapeHtml(e3.nombre)}</th><th ${td}>Liga Meet</th></tr>${filas}</table>` +
      (idxPausa(d) ? `<p>${escapeHtml(idxPausa(d)!)}</p>` : '')

    const varsAgenda = {
      nombres_entrevistadores: [e1, e2, e3].map(e => e.nombre).join(', '),
      fecha: fechaTxt,
      vacante: tituloVacante,
      descripcion_sesion:
        `Cada candidato tiene una liga única de Google Meet de 60 minutos y ustedes rotan en la misma ` +
        `videollamada en bloques de 20 minutos, en el orden ${e1.nombre} → ${e2.nombre} → ${e3.nombre}. ` +
        `La primera entrevista inicia a las ${d.hora_inicio}.`,
      tabla_agenda: '__TABLA__',
    }

    // Adjunta el CV de cada candidato agendado que tenga archivo en Storage.
    const adjuntos = []
    for (const r of conEvento) {
      const cand = ordenados.find(c => c.id === r.candidatoId)
      const path = cand?.cv_storage_path
      if (!path) continue
      try {
        const { data: blob } = await supabase.storage.from('reclutamiento').download(path)
        if (!blob) continue
        const buf = Buffer.from(await blob.arrayBuffer())
        const ext = path.toLowerCase().split('.').pop() ?? 'pdf'
        adjuntos.push({
          filename: `CV - ${nombreArchivoSeguro(r.nombre)}.${ext}`,
          mimeType: tipoPorNombre(path),
          contentBase64: buf.toString('base64'),
        })
      } catch {
        // Si un CV no se puede descargar, se omite pero el correo se envía igual.
      }
    }

    try {
      const correo = await enviarCorreo(accessToken, {
        to: [e1.email, e2.email, e3.email],
        subject: render(tplAgenda.asunto, varsAgenda),
        html: aHtml(render(tplAgenda.cuerpo, varsAgenda)).replace('__TABLA__', tabla),
        adjuntos,
      })
      agendaEnviada = true
      for (const e of [e1, e2, e3]) {
        await supabase.from('rec_correos_enviados').insert({
          plantilla_codigo: 'agenda_entrevistadores',
          to_email: e.email,
          estado: 'enviado',
          gmail_message_id: correo.messageId,
          gmail_thread_id: correo.threadId,
        })
      }
    } catch (err) {
      agendaError = err instanceof Error ? err.message : 'error desconocido'
      await supabase.from('rec_correos_enviados').insert({
        plantilla_codigo: 'agenda_entrevistadores',
        to_email: [e1, e2, e3].map(e => e.email).join(', '),
        estado: 'error',
        error: agendaError,
      })
    }
  }

  revalidatePath('/reclutamiento/pipeline')
  revalidatePath('/reclutamiento/candidatos')
  revalidatePath('/reclutamiento/agendar')
  return { ok: true, sesionId, resultados, agendaEnviada, agendaError }
}

// Texto de la pausa para la agenda (si se configuró).
function idxPausa(d: { pausa_despues_de?: number | null; pausa_minutos?: number | null }): string | null {
  if (d.pausa_despues_de == null || d.pausa_minutos == null) return null
  return `Nota: hay una pausa de ${d.pausa_minutos} minutos después del candidato ${d.pausa_despues_de}.`
}
