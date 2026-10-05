-- AHO-002 — RLS del visor de ahorros.
--
-- Todo se escribe por RPC (`security definer`, con la autorización validada a
-- mano), así que ninguna tabla tiene políticas de escritura: un cliente no
-- puede insertar pagos ni fabricar eventos de uso por fuera de las funciones.

alter table aho_cargas  enable row level security;
alter table aho_pagos   enable row level security;
alter table aho_eventos enable row level security;

-- ── Predicados ───────────────────────────────────────────────────────────────
-- Quien carga también consulta: Felix necesita ver lo que acaba de subir.
create or replace function public.has_ahorros_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_ahorros = true or acceso_ahorros_carga = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.has_ahorros_carga()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_ahorros_carga = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function public.has_ahorros_access() from public, anon;
revoke all on function public.has_ahorros_carga()  from public, anon;
grant execute on function public.has_ahorros_access() to authenticated;
grant execute on function public.has_ahorros_carga()  to authenticated;

-- ── Lectura ──────────────────────────────────────────────────────────────────
-- La bitácora la ve cualquiera del módulo: es la respuesta a "¿esto ya está
-- actualizado?". Los pagos también, aunque la pantalla los pide por RPC.
create policy "aho_cargas_select" on aho_cargas
  for select to authenticated using (has_ahorros_access());

create policy "aho_pagos_select" on aho_pagos
  for select to authenticated using (has_ahorros_access());

-- El uso solo lo ve quien carga: es la métrica de Data Science, no de los
-- asesores.
create policy "aho_eventos_select" on aho_eventos
  for select to authenticated using (has_ahorros_carga());

-- Sin políticas de INSERT/UPDATE/DELETE a propósito. Escribir es cosa de las
-- funciones de AHO-003; borrar se hace desde el SQL editor y con intención.
