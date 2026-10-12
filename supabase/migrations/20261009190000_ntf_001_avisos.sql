-- NTF-001 — Avisos de la plataforma: la campana y sus correos.
--
-- Un solo sistema con dos canales. Cada evento deja un aviso aquí (lo que
-- muestra la campana) y, cuando alguien tiene que actuar o le llega un
-- resultado, además sale por correo con el remitente de la plataforma.
--
-- Decisiones:
--   · El aviso va dirigido a un CORREO, no a una cuenta. Al arrancar, 66
--     personas de la base de vacaciones tienen un jefe que nunca ha entrado:
--     su primer contacto es el correo, y el aviso ya lo espera cuando entra
--     con ese correo.
--   · Los avisos los crean las funciones de cada módulo DENTRO de la misma
--     transacción que la acción: si la solicitud se guarda, su aviso también.
--     Nadie inserta avisos desde el navegador.
--   · El correo es best-effort pero deja rastro: enviado, intentos y error.
--     "No me llegó" se puede revisar.
--   · Lo manda el servidor de la app (Gmail), no la base: justo después de la
--     acción, quien la hizo pide sus correos pendientes (`ntf_correos_por_enviar`);
--     y un cron diario de Vercel manda lo que quedó (recordatorios y fallas),
--     autenticado con un secreto cuyo hash vive en `ntf_ajustes`.

-- ── Avisos ───────────────────────────────────────────────────────────────────
create table if not exists notificaciones (
  id                uuid primary key default gen_random_uuid(),
  para_email        text not null check (para_email = lower(trim(para_email)) and position('@' in para_email) > 1),
  modulo            text not null check (modulo in ('vacaciones')),
  -- Qué pasó, para filtrar o agrupar después (p. ej. 'vac_solicitud').
  tipo              text not null,
  titulo            text not null,
  cuerpo            text,
  -- Ruta interna; el correo la convierte en liga completa.
  liga              text check (liga is null or liga like '/%'),
  -- El registro del módulo al que se refiere (p. ej. la solicitud).
  ref_id            uuid,
  -- Quién lo provocó; null = el sistema (el recordatorio diario).
  creada_por        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  leida_at          timestamptz,
  -- Canal de correo.
  correo            boolean not null default false,
  correo_enviado_at timestamptz,
  correo_intentos   smallint not null default 0,
  correo_error      text
);

create index if not exists idx_ntf_para       on notificaciones (para_email, created_at desc);
create index if not exists idx_ntf_no_leidas  on notificaciones (para_email) where leida_at is null;
create index if not exists idx_ntf_correo     on notificaciones (created_at) where correo and correo_enviado_at is null;
create index if not exists idx_ntf_ref        on notificaciones (ref_id, tipo);

comment on table notificaciones is
  'NTF-001: avisos de la plataforma (la campana). Dirigidos a un correo. Se crean solo dentro de las funciones de cada módulo (ntf_crear).';

-- El correo de quien pregunta. `profiles.email` solo lo cambia un admin.
create or replace function public.ntf_mi_email()
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select lower(trim(email)) from profiles where id = auth.uid()
$$;

revoke all on function public.ntf_mi_email() from public, anon;
grant execute on function public.ntf_mi_email() to authenticated;

alter table notificaciones enable row level security;

-- Cada quien lee los suyos. Sin insert/update/delete directos.
drop policy if exists "notificaciones_select_propias" on notificaciones;
create policy "notificaciones_select_propias" on notificaciones
  for select to authenticated using (para_email = (select ntf_mi_email()));

