-- INV-002 — RLS del módulo Inversiones.
--
-- Tres predicados en vez de uno, porque el módulo tiene tres papeles distintos:
-- quien carga (Felix), quien ve pagos (Tesorería) y quien ve desempeño
-- (Dirección). Mismo patrón que has_actividades_access() / has_cartera_access(),
-- para no inventar una cuarta forma de decir lo mismo.
--
-- La bitácora `inv_cargas` la lee CUALQUIERA de los tres: es la lista de qué
-- reportes existen y cuándo llegaron. Lo que cada quien puede abrir o descargar
-- se decide en la ruta, contra el `tipo_reporte` de la carga — ver
-- app/api/inversiones/descargar/[id]/route.ts.

alter table inv_cargas enable row level security;

-- ── Predicados ───────────────────────────────────────────────────────────────

create or replace function public.has_inversiones_carga()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_inversiones_carga = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.has_inversiones_pagos()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_inversiones_pagos = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.has_inversiones_desempeno()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_inversiones_desempeno = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Cualquiera de los tres papeles. Es el predicado de "pertenece al módulo".
create or replace function public.has_inversiones_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin'
         or acceso_inversiones_carga = true
         or acceso_inversiones_pagos = true
         or acceso_inversiones_desempeno = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function public.has_inversiones_carga()     from public, anon;
revoke all on function public.has_inversiones_pagos()      from public, anon;
revoke all on function public.has_inversiones_desempeno()  from public, anon;
revoke all on function public.has_inversiones_access()     from public, anon;

grant execute on function public.has_inversiones_carga()     to authenticated;
grant execute on function public.has_inversiones_pagos()     to authenticated;
grant execute on function public.has_inversiones_desempeno() to authenticated;
grant execute on function public.has_inversiones_access()    to authenticated;

-- ── inv_cargas ───────────────────────────────────────────────────────────────
-- Leer la bitácora: cualquiera del módulo.
create policy "inv_cargas_select" on inv_cargas
  for select to authenticated using (has_inversiones_access());

-- Escribir: solo quien carga. Un lector de tableros no registra cargas.
create policy "inv_cargas_insert" on inv_cargas
  for insert to authenticated with check (has_inversiones_carga());

create policy "inv_cargas_update" on inv_cargas
  for update to authenticated
  using (has_inversiones_carga()) with check (has_inversiones_carga());

-- Sin política de DELETE a propósito: el histórico es el requisito, no un
-- efecto secundario. Borrar una carga se hace desde el SQL editor y con
-- intención, no desde la aplicación.
