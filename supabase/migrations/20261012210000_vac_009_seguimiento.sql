-- VAC-009 — Reportes de seguimiento: calendario de ausencias y tiempos de
-- respuesta (pedido del 2026-10-12; los aniversarios salen de `vac_saldos`).
--
--   · Calendario: quién estará fuera y cuándo. Gente y Cultura ve a todos; un
--     jefe, solo a su equipo directo (para cubrir la operación). Incluye lo
--     aprobado o registrado y lo que sigue en trámite, marcado como tal.
--   · Tiempos: cuánto tarda cada paso (jefe, Vo. Bo.) y qué está atorado.
--     Mide el proceso; lo ve Gente y Cultura.

-- ── Calendario de ausencias ─────────────────────────────────────────────────
-- Forma: { ausencias: [{ empleado_id, nombre, puesto, area, jefe, tipo,
--          fecha_inicio, fecha_fin, dias, estado, origen }], festivos: [...] }
-- Una solicitud que tomó días de dos periodos son dos registros con las mismas
-- fechas: aquí se juntan en una sola ausencia.
create or replace function public.vac_calendario(p_desde date, p_hasta date)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_rh boolean := has_vacaciones_rh();
  v_yo uuid    := vac_mi_empleado();
begin
  if not v_rh and (v_yo is null or not exists (select 1 from vac_empleados where jefe_id = v_yo and activo)) then
    raise exception 'Sin acceso al calendario de ausencias' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Revisa el rango: la fecha final no puede ser antes de la inicial';
  end if;
  if p_hasta - p_desde > 370 then
    raise exception 'El calendario cubre como máximo un año';
  end if;

  return json_build_object(
    'ausencias', coalesce((
      select json_agg(x order by x.fecha_inicio, x.nombre)
      from (
        select e.id as empleado_id, e.nombre, e.puesto, e.area, j.nombre as jefe, m.tipo,
               m.fecha_inicio, coalesce(m.fecha_fin, m.fecha_inicio) as fecha_fin,
               sum(m.dias) as dias, 'aprobada' as estado, min(m.origen) as origen
        from vac_movimientos m
        join vac_empleados e on e.id = m.empleado_id
        left join vac_empleados j on j.id = e.jefe_id
        where m.anulado_at is null and m.fecha_inicio is not null and e.activo
          and daterange(m.fecha_inicio, coalesce(m.fecha_fin, m.fecha_inicio), '[]') && daterange(p_desde, p_hasta, '[]')
          and (v_rh or e.jefe_id = v_yo)
        group by e.id, e.nombre, e.puesto, e.area, j.nombre, m.tipo, m.fecha_inicio,
                 coalesce(m.fecha_fin, m.fecha_inicio), coalesce(m.solicitud_id, m.id)
        union all
        select e.id, e.nombre, e.puesto, e.area, j.nombre, s.tipo,
               s.fecha_inicio, s.fecha_fin, s.dias, s.estado, 'solicitud'
        from vac_solicitudes s
        join vac_empleados e on e.id = s.empleado_id
        left join vac_empleados j on j.id = e.jefe_id
        where s.estado in ('pendiente_jefe', 'pendiente_rh') and e.activo
          and daterange(s.fecha_inicio, s.fecha_fin, '[]') && daterange(p_desde, p_hasta, '[]')
          and (v_rh or e.jefe_id = v_yo)
      ) x
    ), '[]'::json),
    'festivos', coalesce((
      select json_agg(json_build_object('fecha', fecha, 'nombre', nombre) order by fecha)
      from vac_festivos where fecha between p_desde and p_hasta
    ), '[]'::json)
  );
end;
$$;

revoke all on function public.vac_calendario(date, date) from public, anon;
grant execute on function public.vac_calendario(date, date) to authenticated;

-- ── Tiempos de respuesta ────────────────────────────────────────────────────
-- Las solicitudes creadas en el rango, más TODAS las que siguen pendientes
-- (aunque sean de antes): esas son las atoradas.
--   horas_jefe: de la solicitud a la respuesta del jefe.
--   horas_rh:   de la autorización (o de la solicitud, si no hay jefe) al Vo. Bo.
--   espera_habil: días hábiles que lleva esperando en el paso actual.
create or replace function public.vac_tiempos(p_desde date, p_hasta date)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Revisa el rango: la fecha final no puede ser antes de la inicial';
  end if;

  return coalesce((
    select json_agg(x order by x.created_at)
    from (
      select s.folio, s.tipo, e.nombre as empleado, j.nombre as jefe, s.estado, s.dias,
             s.fecha_inicio, s.created_at, s.jefe_at, s.rh_at, s.cancelada_at,
             case when s.jefe_at is null then null
                  when s.estado = 'rechazada' and s.rh_at is null then 'rechazada'
                  else 'autorizada' end as jefe_resultado,
             round(extract(epoch from (s.jefe_at - s.created_at)) / 3600, 1) as horas_jefe,
             round(extract(epoch from (s.rh_at - coalesce(s.jefe_at, s.created_at))) / 3600, 1) as horas_rh,
             case s.estado
               when 'pendiente_jefe' then 'jefe'
               when 'pendiente_rh' then 'rh'
             end as paso,
             case s.estado
               when 'pendiente_jefe' then
                 vac_dias_habiles(((s.created_at at time zone 'America/Mexico_City')::date) + 1, v_hoy)
               when 'pendiente_rh' then
                 vac_dias_habiles(((coalesce(s.jefe_at, s.created_at) at time zone 'America/Mexico_City')::date) + 1, v_hoy)
             end as espera_habil
      from vac_solicitudes s
      join vac_empleados e on e.id = s.empleado_id
      left join vac_empleados j on j.id = s.jefe_id
      where s.estado in ('pendiente_jefe', 'pendiente_rh')
         or (s.created_at at time zone 'America/Mexico_City')::date between p_desde and p_hasta
    ) x
  ), '[]'::json);
end;
$$;

revoke all on function public.vac_tiempos(date, date) from public, anon;
grant execute on function public.vac_tiempos(date, date) to authenticated;