-- ── Crear un aviso ───────────────────────────────────────────────────────────
-- Solo la llaman otras funciones (security definer). No avisa a nadie de lo
-- que él mismo hizo, y sin correo no hay a quién avisar.
create or replace function public.ntf_crear(
  p_para   text,
  p_modulo text,
  p_tipo   text,
  p_titulo text,
  p_cuerpo text,
  p_liga   text,
  p_ref    uuid,
  p_correo boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_para text := lower(trim(coalesce(p_para, '')));
begin
  if v_para = '' or v_para = coalesce(ntf_mi_email(), '') then
    return;
  end if;

  insert into notificaciones (para_email, modulo, tipo, titulo, cuerpo, liga, ref_id, creada_por, correo)
  values (v_para, p_modulo, p_tipo, p_titulo, nullif(trim(coalesce(p_cuerpo, '')), ''), p_liga, p_ref,
          auth.uid(), coalesce(p_correo, false));
end;
$$;

revoke all on function public.ntf_crear(text, text, text, text, text, text, uuid, boolean) from public, anon, authenticated;

-- ── Marcar leídos ────────────────────────────────────────────────────────────
-- Sin ids: todos los de quien llama.
create or replace function public.ntf_marcar_leidas(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_n int;
begin
  update notificaciones
     set leida_at = now()
   where para_email = ntf_mi_email()
     and leida_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.ntf_marcar_leidas(uuid[]) from public, anon;
grant execute on function public.ntf_marcar_leidas(uuid[]) to authenticated;

-- ── Correos ──────────────────────────────────────────────────────────────────
-- Lo común de los dos caminos (quien hizo la acción y el cron). Internas.
create or replace function public.ntf_pendientes_interno(p_creada_por uuid, p_limite int, p_ventana interval)
returns json
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(json_agg(json_build_object(
           'id', n.id, 'para', n.para_email, 'titulo', n.titulo, 'cuerpo', n.cuerpo, 'liga', n.liga
         ) order by n.created_at), '[]'::json)
  from (
    select * from notificaciones
    where correo and correo_enviado_at is null and correo_intentos < 3
      and created_at > now() - p_ventana
      and (p_creada_por is null or creada_por = p_creada_por)
    order by created_at
    limit p_limite
  ) n
$$;

-- p_resultados: [{ id, ok, error }]
create or replace function public.ntf_resultados_interno(p_resultados jsonb, p_creada_por uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_n int;
begin
  update notificaciones n
     set correo_intentos   = n.correo_intentos + 1,
         correo_enviado_at = case when r.ok then now() end,
         correo_error      = case when r.ok then null else left(coalesce(r.error, 'sin detalle'), 500) end
    from jsonb_to_recordset(coalesce(p_resultados, '[]'::jsonb)) as r(id uuid, ok boolean, error text)
   where n.id = r.id
     and n.correo and n.correo_enviado_at is null
     and (p_creada_por is null or n.creada_por = p_creada_por);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.ntf_pendientes_interno(uuid, int, interval) from public, anon, authenticated;
revoke all on function public.ntf_resultados_interno(jsonb, uuid) from public, anon, authenticated;

-- Quien acaba de hacer una acción manda los correos de los avisos que provocó.
create or replace function public.ntf_correos_por_enviar()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    return '[]'::json;
  end if;
  return ntf_pendientes_interno(auth.uid(), 25, interval '1 day');
end;
$$;

create or replace function public.ntf_correo_resultado(p_resultados jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    return 0;
  end if;
  return ntf_resultados_interno(p_resultados, auth.uid());
end;
$$;

revoke all on function public.ntf_correos_por_enviar() from public, anon;
revoke all on function public.ntf_correo_resultado(jsonb) from public, anon;
grant execute on function public.ntf_correos_por_enviar() to authenticated;
grant execute on function public.ntf_correo_resultado(jsonb) to authenticated;

-- ── El cron diario ───────────────────────────────────────────────────────────
-- Vercel llama a /api/notificaciones/cron con `Authorization: Bearer <CRON_SECRET>`
-- y la ruta pasa el mismo secreto aquí. Solo se guarda su sha256.
create table if not exists ntf_ajustes (
  id                boolean primary key default true check (id),
  cron_secreto_hash text
);

alter table ntf_ajustes enable row level security;
-- Sin políticas: solo lo leen las funciones de abajo.

insert into ntf_ajustes (id) values (true) on conflict (id) do nothing;

create or replace function public.ntf_secreto_valido(p_secreto text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce((
    select cron_secreto_hash = encode(sha256(convert_to(coalesce(p_secreto, ''), 'UTF8')), 'hex')
    from ntf_ajustes
    where id
  ), false)
$$;

revoke all on function public.ntf_secreto_valido(text) from public, anon, authenticated;

create or replace function public.ntf_correos_sistema(p_secreto text)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not ntf_secreto_valido(p_secreto) then
    raise exception 'Secreto inválido' using errcode = '42501';
  end if;
  return ntf_pendientes_interno(null, 50, interval '3 days');
end;
$$;

create or replace function public.ntf_resultado_sistema(p_secreto text, p_resultados jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not ntf_secreto_valido(p_secreto) then
    raise exception 'Secreto inválido' using errcode = '42501';
  end if;
  return ntf_resultados_interno(p_resultados, null);
end;
$$;

-- La ruta del cron no tiene sesión: llama con la llave pública y el secreto.
revoke all on function public.ntf_correos_sistema(text) from public;
revoke all on function public.ntf_resultado_sistema(text, jsonb) from public;
grant execute on function public.ntf_correos_sistema(text) to anon, authenticated;
grant execute on function public.ntf_resultado_sistema(text, jsonb) to anon, authenticated;
