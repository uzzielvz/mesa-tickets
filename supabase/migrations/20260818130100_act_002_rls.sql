-- ACT-002 — RLS del módulo Actividades.
--
-- Predicado único: admin del sistema o portador de `acceso_actividades`. Mismo
-- patrón que has_cartera_access() / acceso_reclutamiento, para no inventar una
-- tercera forma de decir lo mismo.
--
-- Nota de alcance: quien puede VER también puede CARGAR. Separar las dos cosas
-- exigiría una segunda bandera, y hoy no hay a quién dársela: el único que sube
-- el archivo es dirección. Si mañana carga un analista que no debe ver el
-- tablero completo, se agrega `act_puede_cargar` y se parte el predicado.

alter table act_cargas    enable row level security;
alter table act_registros enable row level security;
alter table act_empleados enable row level security;
alter table act_puestos   enable row level security;

create or replace function public.has_actividades_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_actividades = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function public.has_actividades_access() from public, anon;
grant execute on function public.has_actividades_access() to authenticated;

-- ── act_cargas ───────────────────────────────────────────────────────────────
create policy "act_cargas_select" on act_cargas
  for select to authenticated using (has_actividades_access());

create policy "act_cargas_insert" on act_cargas
  for insert to authenticated with check (has_actividades_access());

create policy "act_cargas_update" on act_cargas
  for update to authenticated using (has_actividades_access());

create policy "act_cargas_delete" on act_cargas
  for delete to authenticated using (has_actividades_access());

-- ── act_registros ────────────────────────────────────────────────────────────
-- El delete es necesario: recargar un periodo borra sus filas antes de insertar
-- las nuevas (es lo que hace que volver a subir el mismo archivo sea inofensivo).
create policy "act_registros_select" on act_registros
  for select to authenticated using (has_actividades_access());

create policy "act_registros_insert" on act_registros
  for insert to authenticated with check (has_actividades_access());

create policy "act_registros_delete" on act_registros
  for delete to authenticated using (has_actividades_access());

-- ── Catálogos ────────────────────────────────────────────────────────────────
create policy "act_empleados_select" on act_empleados
  for select to authenticated using (has_actividades_access());

create policy "act_empleados_write" on act_empleados
  for all to authenticated
  using (has_actividades_access()) with check (has_actividades_access());

create policy "act_puestos_select" on act_puestos
  for select to authenticated using (has_actividades_access());

create policy "act_puestos_write" on act_puestos
  for all to authenticated
  using (has_actividades_access()) with check (has_actividades_access());
