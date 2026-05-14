-- ================================================================
-- RECHAZO de solicitudes por el responsable
-- ================================================================
--
-- - Extiende el enum response_type con 'rechazo_responsable'.
-- - El responsable puede rechazar el ticket en cualquier momento
--   (no aplica la paridad de orden), explicando el motivo en
--   contenido. El ticket se cierra inmediatamente (closed_at = now()).
-- - La vista deriva el estado 'rechazado' cuando la última respuesta
--   es de ese tipo.
--
-- Nota: alter type ... add value debe ir en su propia migración y
-- fuera de transacción para que el resto de DDL pueda usar el valor.

alter type response_type add value if not exists 'rechazo_responsable';
