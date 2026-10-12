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
