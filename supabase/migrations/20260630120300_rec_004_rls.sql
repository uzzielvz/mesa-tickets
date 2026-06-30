-- REC-004 — RLS del módulo Reclutamiento.
-- Política MVP: admin (Héctor) y portadores del flag acceso_reclutamiento tienen
-- CRUD completo en todas las tablas rec_*. Nadie más entra a la app autenticada.
-- Los entrevistadores acceden por magic link vía RPC security definer (S5), no por
-- auth.uid(), por eso aquí no se abren políticas públicas.

create or replace function has_reclutamiento_access()
returns boolean language sql security definer as $$
  select coalesce(
    (select acceso_reclutamiento from profiles where id = auth.uid()), false
  )
$$;

-- Predicado reutilizado: flag de reclutamiento o admin.
-- (Se inlinea en cada policy porque Postgres no permite parametrizar el predicado.)

alter table rec_vacantes              enable row level security;
alter table rec_candidatos            enable row level security;
alter table rec_sesiones_entrevistas  enable row level security;
alter table rec_entrevistas           enable row level security;
alter table rec_evaluaciones          enable row level security;
alter table rec_magic_links           enable row level security;
alter table rec_plantillas_correo     enable row level security;
alter table rec_correos_enviados      enable row level security;
alter table rec_credenciales_google   enable row level security;

create policy "rec_vacantes_all" on rec_vacantes
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_candidatos_all" on rec_candidatos
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_sesiones_all" on rec_sesiones_entrevistas
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_entrevistas_all" on rec_entrevistas
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_evaluaciones_all" on rec_evaluaciones
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_magic_links_all" on rec_magic_links
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_plantillas_all" on rec_plantillas_correo
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_correos_all" on rec_correos_enviados
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "rec_credenciales_all" on rec_credenciales_google
  for all to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
