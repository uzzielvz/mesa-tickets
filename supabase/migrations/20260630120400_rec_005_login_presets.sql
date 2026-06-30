-- REC-005 — Preset de acceso a Reclutamiento al primer login.
-- 1) Agrega acceso_reclutamiento a login_presets.
-- 2) handle_new_user lo aplica al crear/actualizar el profile.
-- 3) Héctor (Gerente de Gente y Cultura) queda con acceso_reclutamiento = true.

alter table login_presets
  add column if not exists acceso_reclutamiento boolean not null default false;

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
  v_reclut   boolean := false;
begin
  select * into v_preset
  from login_presets
  where lower(email) = lower(new.email);

  if found then
    v_rol    := v_preset.rol;
    v_score  := v_preset.acceso_score;
    v_reclut := v_preset.acceso_reclutamiento;
    v_area   := v_preset.area_id;
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

  insert into profiles (id, email, nombre_completo, rol, acceso_score, acceso_reclutamiento, area_id)
  values (new.id, new.email, v_nombre, v_rol, v_score, v_reclut, v_area)
  on conflict (id) do update set
    acceso_score = excluded.acceso_score,
    acceso_reclutamiento = excluded.acceso_reclutamiento,
    rol = excluded.rol,
    area_id = coalesce(excluded.area_id, profiles.area_id),
    nombre_completo = case
      when coalesce(trim(profiles.nombre_completo), '') = '' then excluded.nombre_completo
      else profiles.nombre_completo
    end;

  return new;
end;
$$;

-- Héctor: acceso a Reclutamiento en su preset (conserva el resto de campos).
update login_presets
  set acceso_reclutamiento = true
  where lower(email) = lower('hector.ramirez@financieracrediflexi.com');

-- Si ya existe su profile (ya inició sesión antes), aplicar el acceso de inmediato.
update profiles
  set acceso_reclutamiento = true
  where lower(email) = lower('hector.ramirez@financieracrediflexi.com');
