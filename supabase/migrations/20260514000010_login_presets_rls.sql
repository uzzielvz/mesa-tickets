-- RLS en login_presets: no expuesta vía API al resto de usuarios.
-- handle_new_user (security definer) sigue leyendo presets al registrar.

alter table login_presets enable row level security;

drop policy if exists "login_presets_admin_select" on login_presets;
create policy "login_presets_admin_select"
  on login_presets
  for select
  to authenticated
  using (is_admin(auth.uid()));

-- Sin INSERT/UPDATE/DELETE para authenticated: cambios solo en SQL Editor (service role).
