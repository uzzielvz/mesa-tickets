import { z } from 'zod'
import type { ProblemField } from '@/lib/supabase/types'

// Schema básico para el comentario inicial. Los demás campos del
// ticket viajan en `datos` y se validan dinámicamente con buildDatosSchema.
export const newTicketSchema = z.object({
  comentario: z.string().min(10, 'El comentario debe tener al menos 10 caracteres'),
})

export type NewTicketInput = z.infer<typeof newTicketSchema>

export const responseSchema = z.object({
  contenido: z.string().min(1, 'Escribe una respuesta'),
})

export type ResponseInput = z.infer<typeof responseSchema>

// Construye un validador para el objeto `datos` de un ticket
// a partir de la definición de campos del problema seleccionado.
export function buildDatosSchema(campos: ProblemField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const c of campos) {
    let v: z.ZodTypeAny = z.string()
    if (c.required) {
      v = (v as z.ZodString).min(1, `${c.label} es obligatorio`)
    } else {
      v = v.optional()
    }
    if (c.type === 'number' && c.required) {
      v = z.string().refine(s => s !== '' && !Number.isNaN(Number(s)), {
        message: `${c.label} debe ser numérico`,
      })
    }
    shape[c.key] = v
  }
  return z.object(shape)
}

// Genera un slug válido para usar como `key` de un campo dinámico.
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}
