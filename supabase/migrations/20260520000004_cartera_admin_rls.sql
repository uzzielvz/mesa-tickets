-- Admin puede actualizar acceso_cartera en profiles
create policy "admin_update_cartera_access" on profiles
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
