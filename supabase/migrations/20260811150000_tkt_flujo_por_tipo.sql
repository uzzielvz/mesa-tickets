-- ================================================================
-- TKT-044 — Flujo simple por tipo de problema
--
-- El flujo era igual para todos: el técnico veía "Programado" aunque
-- no significara nada para su caso (una cámara descompuesta no entra
-- en ninguna tanda), y "En revisión" era un botón que nadie usaba
-- porque ya se pone solo al tomar el ticket.
--
-- Hallazgo que simplificó el diseño: `Programado`, `Esperando
-- refacción` y `Esperando al usuario` son LA MISMA COSA — el reloj se
-- detiene porque ahora no depende del técnico. Solo cambia el nombre.
-- Así que no hacen falta varios flujos ni estados nuevos: basta una
-- ETIQUETA por tipo sobre el estado `programado` que ya existe.
--
-- Criterio para decidir quién lleva pausa: un estado solo se justifica
-- si alguien toma una decisión distinta al verlo. Si nadie va a
-- filtrar por "esperando refacción", que el técnico lo escriba en el
-- hilo y ya.
-- ================================================================

alter table problem_catalog
  add column if not exists etiqueta_pausa text;

comment on column problem_catalog.etiqueta_pausa is
  'Nombre del botón de pausa para este tipo (usa el estado `programado`). NULL = sin pausa: el flujo es Tomar → Resolver.';

-- ---------------------------------------------------------------
-- Seed del catálogo actual (tabla aprobada 2026-08-11)
-- ---------------------------------------------------------------
-- Los 5 tipos operativos de Sistemas quedan SIN pausa: dos clics,
-- tomar y resolver. "Usuarios y accesos" incluido, porque con SLA de
-- 20 min —el más corto del catálogo— un alta no necesita estado
-- intermedio.
-- Coincidencia por `ilike` para no depender del nombre exacto.

update problem_catalog set etiqueta_pausa = 'Programado'
where nombre ilike '%servicio de TI%';

update problem_catalog set etiqueta_pausa = 'Esperando al usuario'
where nombre ilike '%falla en el sistema%'
   or nombre ilike '%aclaraci%mora%';

update problem_catalog set etiqueta_pausa = 'Entra en el siguiente corte'
where nombre ilike '%error en mora%'
   or nombre ilike '%ficha no reflejada%'
   or nombre ilike '%cr%dito faltante%';

-- ---------------------------------------------------------------
-- Los presenciales cierran directo
-- ---------------------------------------------------------------
-- Si el técnico fue físicamente y lo arregló, el usuario ya vio que
-- quedó: pedirle que entre a confirmar es burocracia. En los remotos
-- la confirmación sí vale, porque nadie presenció el arreglo.
--
-- Va en el trigger y no en la UI para que aplique venga por donde
-- venga (composer, RPC o un update de admin).

create or replace function handle_ticket_closure()
returns trigger
language plpgsql security definer
as $$
declare
  v_responsable uuid;
  v_estado      ticket_estado;
  v_modalidad   text;
begin
  select t.responsable_id, t.estado, pc.modalidad::text
  into v_responsable, v_estado, v_modalidad
  from tickets t
  join problem_catalog pc on pc.id = t.problem_catalog_id
  where t.id = new.ticket_id;

  if new.tipo in ('terminado_usuario', 'rechazo_responsable') then
    update tickets
    set closed_at = now(),
        estado = case when new.tipo = 'rechazo_responsable'
                      then 'rechazado'::ticket_estado
                      else 'cerrado'::ticket_estado end
    where id = new.ticket_id;

  elsif new.tipo = 'terminado_responsable' then
    if v_modalidad = 'presencial' then
      -- El técnico estuvo ahí; no hay nada que confirmar.
      update tickets
      set estado = 'cerrado', closed_at = now()
      where id = new.ticket_id;
    else
      update tickets set estado = 'resuelto' where id = new.ticket_id;
    end if;

  elsif new.tipo = 'mensaje'
        and v_estado = 'abierto'
        and v_responsable is not null
        and new.autor_id = v_responsable then
    update tickets set estado = 'en_revision' where id = new.ticket_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------
-- La vista expone la etiqueta
-- ---------------------------------------------------------------

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
  pc.etiqueta_pausa                 as etiqueta_pausa,
  lp.nombre_completo                as levantado_por_nombre,
  r.nombre_completo                 as responsable_nombre,
  last_resp.created_at              as ultima_respuesta_at,
  t.estado::text                    as status
from tickets t
join problem_catalog pc  on pc.id = t.problem_catalog_id
join areas a             on a.id  = t.area_id
join profiles lp         on lp.id = t.levantado_por_id
left join profiles r     on r.id  = t.responsable_id
left join lateral (
  select orden, tipo, created_at
  from ticket_responses
  where ticket_id = t.id
  order by orden desc
  limit 1
) last_resp on true;
