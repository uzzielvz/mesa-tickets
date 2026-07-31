'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { descifrar } from '@/lib/google/crypto'
import { accessTokenDesdeRefresh, enviarCorreo, crearEventoMeet } from '@/lib/google/client'
import {
  notasComiteSchema, contratarSchema, pasarFinalDgSchema, altaConfigSchema,
  EQUIPO_LABEL,
} from '@/lib/schemas/reclutamiento'
import { leerAjustes } from '@/lib/reclutamiento/ajustes'
import { crearEmpleadoConContrato } from '@/lib/factorial/client'
import type { RecEtapa } from '@/lib/supabase/types'

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

// Orden del DAG de etapas (para encadenar transiciones hacia adelante).
const FORWARD: RecEtapa[] = [
  'postulado', 'en_revision', 'viable', 'entrevistas_agendadas',
  'comite', 'final_dg', 'oferta', 'contratado',
]

const TRANSICION_ERRORES: Record<string, string> = {
  no_auth: 'No autenticado',
  sin_acceso: 'No tienes acceso al módulo de reclutamiento.',
  no_existe: 'El candidato ya no existe.',
  misma_etapa: 'El candidato ya está en esa etapa.',
  motivo_requerido: 'Indica el motivo del descarte.',
  transicion_invalida: 'Esa transición de etapa no está permitida.',
}

// Adjuntos fijos del correo de bienvenida (subidos una vez al bucket).
const ADJUNTOS_BIENVENIDA = [
  { path: 'plantillas/layout-datos-personales.xlsx', filename: 'Layout Datos Personales.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { path: 'plantillas/lineamientos-fotografias.pdf', filename: 'Lineamientos para fotografias.pdf',
    mimeType: 'application/pdf' },
]

function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function aHtml(texto: string): string {
  return texto
    .split('\n')
    .map(l => (l.trim().startsWith('*') ? `&bull;${escapeHtml(l.trim().slice(1))}` : escapeHtml(l)))
    .join('<br>')
}

// '2026-07-09' → 'jueves 9 de julio de 2026' (sin sorpresas de zona horaria).
function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(d)
}

// ── Correo interno de altas ("Altas nuevo ingreso") ──────────────────────────
// Arma destinatarios y líneas de tarea por área a partir de la config de alta.
// Cada tarea solo aparece si su destinatario está definido (y, para sistemas,
// si el sistema fue marcado). Devuelve null si no hay a quién enviar.

interface AltaConfigRow {
  equipo: string[]
  sistemas: string[]
  otros_texto: string | null
  induccion_fecha: string | null
  induccion_meet_url: string | null
  destinatarios: Record<string, string>
}

function construirCorreoAltas(
  cfg: AltaConfigRow,
  cand: { nombre: string; telefono: string | null },
  vacante: { titulo: string; area: string | null },
  fechaIngreso: string,
): { to: string[]; cc: string[]; vars: Record<string, string> } | null {
  const dest = cfg.destinatarios ?? {}
  const val = (k: string) => (dest[k] ?? '').trim()

  // Destinatarios: cada rol operativo va en "para"; cc_adicional en copia.
  const to = [
    val('rh_firmas'), val('correos'), val('induccion'),
    val('alta_yunius'), val('alta_hubspot'), val('jefe_directo'),
  ].filter(Boolean)
  const toUnicos = Array.from(new Set(to))
  const cc = val('cc_adicional') ? [val('cc_adicional')] : []
  if (toUnicos.length === 0) return null

  // Líneas de tarea por área (solo las que aplican según config).
  const tareas: string[] = []
  if (val('rh_firmas')) {
    tareas.push('* Firmas de correo y bienvenida: apoyo con la firma de correo electrónico y la publicación del formato de bienvenida.')
  }
  if (val('correos')) {
    tareas.push('* Correo electrónico: alta del correo institucional del nuevo ingreso.')
  }
  if (val('induccion')) {
    let linea = '* Inducción: impartir el curso de inducción'
    if (cfg.induccion_fecha) linea += ` el ${fechaLarga(cfg.induccion_fecha)}`
    if (cfg.induccion_meet_url) linea += `. Liga: ${cfg.induccion_meet_url}`
    tareas.push(linea + (linea.endsWith('.') ? '' : '.'))
  }
  if (val('jefe_directo')) {
    let linea = `* Jefe directo: conectar a ${cand.nombre} para su inducción a la compañía`
    if (cfg.induccion_meet_url) linea += `. Liga: ${cfg.induccion_meet_url}`
    tareas.push(linea + (linea.endsWith('.') ? '' : '.'))
  }
  if (cfg.sistemas.includes('yunius') && val('alta_yunius')) {
    tareas.push('* Alta Yunius: dar de alta al integrante en Yunius.')
  }
  if (cfg.sistemas.includes('hubspot') && val('alta_hubspot')) {
    tareas.push('* Alta HubSpot: generar usuario y contraseña en la plataforma HubSpot.')
  }
  if (cfg.sistemas.includes('otros') && cfg.otros_texto) {
    tareas.push(`* Otros sistemas (${cfg.otros_texto}): dar de alta al integrante.`)
  }

  const equipoTxt = cfg.equipo.length
    ? cfg.equipo.map(e => EQUIPO_LABEL[e as keyof typeof EQUIPO_LABEL] ?? e).join(', ')
    : '—'

  const vars: Record<string, string> = {
    nombre_candidato: cand.nombre,
    zona: vacante.area?.trim() || '—',
    telefono: cand.telefono?.trim() || '—',
    puesto: vacante.titulo,
    jefe_directo: val('jefe_directo') || '—',
    fecha_ingreso: fechaLarga(fechaIngreso),
    equipo: equipoTxt,
    tareas: tareas.length ? tareas.join('\n') : '* Sin tareas específicas registradas.',
  }
  return { to: toUnicos, cc, vars }
}

