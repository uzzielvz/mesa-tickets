import { z } from 'zod'

export const newTicketSchema = z.object({
  area_id: z.string().uuid('Selecciona un área'),
  problem_catalog_id: z.string().uuid('Selecciona un tipo de problema'),
  grupo: z.string().optional(),
  cliente: z.string().optional(),
  ciclo_cliente: z.string().optional(),
  comentario: z.string().min(10, 'El comentario debe tener al menos 10 caracteres'),
})

export type NewTicketInput = z.infer<typeof newTicketSchema>

export const responseSchema = z.object({
  contenido: z.string().min(1, 'Escribe una respuesta'),
})

export type ResponseInput = z.infer<typeof responseSchema>
