import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type ToolCallInfo = { name: string; args: Record<string, string | number | undefined> }
type ToolName =
  | 'cartera_resumen'
  | 'cartera_por_coordinacion'
  | 'cartera_por_recuperador'
  | 'cartera_mora_operativa'

// ── Definición de herramientas ────────────────────────────────────────────────
// Cuando integres un LLM, pasa TOOLS al proveedor:
//   Anthropic: client.messages.create({ tools: TOOLS, tool_choice: { type: 'auto' }, ... })
//   OpenAI:    client.chat.completions.create({ tools: TOOLS.map(adaptOpenAI), ... })
export const TOOLS = [
  {
    name: 'cartera_resumen' as const,
    description:
      'Resumen ejecutivo de cartera: totales, PAR 30, PAR 90 e indicadores globales. ' +
      'Usar para preguntas sobre el estado general, cartera total, mora global o indicadores.',
    input_schema: {
      type: 'object',
      required: ['p_fecha_corte'],
      properties: {
        p_fecha_corte: { type: 'string', description: 'Fecha de corte YYYY-MM-DD' },
        p_coordinacion: { type: 'string', description: 'Coordinación a filtrar (opcional)' },
        p_codigo_recuperador: { type: 'string', description: 'Código de recuperador a filtrar (opcional)' },
      },
    },
  },
  {
    name: 'cartera_por_coordinacion' as const,
    description:
      'Desglose de cartera agrupado por coordinación o zona: créditos, totales y PAR por área. ' +
      'Usar para comparar coordinaciones o ver ranking de mora.',
    input_schema: {
      type: 'object',
      required: ['p_fecha_corte'],
      properties: {
        p_fecha_corte: { type: 'string', description: 'Fecha de corte YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'cartera_por_recuperador' as const,
    description:
      'Desglose de cartera por recuperador o promotor individual. ' +
      'Usar cuando pregunten por desempeño de recuperadores.',
    input_schema: {
      type: 'object',
      required: ['p_fecha_corte'],
      properties: {
        p_fecha_corte: { type: 'string', description: 'Fecha de corte YYYY-MM-DD' },
        p_coordinacion: { type: 'string', description: 'Filtrar por coordinación (opcional)' },
      },
    },
  },
  {
    name: 'cartera_mora_operativa' as const,
    description:
      'Lista de créditos individuales en mora. ' +
      'Usar para preguntas sobre deudores, cobranza o créditos vencidos.',
    input_schema: {
      type: 'object',
      required: ['p_fecha_corte'],
      properties: {
        p_fecha_corte: { type: 'string', description: 'Fecha de corte YYYY-MM-DD' },
        p_coordinacion: { type: 'string', description: 'Filtrar por coordinación (opcional)' },
        p_dias_min: { type: 'number', description: 'Días mínimos de mora (default 1)' },
      },
    },
  },
]

// ── Helpers de formato ────────────────────────────────────────────────────────
const fmtMXN = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)
const fmtNum = (n: number) => new Intl.NumberFormat('es-MX').format(n)
const fmtPct = (n: number) => `${n.toFixed(2)}%`

function formatResumen(data: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  const t = d?.totales
  const ind = d?.indicadores
  if (!t) return 'No hay datos de cartera para esta fecha.'

  const lines = [
    `Resumen de cartera — corte ${d.fecha_corte}`,
    '',
    `Cartera total:     ${fmtMXN(t.cartera_total)}`,
    `Créditos activos:  ${fmtNum(t.creditos)}`,
    `Créditos en mora:  ${fmtNum(t.creditos_en_mora)} (${fmtPct(t.pct_mora)})`,
    `Cartera en mora:   ${fmtMXN(t.cartera_en_mora)}`,
    '',
    `Indicadores:`,
    `  PAR 30:  ${fmtPct(ind?.pct_par_30 ?? 0)}`,
    `  PAR 90:  ${fmtPct(ind?.pct_par_90 ?? 0)}`,
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bucketsConMora = ((d?.par ?? []) as any[]).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b: any) => b.creditos > 0 && b.dias_min > 0
  )
  if (bucketsConMora.length > 0) {
    lines.push('', 'Desglose por antigüedad de mora:')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of bucketsConMora as any[]) {
      lines.push(`  ${b.label}: ${fmtNum(b.creditos)} créditos — ${fmtMXN(b.saldo)} (${fmtPct(b.pct_saldo)})`)
    }
  }

  return lines.join('\n')
}

