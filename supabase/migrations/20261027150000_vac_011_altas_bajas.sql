-- VAC-011 — Altas y bajas de personal desde la plataforma (27 de octubre).
--
-- Pedido de Jesús Montellano en la junta del 27 de octubre: cuando entra
-- alguien, Gente y Cultura lo da de alta; cuando se va, lo da de baja. Hasta
-- hoy el alta solo se hacía por SQL, y el nombre y la fecha de ingreso no se
-- podían corregir desde la pantalla.
--
-- Todo pasa por RPCs (solo RH):
--   · vac_alta_empleado      — persona nueva.
--   · vac_guardar_empleado   — corregir cualquier dato, nombre y fecha de ingreso incluidos.
--   · vac_baja_empleado      — baja con fecha y motivo. Nada se borra.
--   · vac_reactivar_empleado — deshacer una baja (o alguien que regresa).
--
-- Qué hace una baja, para que nada se quede atorado:
--   · Sus solicitudes pendientes se cancelan.
--   · Las solicitudes que esperaban su autorización como jefe pasan directo al
--     Vo. Bo. de RH.
--   · Las personas a su cargo quedan sin jefe (sus solicitudes irán directo a
--     RH) y la pantalla avisa para que se les asigne otro.
-- La persona ya no puede entrar a "Mis vacaciones": `vac_mi_empleado` solo
-- reconoce a los activos.

alter table vac_empleados
  add column if not exists fecha_baja  date,
  add column if not exists motivo_baja text;

comment on column vac_empleados.fecha_baja is
  'VAC-011: último día en la empresa. Null mientras está activo.';

-- La llave del import: sin acentos, mayúsculas, espacios simples. Sirve para
-- no dar de alta dos veces a la misma persona.
create or replace function public.vac_nombre_clave(p text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(trim(translate(coalesce(p, ''),
    'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙ', 'aeiouunAEIOUUNaeiouAEIOU')), '\s+', ' ', 'g'))
$$;

