import { NextRequest, NextResponse } from 'next/server'
import { retrieveRelevant, generateDemoResponse } from '@/lib/ai/knowledge-base'

/**
 * Demo endpoint del Asistente CrediFlexi.
 * 
 * Por ahora es 100% determinístico con knowledge base embebida + retrieval simple.
 * Esto es perfecto para la demo: respuestas consistentes, de alta calidad, con fuentes.
 * 
 * En el futuro:
 * - Se cableará un LLM real (Vercel AI SDK + provider) con system prompt + RAG.
 * - Se agregarán tools para consultar RPCs de cartera en vivo.
 * - Se guardará historial de conversaciones.
 */

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return NextResponse.json({ error: 'Mensaje demasiado corto' }, { status: 400 })
    }

    const query = message.trim()

    // 1. Recuperar chunks relevantes
    const relevant = retrieveRelevant(query, 4)

    // 2. Generar respuesta "inteligente" de demo
    const { answer, sources } = generateDemoResponse(query, relevant)

    // 3. Devolver en formato simple (el cliente puede evolucionar a streaming después)
    // Sugerencias de follow-up (hace que se sienta como un agente)
    const followUps = [
      'Cuéntame más sobre los buckets de PAR',
      'Cómo funciona el flujo de carga completo',
      'Qué dashboards ya están listos para la demo',
      'Diferencia entre el Excel legacy y estos dashboards',
      'Cómo levantar un ticket relacionado a Cartera'
    ].filter(s => !query.toLowerCase().includes(s.toLowerCase().slice(0, 10)))

    return NextResponse.json({
      role: 'assistant',
      content: answer,
      sources: sources.length > 0 ? sources : ['Conocimiento general de la plataforma y operaciones de CrediFlexi'],
      suggestions: followUps.slice(0, 3),
      // metadata útil para debug / futuro
      retrievedChunks: relevant.map(r => ({ id: r.id, titulo: r.titulo, dominio: r.dominio }))
    })
  } catch (err: any) {
    console.error('[AI Assistant] Error:', err)
    return NextResponse.json(
      { error: 'Error procesando tu pregunta. Intenta de nuevo o usa palabras clave más específicas.' },
      { status: 500 }
    )
  }
}
