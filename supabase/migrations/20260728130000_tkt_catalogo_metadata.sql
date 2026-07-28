-- ================================================================
-- TKT-023 — Metadata de catálogo: prioridad, SLA y modalidad
-- ================================================================
-- Agrega tres atributos por tipo de incidencia (problem_catalog):
--   - prioridad  (enum alta/media/baja) — orden visual en la bandeja (TKT-004)
--   - sla_min    (int, null = variable) — tiempo estimado de referencia (TKT-005,
--                acotado: solo referencia, sin alertas de vencimiento aún)
--   - modalidad  (enum remoto/presencial/ambas) — cómo se atiende
-- Recrea la vista tickets_with_status para exponer estas columnas.
-- Idempotente (if not exists / drop+create de la vista).
-- Ref: PLAN.md §2.2 (Fase Tickets-Catálogo Sistemas/TI)

-- Enums (idempotentes)
do $$ begin
  create type ticket_prioridad as enum ('alta', 'media', 'baja');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_modalidad as enum ('remoto', 'presencial', 'ambas');
exception when duplicate_object then null; end $$;

-- Columnas nuevas en el catálogo
alter table problem_catalog
  add column if not exists prioridad ticket_prioridad not null default 'media',
  add column if not exists sla_min   int,
  add column if not exists modalidad ticket_modalidad not null default 'ambas';

-- Recrear la vista para exponer prioridad/sla_min/modalidad.
-- (Postgres no permite CREATE OR REPLACE si cambia el conjunto de columnas.)
drop view if exists tickets_with_status;

create view tickets_with_status
with (security_invoker = true)
as
select
  t.*,
  a.nombre                          as area_nombre,
  pc.nombre                         as problema_nombre,
  pc.prioridad                      as prioridad,
  pc.sla_min                        as sla_min,
  pc.modalidad                      as modalidad,
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
