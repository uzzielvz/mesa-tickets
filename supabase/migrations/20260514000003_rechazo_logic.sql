-- ================================================================
-- RECHAZO — triggers y vista
-- (segunda parte, separada porque alter type add value no puede ir
--  en la misma transacción que su uso)
-- ================================================================

-- Validación de orden: ahora 'rechazo_responsable' viene del responsable
-- en cualquier orden, sin paridad. Los tipos terminado_* mantienen su
-- comportamiento original.
create or replace function validate_response_order()
returns trigger
language plpgsql security definer
as $$
declare
  v_levantado_por uuid;
  v_responsable   uuid;
begin
  select levantado_por_id, responsable_id
  into v_levantado_por, v_responsable
  from tickets
  where id = new.ticket_id;

  if new.orden is null then
    new.orden := next_response_order(new.ticket_id);
  end if;

  -- Rechazo: solo el responsable, sin restricción de paridad
  if new.tipo = 'rechazo_responsable' then
    if new.autor_id != v_responsable then
      raise exception 'Solo el responsable puede rechazar la solicitud';
    end if;
    return new;
  end if;

  -- Resto: paridad estricta como antes
  if new.orden % 2 = 1 then
    if new.autor_id != v_levantado_por then
      raise exception 'El orden % debe ser respondido por quien levantó el ticket', new.orden;
    end if;
  else
    if new.autor_id != v_responsable then
      raise exception 'El orden % debe ser respondido por el responsable', new.orden;
    end if;
  end if;

  return new;
end;
$$;

-- Cierre automático: tanto terminado_usuario como rechazo_responsable
-- cierran el ticket.
create or replace function handle_ticket_closure()
returns trigger
language plpgsql security definer
as $$
begin
  if new.tipo in ('terminado_usuario', 'rechazo_responsable') then
    update tickets
    set closed_at = now()
    where id = new.ticket_id;
  end if;
  return new;
end;
$$;

-- Vista con el nuevo estado 'rechazado'. Se evalúa antes que 'cerrado'
-- para que muestre 'rechazado' aunque closed_at ya esté seteado por el
-- trigger.
create or replace view tickets_with_status
with (security_invoker = true)
as
select
  t.*,
  a.nombre                          as area_nombre,
  pc.nombre                         as problema_nombre,
  lp.nombre_completo                as levantado_por_nombre,
  r.nombre_completo                 as responsable_nombre,
  last_resp.created_at              as ultima_respuesta_at,
  case
    when last_resp.tipo = 'rechazo_responsable'   then 'rechazado'
    when t.closed_at is not null                  then 'cerrado'
    when last_resp.tipo = 'terminado_usuario'     then 'cerrado'
    when last_resp.tipo = 'terminado_responsable' then 'terminado'
    when last_resp.orden is null                  then 'abierto'
    when last_resp.orden % 2 = 1                  then 'abierto'
    when last_resp.orden % 2 = 0                  then 'contestado'
  end::text                         as status
from tickets t
join problem_catalog pc  on pc.id = t.problem_catalog_id
join areas a             on a.id  = pc.area_id
join profiles lp         on lp.id = t.levantado_por_id
join profiles r          on r.id  = t.responsable_id
left join lateral (
  select orden, tipo, created_at
  from ticket_responses
  where ticket_id = t.id
  order by orden desc
  limit 1
) last_resp on true;
