-- VAC-012 — La baja registra la hora de cancelación (29 de octubre).
--
-- En VAC-011, dar de baja a alguien cancelaba sus solicitudes en trámite sin
-- llenar `cancelada_at`, que sí llena la cancelación normal. Los reportes de
-- tiempos y la verificación del QR la leen. Mismo vac_baja_empleado, solo
-- con esa columna.

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
  update vac_solicitudes set estado = 'cancelada', cancelada_at = now()
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