-- Validaciones compartidas por el alta y la corrección. Devuelve el correo ya
-- limpio (minúsculas, sin espacios) o null.
create or replace function public.vac_validar_empleado(
  p_id            uuid,
  p_nombre        text,
  p_fecha_ingreso date,
  p_email         text,
  p_jefe_id       uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy   date := (now() at time zone 'America/Mexico_City')::date;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_otro  record;
begin
  if nullif(trim(coalesce(p_nombre, '')), '') is null then
    raise exception 'Escribe el nombre completo';
  end if;
  if p_fecha_ingreso is null then
    raise exception 'Falta la fecha de ingreso: con ella se calculan los días';
  end if;
  if p_fecha_ingreso < date '1980-01-01' or p_fecha_ingreso > v_hoy + 90 then
    raise exception 'Revisa la fecha de ingreso: %', to_char(p_fecha_ingreso, 'DD/MM/YYYY');
  end if;

  -- Contra el nombre, no contra `nombre_clave`: la del import la calculó un
  -- script local que pudo normalizar distinto (la Ñ, por ejemplo).
  select nombre, activo into v_otro from vac_empleados
  where vac_nombre_clave(nombre) = vac_nombre_clave(p_nombre) and id is distinct from p_id;
  if found then
    raise exception 'Ya existe % en la base%. Búscalo en la lista%.', v_otro.nombre,
      case when v_otro.activo then '' else ' (dado de baja)' end,
      case when v_otro.activo then '' else ' de inactivos y reactívalo desde su ficha' end;
  end if;

  if v_email is not null then
    if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
      raise exception 'El correo no parece válido: %', v_email;
    end if;
    select nombre into v_otro from vac_empleados
    where lower(email) = v_email and id is distinct from p_id;
    if found then
      raise exception 'El correo % ya es de %', v_email, v_otro.nombre;
    end if;
  end if;

  if p_jefe_id is not null then
    if p_jefe_id = p_id then
      raise exception 'Una persona no puede ser su propio jefe';
    end if;
    if not exists (select 1 from vac_empleados where id = p_jefe_id and activo) then
      raise exception 'El jefe elegido no está activo en la base';
    end if;
  end if;

  return v_email;
end;
$$;

revoke all on function public.vac_validar_empleado(uuid, text, date, text, uuid) from public, anon, authenticated;

-- ── Alta ─────────────────────────────────────────────────────────────────────
create or replace function public.vac_alta_empleado(
  p_nombre          text,
  p_fecha_ingreso   date,
  p_email           text default null,
  p_puesto          text default null,
  p_area            text default null,
  p_numero_empleado text default null,
  p_jefe_id         uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_email text;
  v_id    uuid;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  v_email := vac_validar_empleado(null, p_nombre, p_fecha_ingreso, p_email, p_jefe_id);

  insert into vac_empleados (nombre, nombre_clave, fecha_ingreso, email, puesto, area, numero_empleado, jefe_id)
  values (
    upper(regexp_replace(trim(p_nombre), '\s+', ' ', 'g')), vac_nombre_clave(p_nombre), p_fecha_ingreso, v_email,
    nullif(trim(coalesce(p_puesto, '')), ''), nullif(trim(coalesce(p_area, '')), ''),
    nullif(trim(coalesce(p_numero_empleado, '')), ''), p_jefe_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.vac_alta_empleado(text, date, text, text, text, text, uuid) from public, anon;
grant execute on function public.vac_alta_empleado(text, date, text, text, text, text, uuid) to authenticated;

-- ── Corregir datos ───────────────────────────────────────────────────────────
-- Cambiar la fecha de ingreso recalcula los periodos; lo ya tomado se queda
-- en el año de servicio donde se registró.
create or replace function public.vac_guardar_empleado(
  p_id              uuid,
  p_nombre          text,
  p_fecha_ingreso   date,
  p_email           text,
  p_puesto          text,
  p_area            text,
  p_numero_empleado text,
  p_jefe_id         uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_email text;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  if not exists (select 1 from vac_empleados where id = p_id) then
    raise exception 'No existe esa persona';
  end if;
  v_email := vac_validar_empleado(p_id, p_nombre, p_fecha_ingreso, p_email, p_jefe_id);

  update vac_empleados set
    nombre          = upper(regexp_replace(trim(p_nombre), '\s+', ' ', 'g')),
    nombre_clave    = vac_nombre_clave(p_nombre),
    fecha_ingreso   = p_fecha_ingreso,
    email           = v_email,
    puesto          = nullif(trim(coalesce(p_puesto, '')), ''),
    area            = nullif(trim(coalesce(p_area, '')), ''),
    numero_empleado = nullif(trim(coalesce(p_numero_empleado, '')), ''),
    jefe_id         = p_jefe_id
  where id = p_id;
end;
$$;

revoke all on function public.vac_guardar_empleado(uuid, text, date, text, text, text, text, uuid) from public, anon;
grant execute on function public.vac_guardar_empleado(uuid, text, date, text, text, text, text, uuid) to authenticated;

-- ── Baja ─────────────────────────────────────────────────────────────────────
create or replace function public.vac_baja_empleado(p_id uuid, p_fecha_baja date, p_motivo text default null)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  e           vac_empleados%rowtype;
  v_canceladas int;
  v_a_rh       int;
  v_equipo     json;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  select * into e from vac_empleados where id = p_id for update;
  if not found then
    raise exception 'No existe esa persona';
  end if;
  if not e.activo then
    raise exception '% ya tiene registrada su baja', e.nombre;
  end if;
  if p_fecha_baja is null then
    raise exception 'Falta la fecha de baja';
  end if;
  if p_fecha_baja < e.fecha_ingreso then
    raise exception 'La fecha de baja no puede ser antes del ingreso (%)', to_char(e.fecha_ingreso, 'DD/MM/YYYY');
  end if;

  update vac_empleados
     set activo = false, fecha_baja = p_fecha_baja,
         motivo_baja = nullif(trim(coalesce(p_motivo, '')), '')
   where id = p_id;

  -- Lo suyo que seguía en trámite ya no procede.
  update vac_solicitudes set estado = 'cancelada'
   where empleado_id = p_id and estado in ('pendiente_jefe', 'pendiente_rh');
  get diagnostics v_canceladas = row_count;

  -- Lo que esperaba su autorización pasa directo a RH.
  update vac_solicitudes
     set estado = 'pendiente_rh', jefe_id = null,
         jefe_comentario = 'Su jefe fue dado de baja: pasa directo al Vo. Bo. de Gente y Cultura.'
   where jefe_id = p_id and estado = 'pendiente_jefe';
  get diagnostics v_a_rh = row_count;

  -- Su equipo se queda sin jefe hasta que RH le asigne otro.
  select coalesce(json_agg(json_build_object('id', id, 'nombre', nombre) order by nombre), '[]'::json)
    into v_equipo
    from vac_empleados where jefe_id = p_id and activo;
  update vac_empleados set jefe_id = null where jefe_id = p_id and activo;

  return json_build_object(
    'solicitudes_canceladas', v_canceladas,
    'pasaron_a_rh', v_a_rh,
    'equipo_sin_jefe', v_equipo
  );
end;
$$;

revoke all on function public.vac_baja_empleado(uuid, date, text) from public, anon;
grant execute on function public.vac_baja_empleado(uuid, date, text) to authenticated;

-- ── Reactivar ────────────────────────────────────────────────────────────────
create or replace function public.vac_reactivar_empleado(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  update vac_empleados set activo = true, fecha_baja = null, motivo_baja = null
   where id = p_id and not activo;
  if not found then
    raise exception 'Esa persona no está dada de baja';
  end if;
end;
$$;

revoke all on function public.vac_reactivar_empleado(uuid) from public, anon;
grant execute on function public.vac_reactivar_empleado(uuid) to authenticated;
