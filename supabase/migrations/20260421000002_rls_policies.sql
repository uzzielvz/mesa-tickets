-- Helper: verificar si un usuario es admin
create or replace function is_admin(user_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists(
    select 1 from profiles
    where id = user_id and rol = 'admin'
  )
$$;

-- ==================== profiles ====================
alter table profiles enable row level security;

create policy "profiles_select" on profiles
  for select to authenticated
  using (true);

create policy "profiles_insert_own" on profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_admin" on profiles
  for update to authenticated
  using (is_admin(auth.uid()));

-- ==================== areas ====================
alter table areas enable row level security;

create policy "areas_select" on areas
  for select to authenticated
  using (true);

create policy "areas_mutate_admin" on areas
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ==================== problem_catalog ====================
alter table problem_catalog enable row level security;

create policy "catalog_select" on problem_catalog
  for select to authenticated
  using (true);

create policy "catalog_mutate_admin" on problem_catalog
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ==================== tickets ====================
alter table tickets enable row level security;

create policy "tickets_select" on tickets
  for select to authenticated
  using (
    auth.uid() = levantado_por_id
    or auth.uid() = responsable_id
    or is_admin(auth.uid())
  );

create policy "tickets_insert" on tickets
  for insert to authenticated
  with check (auth.uid() = levantado_por_id);

create policy "tickets_update_admin" on tickets
  for update to authenticated
  using (is_admin(auth.uid()));

-- ==================== ticket_responses ====================
alter table ticket_responses enable row level security;

create policy "responses_select" on ticket_responses
  for select to authenticated
  using (
    exists(
      select 1 from tickets t
      where t.id = ticket_id
        and (t.levantado_por_id = auth.uid()
          or t.responsable_id = auth.uid()
          or is_admin(auth.uid()))
    )
  );

create policy "responses_insert" on ticket_responses
  for insert to authenticated
  with check (
    exists(
      select 1 from tickets t
      where t.id = ticket_id
        and (t.levantado_por_id = auth.uid()
          or t.responsable_id = auth.uid())
    )
    and autor_id = auth.uid()
  );

-- Sin UPDATE ni DELETE — hilos inmutables

-- ==================== ticket_attachments ====================
alter table ticket_attachments enable row level security;

create policy "attachments_select" on ticket_attachments
  for select to authenticated
  using (
    exists(
      select 1 from tickets t
      where t.id = ticket_id
        and (t.levantado_por_id = auth.uid()
          or t.responsable_id = auth.uid()
          or is_admin(auth.uid()))
    )
  );

create policy "attachments_insert" on ticket_attachments
  for insert to authenticated
  with check (uploaded_by_id = auth.uid());
