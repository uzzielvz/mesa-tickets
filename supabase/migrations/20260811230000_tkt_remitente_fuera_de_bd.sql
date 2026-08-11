-- ================================================================
-- TKT-048 — El remitente de la mesa sale de la base de datos
--
-- Mientras la credencial de tickets fue una fila de
-- `rec_credenciales_google`, cualquier usuario con permisos podía
-- reconectar desde cualquier dispositivo y cambiar el remitente. Y
-- pasó: una conexión hecha con la sesión de Google abierta reemplazó
-- la cuenta de plataforma por la personal, en silencio.
--
-- Un dato que se puede editar no es una garantía. La cuenta emisora de
-- la mesa pasa a variables de entorno (TICKETS_GOOGLE_REFRESH_TOKEN +
-- TICKETS_SENDER_EMAIL): no hay pantalla que la toque, ni RLS que
-- relajar, ni "última cuenta conectada" que gane.
--
-- Reclutamiento se queda como estaba: ahí sí tiene sentido que el
-- operador conecte su propia cuenta.
-- ================================================================

drop function if exists tkt_credencial_google();

comment on column rec_credenciales_google.uso is
  'Solo distingue credenciales de reclutamiento; el remitente de tickets ya no vive aquí (TKT-048).';
