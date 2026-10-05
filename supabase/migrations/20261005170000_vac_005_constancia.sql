-- VAC-005 — La firma en la plataforma reemplaza al papel (decisión del 2026-10-05).
--
-- Lo que cambia:
--   · Cuando los días vienen de una solicitud, el formato GYC deja de ser un
--     papel para firmar: es la CONSTANCIA de tres firmas electrónicas (quién y
--     cuándo solicitó, autorizó y dio el Vo. Bo.).
--   · Como ya no hay papel que guardar, la persona y su jefe pueden ver la
--     constancia, no solo Gente y Cultura. El permiso se valida aquí.
--   · Los días que RH registra a mano no pasaron por esas firmas: su formato
--     sigue saliendo para firma autógrafa.

-- ── Datos del formato, con permiso ──────────────────────────────────────────
-- Lo ve: Gente y Cultura, la persona dueña de los días, o su jefe directo.
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
      'folio',          s.folio,
      'created_at',     s.created_at,
      'solicitada_por', (select nombre_completo from profiles where id = s.solicitada_por),
      'jefe_at',        s.jefe_at,
      'jefe_por',       (select nombre_completo from profiles where id = s.jefe_por),
      'rh_at',          s.rh_at,
      'rh_por',         (select nombre_completo from profiles where id = s.rh_por)
    ) end
  );
end;
$$;

grant execute on function public.vac_formato(uuid) to authenticated;

-- ── "Mis vacaciones" con el enlace a la constancia ──────────────────────────
-- Igual que en VAC-004, más `movimiento_id` en cada solicitud aprobada: es lo
-- que abre la constancia.
create or replace function public.vac_mis_vacaciones()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := vac_mi_empleado();
begin
  if v_yo is null then
    return json_build_object('empleado', null);
  end if;

  return json_build_object(
    'empleado', (vac_saldos_interno(v_yo) -> 0),
    'solicitudes', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'folio', s.folio, 'tipo', s.tipo,
        'fecha_inicio', s.fecha_inicio, 'fecha_fin', s.fecha_fin, 'dias', s.dias,
        'fecha_regreso', s.fecha_regreso, 'observaciones', s.observaciones,
        'estado', s.estado, 'created_at', s.created_at,
        'jefe_nombre', j.nombre, 'jefe_at', s.jefe_at, 'jefe_comentario', s.jefe_comentario,
        'rh_at', s.rh_at, 'rh_comentario', s.rh_comentario,
        'movimiento_id', (select m.id from vac_movimientos m
                           where m.solicitud_id = s.id and m.anulado_at is null
                           order by m.periodo nulls first limit 1)
      ) order by s.created_at desc)
      from vac_solicitudes s
      left join vac_empleados j on j.id = s.jefe_id
      where s.empleado_id = v_yo
    ), '[]'::json),
    'movimientos', coalesce((
      select json_agg(json_build_object(
        'tipo', m.tipo, 'periodo', m.periodo, 'dias', m.dias,
        'fecha_inicio', m.fecha_inicio, 'fecha_fin', m.fecha_fin,
        'fechas_texto', m.fechas_texto, 'origen', m.origen, 'created_at', m.created_at
      ) order by coalesce(m.fecha_inicio, m.created_at::date) desc)
      from vac_movimientos m
      where m.empleado_id = v_yo and m.anulado_at is null
    ), '[]'::json)
  );
end;
$$;
