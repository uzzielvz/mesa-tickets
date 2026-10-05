-- VAC-002 — RLS del módulo de Vacaciones (fase 1).
--
-- En esta fase solo opera Gente y Cultura. La fase 2 agregará que cada
-- empleado vea lo suyo y su jefe lo de su equipo.

alter table vac_dias_ley    enable row level security;
alter table vac_empleados   enable row level security;
alter table vac_movimientos enable row level security;

create or replace function public.has_vacaciones_rh()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_vacaciones_rh = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function public.has_vacaciones_rh() from public, anon;
grant execute on function public.has_vacaciones_rh() to authenticated;

-- La tabla de la ley es pública dentro de la empresa.
create policy "vac_dias_ley_select" on vac_dias_ley
  for select to authenticated using (true);

create policy "vac_empleados_select" on vac_empleados
  for select to authenticated using (has_vacaciones_rh());
create policy "vac_empleados_insert" on vac_empleados
  for insert to authenticated with check (has_vacaciones_rh());
create policy "vac_empleados_update" on vac_empleados
  for update to authenticated using (has_vacaciones_rh()) with check (has_vacaciones_rh());

create policy "vac_movimientos_select" on vac_movimientos
  for select to authenticated using (has_vacaciones_rh());
create policy "vac_movimientos_insert" on vac_movimientos
  for insert to authenticated with check (has_vacaciones_rh());
create policy "vac_movimientos_update" on vac_movimientos
  for update to authenticated using (has_vacaciones_rh()) with check (has_vacaciones_rh());

-- Sin DELETE en ninguna: un empleado que se va se marca inactivo, y un
-- movimiento equivocado se anula. Los dos quedan.
