-- ================================================================
-- TKT-047 — El remitente de tickets es del sistema, no de un usuario
--
-- En Reclutamiento tiene sentido que el operador conecte su cuenta: los
-- correos a candidatos salen de una persona. En la mesa de tickets NO:
-- las notificaciones son de la plataforma y deben salir SIEMPRE de la
-- misma dirección, sin depender de quién haya conectado al último.
--
-- Se guarda el correo de la cuenta autorizada para poder (a) validar
-- que la credencial de tickets sea la de la plataforma y (b) firmar el
-- header From con nombre visible.
-- ================================================================

alter table rec_credenciales_google
  add column if not exists email text;

comment on column rec_credenciales_google.email is
  'Dirección de la cuenta de Google que autorizó. Se usa para validar el remitente de tickets y para el header From.';

-- Devuelve token + correo: el emisor de tickets necesita ambos.
drop function if exists tkt_credencial_google();

create or replace function tkt_credencial_google()
returns table (refresh_token text, email text)
language sql security definer stable
as $$
  select c.refresh_token, c.email
  from rec_credenciales_google c
  where c.uso in ('tickets', 'ambos')
  order by (c.uso = 'tickets') desc, c.actualizado_at desc
  limit 1;
$$;

revoke execute on function tkt_credencial_google() from public;
grant execute on function tkt_credencial_google() to authenticated;
