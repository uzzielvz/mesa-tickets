-- ================================================================
-- TKT-046 — Una cuenta emisora por módulo
--
-- Bug de diseño heredado: tanto Reclutamiento como Tickets elegían la
-- credencial con `order by actualizado_at desc limit 1`. Aunque
-- hubiera dos cuentas conectadas, AMBOS módulos usaban la más
-- reciente — así que conectar una cuenta para tickets le cambiaba en
-- silencio el remitente a los correos de candidatos.
--
-- Se resuelve marcando para qué sirve cada credencial. `ambos` es el
-- default para no romper lo ya conectado: la credencial existente
-- sigue sirviendo a los dos módulos hasta que se conecte una dedicada.
-- ================================================================

alter table rec_credenciales_google
  add column if not exists uso text not null default 'ambos'
  check (uso in ('reclutamiento', 'tickets', 'ambos'));

comment on column rec_credenciales_google.uso is
  'Para qué módulo envía esta cuenta. `ambos` = comodín, se usa cuando el módulo no tiene una dedicada.';

-- Solo puede haber una credencial por uso específico; `ambos` no se
-- restringe porque es el fallback histórico.
create unique index if not exists idx_credencial_uso_unico
  on rec_credenciales_google (uso)
  where uso <> 'ambos';

-- ---------------------------------------------------------------
-- Selección con preferencia: la dedicada gana; si no hay, la comodín
-- ---------------------------------------------------------------

create or replace function tkt_credencial_google()
returns text
language sql security definer stable
as $$
  select refresh_token
  from rec_credenciales_google
  where uso in ('tickets', 'ambos')
  order by (uso = 'tickets') desc, actualizado_at desc
  limit 1;
$$;

revoke execute on function tkt_credencial_google() from public;
grant execute on function tkt_credencial_google() to authenticated;

-- Reclutamiento está en pausa, pero dejarlo eligiendo "la más reciente"
-- significaría que conectar la cuenta de tickets le cambia el remitente.
-- Esto no es desarrollo nuevo: es no romperlo.
create or replace function rec_credencial_google()
returns text
language sql security definer stable
as $$
  select refresh_token
  from rec_credenciales_google
  where uso in ('reclutamiento', 'ambos')
  order by (uso = 'reclutamiento') desc, actualizado_at desc
  limit 1;
$$;

revoke execute on function rec_credencial_google() from public;
grant execute on function rec_credencial_google() to authenticated;
