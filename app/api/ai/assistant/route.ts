import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { KNOWLEDGE_BASE } from '@/lib/ai/knowledge-base'
import { buildCarteraTools, isMockMode } from '@/lib/ai/tools'

/**
 * Asistente CrediFlexi — agente real (Fase IA-A: AI-001/002/003).
 *
 * - LLM: Gemini (tier de pago) vía Vercel AI SDK, con streaming.
 * - Tools: envuelven los RPCs de cartera existentes, ejecutadas con la sesión
 *   del usuario (los checks de permisos de los RPCs aplican solos).
 * - KB embebida completa en el system prompt (13 chunks — sin RAG todavía).
 * - Guardrail: nunca inventar cifras; todo número sale de una tool.
 */

export const maxDuration = 60

const MODEL_ID = 'gemini-2.5-flash'

// Tarifas Gemini 2.5 Flash (USD por 1M tokens) — ajustar si cambia el pricing oficial.
const PRECIO_INPUT_USD_POR_1M = 0.3
const PRECIO_OUTPUT_USD_POR_1M = 2.5
const USD_A_MXN = 17.5

function buildSystemPrompt(usuario: { nombre: string | null; rol: string | null; accesoCartera: boolean }) {
  const kb = KNOWLEDGE_BASE.map(
    c => `### [${c.dominio}] ${c.titulo}\n${c.contenido}`
  ).join('\n\n')

  return `Eres el **Asistente CrediFlexi**, el asistente interno de Financiera CrediFlexi dentro de la plataforma de Operaciones (mea-tickets).

Tienes dos dominios de experticia:
1. **Empresa / negocio**: cartera, reportes de antigüedad, buckets PAR, mora, el sistema legacy (Excel de 12 hojas), flujo de datos Yunius → plataforma.
2. **Plataforma / uso**: cómo usar los módulos (Cartera, Tickets, Score), dashboards, roles y accesos, flujos de carga.

## Reglas críticas (no negociables)
- **NUNCA inventes cifras de cartera.** Cualquier número (totales, porcentajes, PAR, morosos) debe venir de una tool. Si no llamaste una tool, no des números.
- Toda cifra que reportes debe citar su **fecha de corte** ("al corte 2026-05-30...").
- Si no sabes qué fecha de corte usar, llama primero \`obtenerFechasDisponibles\`; "el último corte" = la fecha más reciente.
- Los datos de mora vienen **seudonimizados** (código de acreditado, sin nombre ni teléfono). Si piden el nombre o contacto de un acreditado, dirige al usuario a /cartera/mora donde puede verlo con sus permisos.
- Si una tool devuelve error de permisos, explica que el módulo Cartera requiere acceso (admin o acceso_cartera) y que se gestiona en /admin/cartera.
- No des asesoría legal ni financiera externa; tu alcance es la operación interna de CrediFlexi.

## Estilo
- Responde **siempre en español**, conciso y operativo.
- Usa Markdown: negritas para cifras clave, listas con guiones, y **tablas pequeñas** (máx ~6 columnas y ~10 filas) cuando compares coordinaciones, buckets o recuperadores — la UI las renderiza bien.
- Sé accionable: además de explicar, di qué hacer y en qué ruta de la plataforma (ej. "ve a /cartera/mora").
- Montos en pesos MXN; usa separador de miles.
- Al final de respuestas con datos, puedes sugerir 1-2 preguntas de seguimiento naturales.

## Usuario actual
- Nombre: ${usuario.nombre ?? 'desconocido'}
- Rol: ${usuario.rol ?? 'usuario'}
- Acceso a cartera: ${usuario.accesoCartera ? 'sí' : 'no'}
${isMockMode() ? `
## MODO DEMOSTRACIÓN ACTIVO
Las tools devuelven DATOS SINTÉTICOS (no son cifras reales de CrediFlexi). Cuando reportes números, aclara brevemente que son "datos de demostración". En producción el asistente se conecta a la cartera real.` : ''}

## Base de conocimiento (fuente de verdad cualitativa)
${kb}`
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()

    // Auth + permisos (mismo guard que el layout de /cartera).
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre_completo, rol, acceso_cartera')
      .eq('id', user.id)
      .single()

    const tieneAcceso = profile?.rol === 'admin' || profile?.acceso_cartera === true
    if (!tieneAcceso) {
      return NextResponse.json({ error: 'Sin acceso al módulo Cartera' }, { status: 403 })
    }

    const { messages }: { messages: UIMessage[] } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Mensajes inválidos' }, { status: 400 })
    }

    const result = streamText({
      model: google(MODEL_ID),
      system: buildSystemPrompt({
        nombre: profile?.nombre_completo ?? null,
        rol: profile?.rol ?? null,
        accesoCartera: profile?.acceso_cartera === true,
      }),
      messages: await convertToModelMessages(messages),
      tools: buildCarteraTools(supabase),
      // Permite varios pasos tool → respuesta (ej. fechas disponibles → resumen → texto).
      stopWhen: stepCountIs(6),
      // Log de consumo real por pregunta (tokens + costo estimado). 'usage' lo reporta el LLM.
      onFinish: ({ usage }) => {
        const inTok = usage?.inputTokens ?? 0
        const outTok = usage?.outputTokens ?? 0
        const totalTok = usage?.totalTokens ?? inTok + outTok
        const costoUsd =
          (inTok / 1_000_000) * PRECIO_INPUT_USD_POR_1M +
          (outTok / 1_000_000) * PRECIO_OUTPUT_USD_POR_1M
        const costoMxn = costoUsd * USD_A_MXN
        console.log(
          `[IA] in: ${inTok} tok | out: ${outTok} tok | total: ${totalTok} tok | ~USD ${costoUsd.toFixed(5)} | ~MXN ${costoMxn.toFixed(4)}`
        )
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error('[AI Assistant] Error:', err)
    return NextResponse.json(
      { error: 'Error procesando tu pregunta. Intenta de nuevo en unos segundos.' },
      { status: 500 }
    )
  }
}
