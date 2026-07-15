// Tipos compartidos entre la página server y el formulario client de /evaluar.

export interface EvaluacionCandidato {
  recomendacion: 'si' | 'no' | 'filtro_dg' | null
  comentarios: string | null
  puntaje: number | null
}

export interface CandidatoEval {
  entrevista_id: string
  nombre: string
  horario: string
  evaluacion: EvaluacionCandidato | null
}
