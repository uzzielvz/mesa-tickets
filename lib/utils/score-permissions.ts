/** Puede editar datos del acreditado (captura + referencias). */
export function puedeEditarAcreditado(
  userId: string,
  capturadoPorId: string,
  rol: string
): boolean {
  return rol === 'admin' || userId === capturadoPorId
}
