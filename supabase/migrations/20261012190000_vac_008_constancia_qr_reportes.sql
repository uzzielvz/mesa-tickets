-- VAC-008 — Constancia en PDF con QR de verificación, y reportes en Excel.
--
-- Pedido del 2026-10-12: exportar reportes (la base al día y las solicitudes
-- por rango de fechas) y descargar el formato GYC como PDF "que parezca
-- firmado", con la hora de cada firma y un QR.
--
--   · Cada solicitud lleva un código de verificación aleatorio (no adivinable).
--     El QR de la constancia lleva a /verificar/<código>, una página PÚBLICA
--     (quien recibe el papel no necesariamente tiene cuenta) que confirma que
--     el documento salió de la plataforma y si sigue vigente o se anuló.
--   · La página pública solo responde por solicitudes que llegaron al Vo. Bo.
--     (las únicas que tienen constancia), y enseña lo mismo que trae el papel.
--   · Los reportes son de Gente y Cultura (`has_vacaciones_rh`).

-- ── Código de verificación ──────────────────────────────────────────────────
-- Default volátil: al agregar la columna, cada fila existente recibe el suyo.
alter table vac_solicitudes
  add column if not exists codigo_verificacion text not null unique
  default replace(gen_random_uuid()::text, '-', '');

comment on column vac_solicitudes.codigo_verificacion is
  'VAC-008: código del QR de la constancia (/verificar/<código>). 32 hex aleatorios; no se reutiliza.';

-- ── La constancia, con su código ────────────────────────────────────────────
-- Igual que en vac_005, más `codigo_verificacion` y `estado` de la solicitud.
create or replace function public.vac_formato(p_movimiento uuid)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  m        vac_movimientos%rowtype;
  s        vac_solicitudes%rowtype;
  v_yo     uuid := vac_mi_empleado();
  v_jefe   uuid;
  v_tomado numeric;
begin
  select * into m from vac_movimientos where id = p_movimiento;
  if not found or m.anulado_at is not null then
    return null;
  end if;

  select jefe_id into v_jefe from vac_empleados where id = m.empleado_id;
  if not (has_vacaciones_rh() or m.empleado_id = v_yo or (v_yo is not null and v_jefe = v_yo)) then
    raise exception 'Sin acceso a este formato' using errcode = '42501';
  end if;

  -- "Días pendientes" al momento de ESTE registro, no al día de hoy: el
  -- formato se puede volver a abrir semanas después y debe decir lo mismo.
  select coalesce(sum(dias), 0) into v_tomado
  from vac_movimientos
  where empleado_id = m.empleado_id and tipo = 'vacaciones'
    and periodo is not distinct from m.periodo and anulado_at is null
    and created_at <= m.created_at;

  if m.solicitud_id is not null then
    select * into s from vac_solicitudes where id = m.solicitud_id;
  end if;

  return json_build_object(
    'movimiento',         row_to_json(m),
    'empleado',           vac_saldos_interno(m.empleado_id) -> 0,
    'tomados_hasta_aqui', v_tomado,
    'registrado_por',     (select nombre_completo from profiles where id = m.registrado_por),
    'solicitud', case when m.solicitud_id is null then null else json_build_object(
      'folio',               s.folio,
      'estado',              s.estado,
      'codigo_verificacion', s.codigo_verificacion,
      'created_at',          s.created_at,
      'solicitada_por',      (select nombre_completo from profiles where id = s.solicitada_por),
      'jefe_at',             s.jefe_at,
      'jefe_por',            (select nombre_completo from profiles where id = s.jefe_por),
      'rh_at',               s.rh_at,
      'rh_por',              (select nombre_completo from profiles where id = s.rh_por)
    ) end
  );
end;
$$;

-- ── Verificación pública (el QR) ────────────────────────────────────────────
-- Sin sesión. Solo solicitudes que pasaron por el Vo. Bo.: aprobadas, o
-- canceladas DESPUÉS de aprobarse (anuladas por RH). Una cancelada por la
-- persona nunca tuvo constancia (rh_at es null).
create or replace function public.vac_verificar(p_codigo text)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  s vac_solicitudes%rowtype;
  e vac_empleados%rowtype;
