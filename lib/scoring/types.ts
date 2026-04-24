export interface Referencia {
  calidad: 'Excelente' | 'Buena' | 'Regular'
  nombre_referencia?: string
}

export interface DatosAcreditado {
  fecha_nacimiento: string        // YYYY-MM-DD
  tiempo_residencia: number       // años
  antiguedad_negocio: number      // años
  dependientes: number
  antiguedad_telefono: number     // años
  cuenta_banco: number            // años
  casa_habitacion: string         // Propia / Familiar / Rentada
  estado_civil: string            // Casado / Union libre / Viudo / Soltero / Divorciado
  negocio_domicilio: boolean
  destino_credito: string         // Capital de trabajo / Activo fijo / Bienes y servicios de consumo
  automovil_propio: boolean
  buro_credito: string            // Excelente / Buena / Regular
  tipo_garantia: string           // Equipo de transporte / Ninguna / Avales
  tipo_negocio: string            // Fijo / Semifijo
  genero: string                  // Masculino / Femenino
}

export interface DesgloseLine {
  variable: string
  puntos: number
  maximo: number
}

export interface ScoreResult {
  puntaje: number
  desglose: DesgloseLine[]
}

export interface Clasificacion {
  letra: 'A' | 'B' | 'C' | 'D'
  label: string
  color: string      // text color class
  bg: string         // background class
}
