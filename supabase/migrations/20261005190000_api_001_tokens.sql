-- API-001 — Tokens personales para cargar desde scripts.
--
-- Felix genera sus datos con Python. En vez de guardar un archivo y subirlo
-- por la pantalla, su script manda el DataFrame directo (paquete
-- `crediflexi-cargas`, repo aparte). La plataforma entra con Google, y un
-- script no puede hacer ese login: se autentica con un token personal.
--
-- Reglas:
--   · Solo se guarda el HASH del token (sha256). El token en claro se muestra
--     una sola vez, al crearlo.
--   · Cada token es de UNA persona, tiene alcances ('ahorros', 'auditor') y se
--     puede revocar.
--   · El script actúa COMO esa persona: las funciones `api_*` validan el token
--     y llaman a las mismas cargas que usa la pantalla, que siguen revisando su
--     bandera (`acceso_ahorros_carga`, `acceso_auditor_carga`). Un token no da
--     más permisos de los que la persona ya tiene.

create table if not exists api_tokens (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  descripcion  text not null,
  token_hash   text not null unique,
  alcances     text[] not null
               check (cardinality(alcances) > 0 and alcances <@ array['ahorros', 'auditor']::text[]),
  creado_por   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  ultimo_uso   timestamptz,
  revocado_at  timestamptz
);

alter table api_tokens enable row level security;
-- Solo el admin ve la lista (nunca el token: solo su hash).
create policy "api_tokens_select" on api_tokens
  for select to authenticated using (is_admin(auth.uid()));

-- ── Validar el token y actuar como su dueño ─────────────────────────────────
-- Fija la identidad de la petición (`auth.uid()`) en el dueño del token, solo
-- durante la transacción de esta llamada. Nadie la llama directo.
create or replace function public.api_actuar_como(p_token text, p_alcance text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id  uuid;
  v_uid uuid;
begin
  select id, profile_id into v_id, v_uid
  from api_tokens
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    and revocado_at is null
    and p_alcance = any (alcances);

  if v_uid is null then
    raise exception 'Token inválido, revocado o sin permiso para "%"', p_alcance using errcode = '42501';
  end if;

  update api_tokens set ultimo_uso = now() where id = v_id;

  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  return v_uid;
end;
$$;

revoke all on function public.api_actuar_como(text, text) from public, anon, authenticated;

-- ── Cargas por script ────────────────────────────────────────────────────────
-- Mismas firmas que las de la pantalla, más el token. La lógica vive en las
-- funciones originales (AHO-003, AUD-002); aquí solo se cambia quién llama.
create or replace function public.api_aho_iniciar_carga(
  p_token text, p_nombre text, p_filas int, p_rechazadas int, p_grupos text[], p_avisos text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform api_actuar_como(p_token, 'ahorros');
  return aho_iniciar_carga(p_nombre, p_filas, p_rechazadas, p_grupos, p_avisos);
end;
$$;

create or replace function public.api_aho_cargar_lote(p_token text, p_carga uuid, p_filas jsonb)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform api_actuar_como(p_token, 'ahorros');
  return aho_cargar_lote(p_carga, p_filas);
end;
$$;

create or replace function public.api_aho_cerrar_carga(p_token text, p_carga uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform api_actuar_como(p_token, 'ahorros');
  return aho_cerrar_carga(p_carga);
end;
$$;

create or replace function public.api_aud_cargar(p_token text, p_nombre text, p_filas jsonb, p_avisos text[])
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform api_actuar_como(p_token, 'auditor');
  return aud_cargar(p_nombre, p_filas, p_avisos);
end;
$$;

-- El script llama con la llave pública (anon): el token es la credencial.
grant execute on function public.api_aho_iniciar_carga(text, text, int, int, text[], text[]) to anon, authenticated;
grant execute on function public.api_aho_cargar_lote(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.api_aho_cerrar_carga(text, uuid) to anon, authenticated;
grant execute on function public.api_aud_cargar(text, text, jsonb, text[]) to anon, authenticated;

-- ── Crear y revocar tokens ───────────────────────────────────────────────────
-- Las llama un admin desde la plataforma o desde el SQL editor de Supabase
-- (sesión `postgres`). Devuelve el token en claro UNA vez; no se puede volver
-- a consultar.
create or replace function public.api_crear_token(p_email text, p_descripcion text, p_alcances text[])
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid   uuid;
  v_token text;
begin
  if not (is_admin(auth.uid()) or session_user = 'postgres') then
    raise exception 'Solo un administrador crea tokens' using errcode = '42501';
  end if;

  select id into v_uid from profiles where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'No hay cuenta en la plataforma con el correo %. La persona tiene que entrar una vez.', p_email;
  end if;

  v_token := 'cfx_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into api_tokens (profile_id, descripcion, token_hash, alcances, creado_por)
  values (v_uid, p_descripcion, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_alcances, auth.uid());

  return v_token;
end;
$$;

create or replace function public.api_revocar_token(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not (is_admin(auth.uid()) or session_user = 'postgres') then
    raise exception 'Solo un administrador revoca tokens' using errcode = '42501';
  end if;
  update api_tokens set revocado_at = now() where id = p_id and revocado_at is null;
  if not found then
    raise exception 'Ese token no existe o ya estaba revocado';
  end if;
end;
$$;

revoke all on function public.api_crear_token(text, text, text[]) from public, anon;
revoke all on function public.api_revocar_token(uuid) from public, anon;
grant execute on function public.api_crear_token(text, text, text[]) to authenticated;
grant execute on function public.api_revocar_token(uuid) to authenticated;