begin
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into s from vac_solicitudes
  where codigo_verificacion = p_codigo
    and rh_at is not null
    and estado in ('aprobada', 'cancelada');
  if not found then
    return null;
  end if;

  select * into e from vac_empleados where id = s.empleado_id;

  return json_build_object(
    'folio',         s.folio,
    'tipo',          s.tipo,
    'empleado',      e.nombre,
    'puesto',        e.puesto,
    'fecha_inicio',  s.fecha_inicio,
    'fecha_fin',     s.fecha_fin,
    'dias',          s.dias,
    'fecha_regreso', s.fecha_regreso,
    'estado',        s.estado,
    'cancelada_at',  s.cancelada_at,
    'firmas', json_build_array(
      json_build_object('rol', 'Conformidad del empleado',
                        'nombre', (select nombre_completo from profiles where id = s.solicitada_por),
                        'at', s.created_at),
      json_build_object('rol', 'Autorización del jefe directo',
                        'nombre', (select nombre_completo from profiles where id = s.jefe_por),
                        'at', s.jefe_at),
      json_build_object('rol', case when s.tipo = 'vacaciones' then 'Vo. Bo. Recursos Humanos'
                                    else 'Vo. Bo. Coordinador Gente y Cultura' end,
                        'nombre', (select nombre_completo from profiles where id = s.rh_por),
                        'at', s.rh_at)
    )
  );
end;
$$;

revoke all on function public.vac_verificar(text) from public;
grant execute on function public.vac_verificar(text) to anon, authenticated;

-- ── Reporte por rango de fechas (Gente y Cultura) ───────────────────────────
-- Todo lo que cae (aunque sea en parte) dentro del rango: las solicitudes en
-- cualquier estado, y los días tomados vigentes (de solicitud, registrados por
-- RH o importados con fecha). Los importados sin fecha legible se cuentan aparte.
create or replace function public.vac_reporte_periodo(p_desde date, p_hasta date)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Revisa el rango: la fecha final no puede ser antes de la inicial';
  end if;
  if p_hasta - p_desde > 731 then
    raise exception 'El rango máximo es de dos años';
  end if;

  return json_build_object(
    'solicitudes', coalesce((
      select json_agg(x order by x.fecha_inicio, x.empleado)
      from (
        select s.folio, s.tipo, e.nombre as empleado, e.puesto, e.area, j.nombre as jefe,
               s.fecha_inicio, s.fecha_fin, s.dias, s.fecha_regreso, s.estado, s.observaciones,
               s.created_at,
               s.jefe_at, (select nombre_completo from profiles where id = s.jefe_por) as jefe_por,
               s.jefe_comentario,
               s.rh_at, (select nombre_completo from profiles where id = s.rh_por) as rh_por,
               s.rh_comentario, s.cancelada_at
        from vac_solicitudes s
        join vac_empleados e on e.id = s.empleado_id
        left join vac_empleados j on j.id = s.jefe_id
        where daterange(s.fecha_inicio, s.fecha_fin, '[]') && daterange(p_desde, p_hasta, '[]')
      ) x
    ), '[]'::json),
    'dias_tomados', coalesce((
      select json_agg(x order by x.fecha_inicio, x.empleado)
      from (
        select m.folio, m.tipo, e.nombre as empleado, e.puesto, e.area, m.periodo, m.dias,
               m.fecha_inicio, m.fecha_fin, m.fecha_regreso, m.origen, m.observaciones, m.created_at,
               (select nombre_completo from profiles where id = m.registrado_por) as registrado_por,
               (select sv.folio from vac_solicitudes sv where sv.id = m.solicitud_id) as folio_solicitud
        from vac_movimientos m
        join vac_empleados e on e.id = m.empleado_id
        where m.anulado_at is null and m.fecha_inicio is not null
          and daterange(m.fecha_inicio, coalesce(m.fecha_fin, m.fecha_inicio), '[]')
              && daterange(p_desde, p_hasta, '[]')
      ) x
    ), '[]'::json),
    'importados_sin_fecha', (
      select count(*) from vac_movimientos where anulado_at is null and fecha_inicio is null
    )
  );
end;
$$;

revoke all on function public.vac_reporte_periodo(date, date) from public, anon;
grant execute on function public.vac_reporte_periodo(date, date) to authenticated;
