/**
 * Modelo de Riesgos HM — CrediFlexi
 * Traducción exacta del algoritmo original en Google Apps Script (Code.gs)
 * Función pura: sin efectos secundarios, sin dependencias externas.
 * Puede ejecutarse en servidor (Server Actions) o cliente (preview en tiempo real).
 */

import type { Referencia, DatosAcreditado, DesgloseLine, ScoreResult, Clasificacion } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcularEdad(fechaNac: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

export function promedioReferencias(refs: Referencia[]): number {
  if (!refs || refs.length === 0) return 0
  const factores: Record<string, number> = {
    Excelente: 1.0,
    Buena: 0.6,
    Regular: 0.4,
  }
  const suma = refs.reduce((acc, r) => acc + (factores[r.calidad] ?? 0), 0)
  return suma / refs.length
}

// ─── Algoritmo principal ───────────────────────────────────────────────────────

export function calcularScore(datos: DatosAcreditado, refs: Referencia[]): ScoreResult {
  const refFactor = promedioReferencias(refs)
  const desglose: DesgloseLine[] = []
  let puntaje = 0

  function agregar(variable: string, factor: number, maximo: number) {
    const puntos = Math.round(factor * maximo * 100) / 100
    desglose.push({ variable, puntos, maximo })
    puntaje += puntos
  }

  // 1. Edad (máx 7 pts)
  const edad = calcularEdad(datos.fecha_nacimiento)
  const factorEdad =
    edad >= 36 && edad <= 50 ? 1.0 :
    edad >= 51 && edad <= 70 ? 0.8 :
    edad >= 26 && edad <= 35 ? 0.6 :
    edad >= 21 && edad <= 25 ? 0.4 : 0
  agregar('Edad', factorEdad, 7)

  // 2. Tiempo de residencia (máx 5 pts)
  const factorResidencia =
    datos.tiempo_residencia > 5 ? 1.0 :
    datos.tiempo_residencia >= 3 ? 0.8 :
    datos.tiempo_residencia >= 1 ? 0.6 : 0
  agregar('Tiempo de residencia', factorResidencia, 5)

  // 3. Antigüedad del negocio (máx 8 pts)
  const factorNegocio =
    datos.antiguedad_negocio > 5 ? 1.0 :
    datos.antiguedad_negocio >= 3 ? 0.8 :
    datos.antiguedad_negocio >= 1 ? 0.6 : 0
  agregar('Antigüedad del negocio', factorNegocio, 8)

  // 4. Casa habitación (máx 8 pts)
  const factorCasa =
    datos.casa_habitacion === 'Propia' ? 1.0 :
    datos.casa_habitacion === 'Familiar' ? 0.6 :
    datos.casa_habitacion === 'Rentada' ? 0.2 : 0
  agregar('Casa habitación', factorCasa, 8)

  // 5. Estado civil (máx 8 pts)
  const factorEstado =
    datos.estado_civil === 'Casado' ? 1.0 :
    datos.estado_civil === 'Union libre' ? 0.8 :
    datos.estado_civil === 'Viudo' ? 0.7 :
    datos.estado_civil === 'Soltero' ? 0.6 :
    datos.estado_civil === 'Divorciado' ? 0.4 : 0
  agregar('Estado civil', factorEstado, 8)

  // 6. Dependientes económicos (máx 5 pts)
  const factorDep =
    datos.dependientes >= 1 && datos.dependientes <= 2 ? 1.0 :
    datos.dependientes >= 3 && datos.dependientes <= 5 ? 0.8 :
    datos.dependientes === 0 ? 0.6 : 0
  agregar('Dependientes económicos', factorDep, 5)

  // 7. Destino del crédito (máx 6 pts)
  const factorDestino =
    datos.destino_credito === 'Capital de trabajo' ? 1.0 :
    datos.destino_credito === 'Activo fijo' ? 0.8 :
    datos.destino_credito === 'Bienes y servicios de consumo' ? 0.6 : 0
  agregar('Destino del crédito', factorDestino, 6)

  // 8. Automóvil propio (máx 8 pts)
  const factorAuto = datos.automovil_propio ? 1.0 : 0.4
  agregar('Automóvil propio', factorAuto, 8)

  // 9. Antigüedad cuenta bancaria (máx 4 pts)
  const factorBanco = datos.cuenta_banco > 1 ? 1.0 : 0.6
  agregar('Antigüedad cuenta bancaria', factorBanco, 4)

  // 10. Referencias personales (máx 5 pts)
  const factorRefs =
    refFactor >= 0.8 ? 1.0 :
    refFactor >= 0.5 ? 0.6 : 0.4
  agregar('Referencias personales', factorRefs, 5)

  // 11. Buró de crédito (máx 8 pts)
  const factorBuro =
    datos.buro_credito === 'Excelente' ? 1.0 :
    datos.buro_credito === 'Buena' ? 0.6 :
    datos.buro_credito === 'Regular' ? 0.2 : 0
  agregar('Buró de crédito', factorBuro, 8)

  // 12. Tipo de garantía (máx 5 pts)
  const factorGarantia =
    datos.tipo_garantia === 'Equipo de transporte' ? 1.0 :
    datos.tipo_garantia === 'Ninguna' ? 0.8 :
    datos.tipo_garantia === 'Avales' ? 0.4 : 0
  agregar('Tipo de garantía', factorGarantia, 5)

  // 13. Tipo de negocio (máx 5 pts)
  const factorTipoNeg =
    datos.tipo_negocio === 'Fijo' ? 1.0 :
    datos.tipo_negocio === 'Semifijo' ? 0.7 : 0
  agregar('Tipo de negocio', factorTipoNeg, 5)

  // 14. Género (máx 5 pts)
  const factorGenero = datos.genero === 'Masculino' ? 1.0 : 0.8
  agregar('Género', factorGenero, 5)

  // 15. Antigüedad número telefónico (máx 8 pts)
  const factorTel =
    datos.antiguedad_telefono > 3 ? 1.0 :
    datos.antiguedad_telefono >= 1 ? 0.7 : 0.3
  agregar('Antigüedad telefónica', factorTel, 8)

  // 16. Negocio en domicilio (máx 5 pts)
  const factorDomicilio = datos.negocio_domicilio ? 1.0 : 0.6
  agregar('Negocio en domicilio', factorDomicilio, 5)

  return {
    puntaje: Math.round(puntaje * 100) / 100,
    desglose,
  }
}

// ─── Clasificación ─────────────────────────────────────────────────────────────

export function clasificar(puntaje: number): Clasificacion {
  if (puntaje >= 80) return {
    letra: 'A',
    label: 'Bajo riesgo',
    color: 'text-[#15803d]',
    bg: 'bg-[#dcfce7]',
  }
  if (puntaje >= 70) return {
    letra: 'B',
    label: 'Riesgo moderado',
    color: 'text-[#a16207]',
    bg: 'bg-[#fef9c3]',
  }
  if (puntaje >= 50) return {
    letra: 'C',
    label: 'Alto riesgo',
    color: 'text-[#c2410c]',
    bg: 'bg-[#ffedd5]',
  }
  return {
    letra: 'D',
    label: 'No aprobado',
    color: 'text-[#b91c1c]',
    bg: 'bg-[#fee2e2]',
  }
}
