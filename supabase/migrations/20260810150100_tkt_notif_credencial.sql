-- ================================================================
-- TKT-039 — Acceso a la credencial de Google para notificaciones
--
-- Los correos de tickets los manda la misma cuenta Gmail conectada
-- que usa Reclutamiento. Problema: `rec_credenciales_google` solo es
-- legible por admin o quien tiene acceso a Reclutamiento, y las
-- notificaciones las dispara CUALQUIER usuario (un comercial que
-- levanta un ticket).
--
-- Riesgo aceptado y acotado: esta función expone el refresh_token a
-- cualquier autenticado, pero el token viaja CIFRADO (AES-256-GCM) y
-- la llave vive solo en el entorno del servidor
-- (GOOGLE_TOKEN_ENCRYPTION_KEY). Un empleado que llame esto obtiene
-- un blob indescifrable.
-- ================================================================

create or replace function tkt_credencial_google()
returns text
language sql security definer stable
as $$
  select refresh_token
  from rec_credenciales_google
  order by actualizado_at desc
  limit 1;
$$;

revoke execute on function tkt_credencial_google() from public;
grant execute on function tkt_credencial_google() to authenticated;
