alter table cartera_uploads enable row level security;
alter table stg_yunius_cartera_individual enable row level security;
alter table loan_amortizacion_individual enable row level security;

create or replace function has_cartera_access()
returns boolean language sql security definer as $$
  select coalesce(
    (select acceso_cartera from profiles where id = auth.uid()), false
  )
$$;

-- cartera_uploads
create policy "cartera_uploads_select" on cartera_uploads
  for select to authenticated
  using (has_cartera_access() or
         exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "cartera_uploads_insert" on cartera_uploads
  for insert to authenticated
  with check (has_cartera_access() or
              exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

create policy "cartera_uploads_update" on cartera_uploads
  for update to authenticated
  using (has_cartera_access() or
         exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

-- stg_yunius: solo lectura para usuarios (Python inserta con service_role)
create policy "stg_cartera_select" on stg_yunius_cartera_individual
  for select to authenticated
  using (has_cartera_access() or
         exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));

-- amortizaciones: solo lectura para usuarios
create policy "amort_select" on loan_amortizacion_individual
  for select to authenticated
  using (has_cartera_access() or
         exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
