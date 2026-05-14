-- ================================================================
-- ONBOARDING — primer login pide nombre y área
-- ================================================================

-- Que el trigger handle_new_user deje el nombre vacío si Google no
-- mandó full_name, en lugar de poner el slug del email. Así la
-- pantalla de onboarding sale limpia y obliga al usuario a escribirlo.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into profiles (id, email, nombre_completo, rol)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), ''),
    'usuario'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- RPC para que el usuario complete su propio onboarding sin abrir
-- RLS de profiles. Solo permite tocar nombre_completo y area_id.
create or replace function complete_onboarding(p_nombre text, p_area_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'no_auth';
  end if;

  if length(coalesce(trim(p_nombre), '')) < 3 then
    raise exception 'nombre_invalido';
  end if;

  if not exists (select 1 from areas where id = p_area_id and activo) then
    raise exception 'area_invalida';
  end if;

  update profiles
  set nombre_completo = trim(p_nombre),
      area_id = p_area_id
  where id = v_uid;
end;
$$;

-- Permitir que cualquier usuario autenticado pueda llamar la función
-- (la propia función valida auth.uid() y los datos).
grant execute on function complete_onboarding(text, uuid) to authenticated;