function formatPorCoordinacion(data: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coords = (d?.coordinaciones ?? []) as any[]
  if (!coords.length) return 'No hay datos de coordinaciones para esta fecha.'

  const sorted = [...coords].sort((a, b) => b.pct_par_30 - a.pct_par_30)

  const lines = [
    `Cartera por coordinación — ${d.fecha_corte}`,
    `${coords.length} coordinaciones (ordenadas por PAR 30 descendente)`,
    '',
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of sorted as any[]) {
    lines.push(`${c.coordinacion}`)
    lines.push(`  Créditos: ${fmtNum(c.creditos)}  |  Cartera: ${fmtMXN(c.cartera_total)}`)
    lines.push(`  PAR 30: ${fmtPct(c.pct_par_30)}  |  PAR 90: ${fmtPct(c.pct_par_90)}  |  Mora: ${fmtPct(c.pct_mora)}`)
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

function formatPorRecuperador(data: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recs = (d?.recuperadores ?? []) as any[]
  if (!recs.length) return 'No hay datos de recuperadores para esta fecha.'

  const sorted = [...recs].sort((a, b) => b.pct_par_30 - a.pct_par_30)
  const top = sorted.slice(0, 8)

  const lines = [
    `Cartera por recuperador — ${d.fecha_corte}`,
    d.coordinacion ? `Coordinación: ${d.coordinacion}` : `Todas las coordinaciones`,
    `Total recuperadores: ${fmtNum(recs.length)}`,
    '',
    recs.length > 8 ? `Top 8 con mayor PAR 30:` : `Recuperadores:`,
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of top as any[]) {
    const nombre = r.nombre ?? r.codigo ?? '—'
    lines.push(`${nombre} (${r.coordinacion})`)
    lines.push(`  Créditos: ${fmtNum(r.creditos)}  |  Cartera: ${fmtMXN(r.cartera_total)}`)
    lines.push(`  PAR 30: ${fmtPct(r.pct_par_30)}  |  Mora: ${fmtPct(r.pct_mora)}`)
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

function formatMoraOperativa(data: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creditos = (d?.creditos ?? []) as any[]

  if (!creditos.length) {
    const diasLabel = d?.dias_min > 1 ? ` de más de ${d.dias_min} días` : ''
    return `No hay créditos en mora${diasLabel} para este corte.`
  }

  const saldoTotal = creditos.reduce((s: number, c: { saldo_vencido?: number }) => s + (c.saldo_vencido ?? 0), 0)
  const sorted = [...creditos].sort(
    (a: { dias_mora: number }, b: { dias_mora: number }) => b.dias_mora - a.dias_mora
  )

  const lines = [
    `Bandeja de mora — ${d.fecha_corte}`,
    d.coordinacion ? `Coordinación: ${d.coordinacion}` : `Todas las coordinaciones`,
    '',
    `Créditos en mora:   ${fmtNum(creditos.length)}`,
    `Saldo vencido total: ${fmtMXN(saldoTotal)}`,
    '',
    sorted.length > 5 ? `Los 5 créditos con más días de mora:` : `Créditos en mora:`,
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (sorted.slice(0, 5) as any[])) {
    const nombre = c.nombre_acreditado ?? c.codigo_acreditado ?? '—'
    lines.push(`${nombre}`)
    lines.push(`  Coordinación: ${c.coordinacion}  |  Recuperador: ${c.nombre_recuperador ?? c.codigo_recuperador ?? '—'}`)
    lines.push(`  Días de mora: ${c.dias_mora}  |  Saldo vencido: ${fmtMXN(c.saldo_vencido ?? 0)}`)
    lines.push('')
  }

  if (creditos.length > 5) {
    lines.push(`… y ${fmtNum(creditos.length - 5)} crédito(s) más.`)
  }

  return lines.join('\n').trimEnd()
}

// ── Ejecutor de herramientas contra los RPCs de Supabase ──────────────────────
async function executeTool(name: ToolName, args: Record<string, string | number | undefined>) {
  const supabase = createClient()
  switch (name) {
    case 'cartera_resumen':
      return supabase.rpc('cartera_resumen', {
        p_fecha_corte: args.p_fecha_corte as string,
        p_coordinacion: (args.p_coordinacion as string) || undefined,
        p_codigo_recuperador: (args.p_codigo_recuperador as string) || undefined,
      })
    case 'cartera_por_coordinacion':
      return supabase.rpc('cartera_por_coordinacion', {
        p_fecha_corte: args.p_fecha_corte as string,
      })
    case 'cartera_por_recuperador':
      return supabase.rpc('cartera_por_recuperador', {
        p_fecha_corte: args.p_fecha_corte as string,
        p_coordinacion: (args.p_coordinacion as string) || undefined,
      })
    case 'cartera_mora_operativa':
      return supabase.rpc('cartera_mora_operativa', {
        p_fecha_corte: args.p_fecha_corte as string,
        p_coordinacion: (args.p_coordinacion as string) || undefined,
        p_dias_min: (args.p_dias_min as number) || 1,
      })
  }
}

function formatResult(name: ToolName, data: unknown): string {
  switch (name) {
    case 'cartera_resumen':       return formatResumen(data)
    case 'cartera_por_coordinacion': return formatPorCoordinacion(data)
    case 'cartera_por_recuperador':  return formatPorRecuperador(data)
    case 'cartera_mora_operativa':   return formatMoraOperativa(data)
  }
}

// ── Slot de proveedor LLM ─────────────────────────────────────────────────────
// Reemplaza el stub cuando elijas el proveedor:
//
//   Anthropic → npm install @anthropic-ai/sdk   + ANTHROPIC_API_KEY en .env.local
//   OpenAI    → npm install openai              + OPENAI_API_KEY en .env.local
//
// El stub selecciona la herramienta por palabras clave y llama el RPC directamente.
// Con un LLM real: el modelo decide qué herramienta(s) llamar y redacta la respuesta.

function pickTool(message: string): ToolName {
  const m = message.toLowerCase()
  if (/mora|venci|cobr|atrasa|deudor|impag|pendiente/.test(m)) return 'cartera_mora_operativa'
  if (/coordinac|regional|zona|area|sucursal/.test(m))           return 'cartera_por_coordinacion'
  if (/recuperador|promotor|ejecutivo|asesor|individual/.test(m)) return 'cartera_por_recuperador'
  return 'cartera_resumen'
}

async function callLLM(
  messages: ChatMessage[],
  fechaCorte: string,
): Promise<{ reply: string; toolCalls: ToolCallInfo[] }> {
  // ── STUB: borrar desde aquí hasta STUB_END cuando agregues un LLM real ───────
  const lastMessage = messages[messages.length - 1].content
  const toolName = pickTool(lastMessage)
  const args: Record<string, string | number | undefined> = { p_fecha_corte: fechaCorte }

  const { data, error } = await executeTool(toolName, args)
  if (error) {
    const msg = (error as { message?: string }).message ?? 'Error desconocido'
    return { reply: `No pude consultar los datos: ${msg}`, toolCalls: [] }
  }

  return {
    reply: formatResult(toolName, data),
    toolCalls: [{ name: toolName, args }],
  }
  // ── STUB_END ──────────────────────────────────────────────────────────────────
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const messages: ChatMessage[] = body.messages ?? []
  const fechaCorte: string = body.fecha_corte ?? ''

  if (!messages.length || !fechaCorte) {
    return NextResponse.json({ error: 'Campos requeridos: messages, fecha_corte' }, { status: 400 })
  }

  const { reply, toolCalls } = await callLLM(messages, fechaCorte)
  return NextResponse.json({ reply, toolCalls })
}
