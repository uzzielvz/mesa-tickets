-- Presets al primer login: permisos listos antes de que el usuario entre.
-- Edita login_presets en Supabase para cada operador Score.

create table if not exists login_presets (
  email           text primary key,
  rol             user_role not null default 'usuario',
  acceso_score    boolean not null default true,
  area_id         uuid references areas(id),
  nombre_completo text
);

comment on table login_presets is
  'Al registrarse (auth.users), handle_new_user aplica estos valores al profile.';

-- Yesenia (yrendon@…): solo rol + Score; nombre y área en onboarding.
insert into login_presets (email, rol, acceso_score, area_id, nombre_completo)
values (
  'yrendon@financieracrediflexi.com',
  'usuario',
  true,
  null,
  null
)
on conflict (email) do update set
  rol = excluded.rol,
  acceso_score = excluded.acceso_score,
  area_id = coalesce(excluded.area_id, login_presets.area_id),
  nombre_completo = coalesce(excluded.nombre_completo, login_presets.nombre_completo);

create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_preset   login_presets%rowtype;
  v_nombre   text;
  v_area     uuid;
  v_rol      user_role := 'usuario';
  v_score    boolean := false;
begin
  select * into v_preset
  from login_presets
  where lower(email) = lower(new.email);

  if found then
    v_rol   := v_preset.rol;
    v_score := v_preset.acceso_score;
    v_area  := v_preset.area_id;
    -- Si el preset no trae nombre, dejar vacío para que onboarding lo pida
    -- (no rellenar desde Google en ese caso).
    if nullif(trim(v_preset.nombre_completo), '') is not null then
      v_nombre := trim(v_preset.nombre_completo);
    else
      v_nombre := '';
    end if;
  else
    v_nombre := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), '');
  end if;

  insert into profiles (id, email, nombre_completo, rol, acceso_score, area_id)
  values (new.id, new.email, v_nombre, v_rol, v_score, v_area)
  on conflict (id) do update set
    acceso_score = excluded.acceso_score,
    rol = excluded.rol,
    area_id = coalesce(excluded.area_id, profiles.area_id),
    nombre_completo = case
      when coalesce(trim(profiles.nombre_completo), '') = '' then excluded.nombre_completo
      else profiles.nombre_completo
    end;

  return new;
end;
$$;

-- Si ya existe en auth pero aún no en profiles (raro), al crear profile manualmente no aplica.
-- Tras migración, opcional para quien ya esté en auth.users sin preset aplicado:
-- ver scripts/aplicar-preset-yrendon.sql
