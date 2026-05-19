/** Usuario con módulo Score (no admin global de la app). */
export function esSoloOperadorScore(rol: string, accesoScore: boolean): boolean {
  return accesoScore && rol !== 'admin' && rol !== 'responsable'
}

/** Crear, editar, eliminar y evaluar acreditados (cualquier registro). */
export function puedeGestionarAcreditados(rol: string, accesoScore: boolean): boolean {
  return rol === 'admin' || accesoScore
}

/** @deprecated Usar puedeGestionarAcreditados */
export function puedeEditarAcreditado(
  _userId: string,
  _capturadoPorId: string,
  rol: string,
  accesoScore = false
): boolean {
  return puedeGestionarAcreditados(rol, accesoScore)
}
