import { z } from 'zod'

export const referenciaSchema = z.object({
  calidad: z.enum(['Excelente', 'Buena', 'Regular']),
  nombre_referencia: z.string().optional(),
})

export const acreditadoSchema = z.object({
  clave: z.string().regex(/^[A-Za-z0-9]{6}$/, 'Exactamente 6 caracteres alfanuméricos'),
  nombre_completo: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(120, 'Máximo 120 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.]+$/, 'Solo letras y espacios'),
  ciclo: z.string().regex(/^[0-9]{2}$/, 'Debe ser 2 dígitos, ej. 01'),
  fecha_nacimiento: z.string().min(1, 'Requerido'),
  tiempo_residencia: z.coerce.number().min(0, 'Mínimo 0'),
  antiguedad_negocio: z.coerce.number().min(0, 'Mínimo 0'),
  dependientes: z.coerce.number().int().min(0, 'Mínimo 0'),
  antiguedad_telefono: z.coerce.number().min(0, 'Mínimo 0'),
  cuenta_banco: z.coerce.number().min(0, 'Mínimo 0'),
  casa_habitacion: z.enum(['Propia', 'Familiar', 'Rentada'], { message: 'Selecciona una opción' }),
  estado_civil: z.enum(['Casado', 'Union libre', 'Viudo', 'Soltero', 'Divorciado'], { message: 'Selecciona una opción' }),
  negocio_domicilio: z.boolean(),
  destino_credito: z.enum(['Capital de trabajo', 'Activo fijo', 'Bienes y servicios de consumo'], { message: 'Selecciona una opción' }),
  automovil_propio: z.boolean(),
  buro_credito: z.enum(['Excelente', 'Buena', 'Regular'], { message: 'Selecciona una opción' }),
  tipo_garantia: z.enum(['Equipo de transporte', 'Ninguna', 'Avales'], { message: 'Selecciona una opción' }),
  tipo_negocio: z.enum(['Fijo', 'Semifijo'], { message: 'Selecciona una opción' }),
  genero: z.enum(['Masculino', 'Femenino'], { message: 'Selecciona una opción' }),
  referencias: z.array(referenciaSchema).min(1, 'Agrega al menos una referencia'),
})

export type AcreditadoInput = z.infer<typeof acreditadoSchema>

export const evaluacionSchema = z.object({
  calificacion_promotor: z.enum(['A', 'B', 'C', 'D'], { message: 'Selecciona una calificación' }),
  justificacion_promotor: z.string().min(10, 'Escribe al menos 10 caracteres de justificación'),
})

export type EvaluacionInput = z.infer<typeof evaluacionSchema>
