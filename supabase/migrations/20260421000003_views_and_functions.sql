-- Vista principal: tickets con estatus derivado
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
    when t.closed_at is not null              then 'cerrado'
    when last_resp.tipo = 'terminado_usuario' then 'cerrado'
    when last_resp.tipo = 'terminado_responsable' then 'terminado'
    when last_resp.orden is null              then 'abierto'
    when last_resp.orden % 2 = 1             then 'abierto'
    when last_resp.orden % 2 = 0             then 'contestado'
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

-- Función: obtener el siguiente número de orden para un ticket
create or replace function next_response_order(p_ticket_id uuid)
returns int
language sql security definer stable
as $$
  select coalesce(max(orden), 0) + 1
  from ticket_responses
  where ticket_id = p_ticket_id
$$;
