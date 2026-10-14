/**
 * Pide al servidor los correos de los avisos que acaba de provocar quien está
 * en sesión (su solicitud, su autorización, su Vo. Bo.). Se llama después de
 * cada acción y no se espera: la acción ya quedó guardada y el aviso ya está
 * en la campana; el correo sale aparte. `keepalive` deja terminar la petición
 * aunque la persona cambie de página.
 */
export function dispararCorreosDeAvisos(): void {
  fetch('/api/notificaciones/enviar', { method: 'POST', keepalive: true }).catch(() => {})
}

/** El tope de `ntf_correos_por_enviar` por llamada. */
const TOPE_POR_LLAMADA = 25

/**
 * Igual, para una tanda grande: una carga del Auditor avisa de una vez a todos
 * los promotores y gerentes (AUD-005). La ruta manda hasta 25 por llamada, así
 * que se vuelve a pedir mientras llegue el tope. Tampoco se espera.
 */
export function dispararTandaDeCorreos(): void {
  void (async () => {
    for (let i = 0; i < 5; i++) {
      try {
        const res = await fetch('/api/notificaciones/enviar', { method: 'POST', keepalive: true })
        const j = (await res.json()) as { pendientes?: number }
        if (!res.ok || (j.pendientes ?? 0) < TOPE_POR_LLAMADA) return
      } catch {
        return
      }
    }
  })()
}