// ── Notas del comité ─────────────────────────────────────────────────────────

export async function guardarNotasComite(raw: unknown): Promise<Result> {
  const parsed = notasComiteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const notas = (parsed.data.notas_comite ?? '').trim() || null
  const { error } = await supabase
    .from('rec_candidatos')
    .update({ notas_comite: notas })
    .eq('id', parsed.data.candidato_id)

  if (error) return { ok: false, error: 'No se pudieron guardar las notas del comité.' }

  revalidatePath('/reclutamiento/comite')
  return { ok: true }
}

// ── Entrevista final con la DG: agenda el Meet y manda pase_fase3 ────────────

export async function pasarAFinalDG(raw: unknown): Promise<Result<{ meetUrl: string }>> {
  const parsed = pasarFinalDgSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // 1) Candidato + validaciones.
  const { data: candData } = await supabase
    .from('rec_candidatos')
    .select('id, nombre, email, etapa, vacante_id')
    .eq('id', d.candidato_id)
    .single()
  const cand = candData as
    | { id: string; nombre: string; email: string | null; etapa: RecEtapa; vacante_id: string }
    | null
  if (!cand) return { ok: false, error: 'El candidato ya no existe.' }
  if (!cand.email) return { ok: false, error: 'El candidato no tiene correo registrado.' }
  if (cand.etapa !== 'comite') {
    return { ok: false, error: 'Solo se pasa con la DG desde la etapa de comité.' }
  }

  // 2) Datos de la Dirección General (configurables en /reclutamiento/ajustes).
  // Sin correo no hay a quién invitar: se falla antes de tocar nada.
  const { dg, factorialSyncActiva } = await leerAjustes(supabase)
  if (!dg.email) {
    return {
      ok: false,
      error: 'Falta el correo del Director General. Configúralo en Reclutamiento → Ajustes.',
    }
  }

  // 3) Vacante (para el título del evento) + plantilla pase_fase3.
  const { data: vacData } = await supabase
    .from('rec_vacantes').select('titulo').eq('id', cand.vacante_id).maybeSingle()
  const vacante = (vacData as { titulo: string } | null)?.titulo ?? 'Vacante'

  const { data: tplData } = await supabase
    .from('rec_plantillas_correo')
    .select('asunto, cuerpo')
    .eq('codigo', 'pase_fase3')
    .eq('activa', true)
    .maybeSingle()
  const tpl = tplData as { asunto: string; cuerpo: string } | null
  if (!tpl) return { ok: false, error: 'Falta la plantilla de entrevista final (pase_fase3).' }

  // 4) Credencial de Google.
  const { data: cred } = await supabase
    .from('rec_credenciales_google')
    .select('refresh_token')
    .order('actualizado_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cred) return { ok: false, error: 'Conecta una cuenta de Google antes de pasar con la DG.' }

  let accessToken: string
  try {
    accessToken = await accessTokenDesdeRefresh(descifrar((cred as { refresh_token: string }).refresh_token))
  } catch {
    return { ok: false, error: 'La conexión con Google expiró. Reconecta la cuenta e intenta de nuevo.' }
  }

  // 5) Crea el Meet (candidato + Director General). sendUpdates=all les manda la invitación.
  const [hh, mm] = d.hora.split(':').map(Number)
  const finTotal = hh * 60 + mm + dg.duracion_min
  const finHora = `${String(Math.floor(finTotal / 60) % 24).padStart(2, '0')}:${String(finTotal % 60).padStart(2, '0')}`
  const inicioIso = `${d.fecha}T${d.hora}:00`
  const finIso = `${d.fecha}T${finHora}:00`
  const dgNombre = dg.nombre || 'la Dirección General'
  let meetUrl = ''
  try {
    const ev = await crearEventoMeet(accessToken, {
      titulo: `Entrevista Final (DG) — ${vacante} — ${cand.nombre}`,
      descripcion: `Entrevista final con ${dgNombre} (Dirección General) para la posición de ${vacante}.`,
      inicioIso, finIso,
      attendees: [cand.email, dg.email],
    })
    meetUrl = ev.meetUrl
  } catch {
    return { ok: false, error: 'No se pudo crear el evento de Google Meet. Revisa la conexión e intenta de nuevo.' }
  }

  // 6) Transición comité → final_dg.
  const { error: transErr } = await supabase.rpc('rec_transicion_etapa', {
    p_candidato_id: cand.id,
    p_etapa_destino: 'final_dg',
    p_motivo_descarte: null,
    p_notas: 'Pasa a entrevista final con la DG',
  })
  if (transErr) {
    const code = transErr.message.match(/[a-z_]+/)?.[0] ?? ''
    return { ok: false, error: TRANSICION_ERRORES[code] ?? 'No se pudo mover a entrevista final.' }
  }

  // 7) Persiste fecha/hora y liga del Meet (el admin puede copiarla/reenviarla).
  await supabase.from('rec_candidatos')
    .update({ final_dg_at: inicioIso, final_dg_meet_url: meetUrl })
    .eq('id', cand.id)

  // 8) Envía pase_fase3 al candidato (el DG recibe la invitación de Calendar).
  const vars = { nombre_candidato: cand.nombre, fecha_hora: `${fechaLarga(d.fecha)}, ${d.hora}` }
  try {
    const correo = await enviarCorreo(accessToken, {
      to: [cand.email],
      subject: render(tpl.asunto, vars),
      html: aHtml(render(tpl.cuerpo, vars)),
    })
    await supabase.from('rec_correos_enviados').insert({
      candidato_id: cand.id, plantilla_codigo: 'pase_fase3', to_email: cand.email,
      estado: 'enviado', gmail_message_id: correo.messageId, gmail_thread_id: correo.threadId,
    })
  } catch (err) {
    await supabase.from('rec_correos_enviados').insert({
      candidato_id: cand.id, plantilla_codigo: 'pase_fase3', to_email: cand.email,
      estado: 'error', error: err instanceof Error ? err.message : 'error desconocido',
    })
  }

  revalidatePath('/reclutamiento/comite')
  revalidatePath('/reclutamiento/pipeline')
  return { ok: true, meetUrl }
}

// ── Configuración de alta (etapa 'oferta'): se guarda por candidato ────────────

export async function guardarAltaConfig(raw: unknown): Promise<Result> {
  const parsed = altaConfigSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const { error } = await supabase.from('rec_alta_config').upsert({
    candidato_id: d.candidato_id,
    equipo: d.equipo,
    sistemas: d.sistemas,
    otros_texto: d.otros_texto || null,
    induccion_fecha: d.induccion_fecha || null,
    induccion_meet_url: d.induccion_meet_url || null,
    destinatarios: d.destinatarios,
    actualizado_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: 'No se pudo guardar la configuración de alta.' }

  revalidatePath('/reclutamiento/comite')
  return { ok: true }
}

// ── Contratación: encadena transiciones a "contratado" y manda la bienvenida ──

export async function contratarCandidato(
  raw: unknown,
): Promise<Result<{ correoEnviado: boolean; altasEnviado: boolean; factorialCreado: boolean }>> {
  const parsed = contratarSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // 1) Candidato + validaciones (antes de mutar nada).
  const { data: candData } = await supabase
    .from('rec_candidatos')
    .select('id, nombre, email, telefono, etapa, vacante_id, factorial_employee_id')
    .eq('id', d.candidato_id)
    .single()
  const cand = candData as
    | { id: string; nombre: string; email: string | null; telefono: string | null; etapa: RecEtapa; vacante_id: string; factorial_employee_id: string | null }
    | null
  if (!cand) return { ok: false, error: 'El candidato ya no existe.' }
  if (!cand.email) return { ok: false, error: 'El candidato no tiene correo registrado.' }

  const idx = FORWARD.indexOf(cand.etapa)
  const target = FORWARD.indexOf('contratado')
  if (idx < 0 || cand.etapa === 'contratado' || cand.etapa === 'descartado') {
    return { ok: false, error: 'El candidato no está en una etapa desde la que se pueda contratar.' }
  }

  // 2) Plantilla del correo.
  const { data: tplData } = await supabase
    .from('rec_plantillas_correo')
    .select('asunto, cuerpo')
    .eq('codigo', 'bienvenida_contratacion')
    .eq('activa', true)
    .maybeSingle()
  const tpl = tplData as { asunto: string; cuerpo: string } | null
  if (!tpl) return { ok: false, error: 'Falta la plantilla de bienvenida (bienvenida_contratacion).' }

  // 3) Credencial de Google (cuenta emisora más reciente).
  const { data: cred } = await supabase
    .from('rec_credenciales_google')
    .select('refresh_token')
    .order('actualizado_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cred) return { ok: false, error: 'Conecta una cuenta de Google antes de contratar.' }

  let accessToken: string
  try {
    accessToken = await accessTokenDesdeRefresh(descifrar((cred as { refresh_token: string }).refresh_token))
  } catch {
    return { ok: false, error: 'La conexión con Google expiró. Reconecta la cuenta e intenta de nuevo.' }
  }

  // 4) Encadena las transiciones del DAG hasta "contratado".
  for (let i = idx + 1; i <= target; i++) {
    const { error } = await supabase.rpc('rec_transicion_etapa', {
      p_candidato_id: cand.id,
      p_etapa_destino: FORWARD[i],
      p_motivo_descarte: null,
      p_notas: 'Contratación',
    })
    if (error) {
      const code = error.message.match(/[a-z_]+/)?.[0] ?? ''
      return { ok: false, error: TRANSICION_ERRORES[code] ?? 'No se pudo completar la contratación.' }
    }
  }

  // 5) Fecha de ingreso.
  await supabase.from('rec_candidatos').update({ fecha_ingreso: d.fecha_ingreso }).eq('id', cand.id)

  // 6) Adjuntos fijos (best-effort: si alguno falla, el correo se manda igual).
  const adjuntos = []
  for (const a of ADJUNTOS_BIENVENIDA) {
    try {
      const { data: blob } = await supabase.storage.from('reclutamiento').download(a.path)
      if (!blob) continue
      const buf = Buffer.from(await blob.arrayBuffer())
      adjuntos.push({ filename: a.filename, mimeType: a.mimeType, contentBase64: buf.toString('base64') })
    } catch {
      // Adjunto no disponible en Storage; se omite.
    }
  }

  // 7) Envía el correo de bienvenida (CC configurable).
  const vars = {
    nombre_candidato: cand.nombre,
    fecha_ingreso: fechaLarga(d.fecha_ingreso),
    fecha_limite_docs: fechaLarga(d.fecha_limite_docs),
  }
  let correoEnviado = false
  try {
    const correo = await enviarCorreo(accessToken, {
      to: [cand.email],
      cc: d.cc_emails,
      subject: render(tpl.asunto, vars),
      html: aHtml(render(tpl.cuerpo, vars)),
      adjuntos,
    })
    correoEnviado = true
    await supabase.from('rec_correos_enviados').insert({
      candidato_id: cand.id,
      plantilla_codigo: 'bienvenida_contratacion',
      to_email: cand.email,
      estado: 'enviado',
      gmail_message_id: correo.messageId,
      gmail_thread_id: correo.threadId,
    })
  } catch (err) {
    await supabase.from('rec_correos_enviados').insert({
      candidato_id: cand.id,
      plantilla_codigo: 'bienvenida_contratacion',
      to_email: cand.email,
      estado: 'error',
      error: err instanceof Error ? err.message : 'error desconocido',
    })
  }

  // 8) Correo interno "Altas nuevo ingreso" a las áreas (según config de alta).
  const altasEnviado = await enviarCorreoAltas(supabase, accessToken, cand, d.fecha_ingreso)

  // 9) Alta del empleado en Factorial HR (best-effort, idempotente).
  //    Solo si la sincronización está activa en Ajustes; si ya tiene
  //    factorial_employee_id tampoco se vuelve a crear.
  const factorialCreado = factorialSyncActiva
    ? await altaEnFactorial(supabase, cand, d)
    : false

  revalidatePath('/reclutamiento/comite')
  revalidatePath('/reclutamiento/pipeline')
  return { ok: true, correoEnviado, altasEnviado, factorialCreado }
}

// Crea el empleado en Factorial y persiste su id. Best-effort: nunca tumba la
// contratación (si falla, se puede reintentar y la idempotencia evita duplicados).
// Devuelve true solo si se creó ahora (false si ya existía o si falló).
async function altaEnFactorial(
  supabase: ReturnType<typeof createClient>,
  cand: { id: string; email: string | null; telefono: string | null; factorial_employee_id: string | null },
  datos: { first_name: string; last_name: string; fecha_ingreso: string },
): Promise<boolean> {
  if (cand.factorial_employee_id) return false // ya dado de alta
  if (!cand.email) return false // sin email personal no se puede crear

  try {
    const { id } = await crearEmpleadoConContrato({
      firstName: datos.first_name,
      lastName: datos.last_name,
      email: cand.email,
      contractStartsOn: datos.fecha_ingreso,
      phoneNumber: cand.telefono ?? undefined,
    })
    await supabase.from('rec_candidatos')
      .update({ factorial_employee_id: id })
      .eq('id', cand.id)
    return true
  } catch {
    // Alta fallida: no se persiste id, se puede reintentar más tarde.
    return false
  }
}

// Manda el correo interno de altas. Best-effort: nunca tumba la contratación.
// Devuelve true solo si se envió (hay config, destinatarios y plantilla).
async function enviarCorreoAltas(
  supabase: ReturnType<typeof createClient>,
  accessToken: string,
  cand: { id: string; nombre: string; telefono: string | null; vacante_id: string },
  fechaIngreso: string,
): Promise<boolean> {
  const { data: cfgData } = await supabase
    .from('rec_alta_config')
    .select('equipo, sistemas, otros_texto, induccion_fecha, induccion_meet_url, destinatarios')
    .eq('candidato_id', cand.id)
    .maybeSingle()
  const cfg = cfgData as AltaConfigRow | null
  if (!cfg) return false

  const { data: vacData } = await supabase
    .from('rec_vacantes').select('titulo, area').eq('id', cand.vacante_id).maybeSingle()
  const vacante = (vacData as { titulo: string; area: string | null } | null) ?? { titulo: 'Vacante', area: null }

  const armado = construirCorreoAltas(cfg, cand, vacante, fechaIngreso)
  if (!armado) return false

  const { data: tplData } = await supabase
    .from('rec_plantillas_correo')
    .select('asunto, cuerpo, cc_emails')
    .eq('codigo', 'altas_nuevos_ingresos')
    .eq('activa', true)
    .maybeSingle()
  const tpl = tplData as { asunto: string; cuerpo: string; cc_emails: string[] | null } | null
  if (!tpl) return false

  const cc = Array.from(new Set([...armado.cc, ...(tpl.cc_emails ?? [])]))
  try {
    const correo = await enviarCorreo(accessToken, {
      to: armado.to,
      cc,
      subject: render(tpl.asunto, armado.vars),
      html: aHtml(render(tpl.cuerpo, armado.vars)),
    })
    await supabase.from('rec_correos_enviados').insert({
      candidato_id: cand.id, plantilla_codigo: 'altas_nuevos_ingresos', to_email: armado.to[0],
      estado: 'enviado', gmail_message_id: correo.messageId, gmail_thread_id: correo.threadId,
    })
    return true
  } catch (err) {
    await supabase.from('rec_correos_enviados').insert({
      candidato_id: cand.id, plantilla_codigo: 'altas_nuevos_ingresos', to_email: armado.to[0],
      estado: 'error', error: err instanceof Error ? err.message : 'error desconocido',
    })
    return false
  }
}
