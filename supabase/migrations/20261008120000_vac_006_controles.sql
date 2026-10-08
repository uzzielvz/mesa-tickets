-- VAC-006 — Dos controles que salieron al preparar la prueba piloto.
--
-- 1. Nadie da el Vo. Bo. de RH a su propia solicitud. Montellano es Gente y
--    Cultura y también empleado: su solicitud la cierra otra persona de RH.
-- 2. Si RH anula los días de una solicitud aprobada (la persona ya no se va,
--    o fue una prueba), la solicitud pasa a "cancelada". Antes se quedaba en
--    "aprobada" con los días ya devueltos al saldo.

create or replace function public.vac_resolver_rh(p_id uuid, p_aprueba boolean, p_comentario text default null)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s   vac_solicitudes%rowtype;
  a   record;
  v_n int := 0;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;

  select * into s from vac_solicitudes where id = p_id for update;
  if not found or s.estado <> 'pendiente_rh' then
    raise exception 'Esa solicitud no está esperando el Vo. Bo. de RH';
  end if;
  if s.empleado_id = vac_mi_empleado() then
    raise exception 'No puedes dar el Vo. Bo. a tu propia solicitud: la resuelve otra persona de Gente y Cultura'
      using errcode = '42501';
  end if;

  if not p_aprueba then
    if nullif(trim(coalesce(p_comentario, '')), '') is null then
      raise exception 'Escribe el motivo del rechazo: la persona lo va a leer';
    end if;
    update vac_solicitudes
       set estado = 'rechazada', rh_at = now(), rh_por = auth.uid(), rh_comentario = trim(p_comentario)
     where id = p_id;
    return json_build_object('estado', 'rechazada', 'movimientos', 0);
  end if;

  if s.tipo = 'vacaciones' then
    for a in select * from vac_asignar_periodos(s.empleado_id, s.dias) loop
      insert into vac_movimientos (empleado_id, tipo, periodo, dias, fecha_inicio, fecha_fin, fecha_regreso,
                                   observaciones, origen, registrado_por, solicitud_id)
      values (s.empleado_id, 'vacaciones', a.periodo, a.dias, s.fecha_inicio, s.fecha_fin, s.fecha_regreso,
              s.observaciones, 'solicitud', auth.uid(), s.id);
      v_n := v_n + 1;
    end loop;
  else
    insert into vac_movimientos (empleado_id, tipo, periodo, dias, fecha_inicio, fecha_fin, fecha_regreso,
                                 observaciones, origen, registrado_por, solicitud_id)
    values (s.empleado_id, 'flotante', null, s.dias, s.fecha_inicio, s.fecha_fin, s.fecha_regreso,
            s.observaciones, 'solicitud', auth.uid(), s.id);
    v_n := 1;
  end if;

  update vac_solicitudes
     set estado = 'aprobada', rh_at = now(), rh_por = auth.uid(),
         rh_comentario = nullif(trim(coalesce(p_comentario, '')), '')
   where id = p_id;

  return json_build_object('estado', 'aprobada', 'movimientos', v_n);
end;
$$;

-- Anular todos los días de una solicitud aprobada la cancela. Va como trigger
-- para que valga por cualquier camino (la pantalla de RH anula directo).
create or replace function public.vac_tr_movimiento_anulado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.solicitud_id is not null and new.anulado_at is not null and old.anulado_at is null
     and not exists (
       select 1 from vac_movimientos
       where solicitud_id = new.solicitud_id and anulado_at is null
     ) then
    update vac_solicitudes
       set estado = 'cancelada', cancelada_at = now()
     where id = new.solicitud_id and estado = 'aprobada';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vac_movimiento_anulado on vac_movimientos;
create trigger trg_vac_movimiento_anulado
  after update of anulado_at on vac_movimientos
  for each row execute function vac_tr_movimiento_anulado();
