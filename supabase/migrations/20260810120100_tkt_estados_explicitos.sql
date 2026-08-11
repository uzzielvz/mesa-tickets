-- ================================================================
-- TKT-032 — Estados explícitos
--
-- Hasta ahora el estatus se DEDUCÍA de la paridad del `orden` de la
-- última respuesta: impar = abierto, par = contestado. Dos problemas:
--   1. No existía "en proceso" — un técnico que está trabajando en el
--      ticket se ve igual que uno que nadie ha mirado.
--   2. La misma paridad impedía dos mensajes seguidos del mismo lado
--      (TKT-001): un follow-up del responsable tronaba con excepción.
--
-- Ahora el estado es una columna que controla quien atiende.
--
-- Compatibilidad: los tipos de respuesta existentes
-- (`terminado_responsable`, `terminado_usuario`, `rechazo_responsable`)
-- siguen funcionando igual y ahora además sincronizan `estado` por
-- trigger. El front actual no se rompe.
-- ================================================================

-- ---------------------------------------------------------------
-- 1) El estado
-- ---------------------------------------------------------------
--   abierto     — en la cola o recién tomado, nadie ha trabajado
--   en_revision — alguien lo está atendiendo
--   programado  — validado, entra en la siguiente tanda/corte
--   resuelto    — el responsable terminó, falta que el usuario confirme
--   cerrado     — el usuario confirmó
--   rechazado   — el responsable lo rechazó (con motivo)

do $$ begin
  create type ticket_estado as enum (
    'abierto', 'en_revision', 'programado', 'resuelto', 'cerrado', 'rechazado'
  );
exception when duplicate_object then null; end $$;

alter table tickets
  add column if not exists estado ticket_estado not null default 'abierto';

-- Backfill con la misma lógica derivada que tenía la vista, para que
-- ningún ticket vivo cambie de estatus al desplegar.
update tickets t
set estado = case
  when last_resp.tipo = 'rechazo_responsable'   then 'rechazado'
  when t.closed_at is not null                  then 'cerrado'
  when last_resp.tipo = 'terminado_usuario'     then 'cerrado'
  when last_resp.tipo = 'terminado_responsable' then 'resuelto'
  -- 'contestado' (el responsable ya escribió) es exactamente lo que
  -- ahora llamamos en_revision.
  when last_resp.orden is not null
   and last_resp.orden % 2 = 0                  then 'en_revision'
  else 'abierto'
end::ticket_estado
from (
  select t2.id as ticket_id, lr.orden, lr.tipo
  from tickets t2
  left join lateral (
    select orden, tipo from ticket_responses
    where ticket_id = t2.id order by orden desc limit 1
  ) lr on true
) last_resp
where last_resp.ticket_id = t.id;

create index if not exists idx_tickets_estado on tickets(estado);

-- ---------------------------------------------------------------
-- 2) Se acaba la paridad forzada (TKT-001)
-- ---------------------------------------------------------------
-- Se conserva la asignación automática de `orden` y la regla de que
-- solo el responsable puede rechazar o marcar terminado. Lo que
-- desaparece es la exigencia de alternar estrictamente.
--
-- Ahora `responsable_id` puede ser NULL (ticket en cola): en ese caso
-- nadie puede responder como responsable, que es justo lo que se
-- quiere — primero hay que tomarlo.

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

  -- Acciones reservadas a quien atiende
  if new.tipo in ('rechazo_responsable', 'terminado_responsable') then
    if v_responsable is null then
      raise exception 'El ticket todavía no ha sido tomado por nadie';
    end if;
    if new.autor_id != v_responsable then
      raise exception 'Solo el responsable puede hacer esa acción';
    end if;
    return new;
  end if;

  -- Confirmar el cierre es del solicitante
  if new.tipo = 'terminado_usuario' then
    if new.autor_id != v_levantado_por then
      raise exception 'Solo quien levantó el ticket puede confirmar el cierre';
    end if;
    return new;
  end if;

  -- Mensajes: cualquiera de los dos lados, las veces que haga falta
  if new.autor_id != v_levantado_por
     and (v_responsable is null or new.autor_id != v_responsable) then
    raise exception 'Solo el solicitante y el responsable participan en el hilo';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 3) Las respuestas mueven el estado
-- ---------------------------------------------------------------
-- El front actual sigue insertando respuestas tipadas; aquí se traduce
-- eso al estado, para no depender de que la UI se acuerde de hacerlo.

create or replace function handle_ticket_closure()
returns trigger
language plpgsql security definer
as $$
declare
  v_responsable uuid;
  v_estado      ticket_estado;
begin
  select responsable_id, estado into v_responsable, v_estado
  from tickets where id = new.ticket_id;

  if new.tipo in ('terminado_usuario', 'rechazo_responsable') then
    update tickets
    set closed_at = now(),
        estado = case when new.tipo = 'rechazo_responsable'
                      then 'rechazado'::ticket_estado
                      else 'cerrado'::ticket_estado end
    where id = new.ticket_id;

  elsif new.tipo = 'terminado_responsable' then
    update tickets set estado = 'resuelto' where id = new.ticket_id;

  elsif new.tipo = 'mensaje'
        and v_estado = 'abierto'
        and v_responsable is not null
        and new.autor_id = v_responsable then
    -- El responsable contestó por primera vez: ya lo está atendiendo.
    update tickets set estado = 'en_revision' where id = new.ticket_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 4) Cambiar el estado a mano
-- ---------------------------------------------------------------
-- Transiciones permitidas:
--   abierto      → en_revision, programado, resuelto, rechazado
--   en_revision  → programado, resuelto, rechazado
--   programado   → en_revision, resuelto, rechazado
--   resuelto     → cerrado (lo confirma el solicitante)
--                → en_revision (reabrir)
--   cerrado / rechazado → terminales
--
-- `rechazado` exige motivo, igual que hoy.

create or replace function tkt_cambiar_estado(
  p_ticket_id uuid,
  p_estado    ticket_estado,
  p_motivo    text default null
)
returns void
language plpgsql security definer
as $$
declare
  v_levantado_por uuid;
  v_responsable   uuid;
  v_estado        ticket_estado;
  v_es_admin      boolean;
begin
  if auth.uid() is null then
    raise exception 'no_auth';
  end if;

  select levantado_por_id, responsable_id, estado
  into v_levantado_por, v_responsable, v_estado
  from tickets
  where id = p_ticket_id;

  if not found then
    raise exception 'no_existe';
  end if;

  if p_estado = v_estado then
    return;  -- idempotente: doble clic no es error
  end if;

  if v_estado in ('cerrado', 'rechazado') then
    raise exception 'ticket_terminado';
  end if;

  v_es_admin := is_admin(auth.uid());

  -- Confirmar el cierre le toca a quien levantó
  if p_estado = 'cerrado' then
    if v_estado != 'resuelto' then
      raise exception 'transicion_invalida';
    end if;
    if auth.uid() != v_levantado_por and not v_es_admin then
      raise exception 'sin_acceso';
    end if;
    update tickets
    set estado = 'cerrado', closed_at = now()
    where id = p_ticket_id;
    return;
  end if;

  -- El resto lo controla quien atiende
  if auth.uid() != coalesce(v_responsable, '00000000-0000-0000-0000-000000000000'::uuid)
     and not v_es_admin then
    raise exception 'sin_acceso';
  end if;

  if p_estado = 'rechazado' then
    if coalesce(length(trim(p_motivo)), 0) < 10 then
      raise exception 'motivo_requerido';
    end if;
    insert into ticket_responses (ticket_id, autor_id, contenido, tipo)
    values (p_ticket_id, auth.uid(), trim(p_motivo), 'rechazo_responsable');
    return;  -- el trigger de cierre pone estado y closed_at
  end if;

  if p_estado = 'resuelto' then
    insert into ticket_responses (ticket_id, autor_id, contenido, tipo)
    values (
      p_ticket_id, auth.uid(),
      coalesce(nullif(trim(p_motivo), ''), 'Ticket resuelto.'),
      'terminado_responsable'
    );
    return;  -- el trigger pone estado = resuelto
  end if;

  if p_estado not in ('en_revision', 'programado') then
    raise exception 'transicion_invalida';
  end if;

  update tickets set estado = p_estado where id = p_ticket_id;
end;
$$;

grant execute on function tkt_cambiar_estado(uuid, ticket_estado, text) to authenticated;

-- ---------------------------------------------------------------
-- 5) Tomar un ticket también lo pone en revisión
-- ---------------------------------------------------------------

create or replace function tkt_tomar_ticket(p_ticket_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_area        uuid;
  v_responsable uuid;
begin
  if auth.uid() is null then
    raise exception 'no_auth';
  end if;

  select area_id, responsable_id
  into v_area, v_responsable
  from tickets
  where id = p_ticket_id;

  if not found then
    raise exception 'no_existe';
  end if;

  if v_responsable is not null then
    if v_responsable = auth.uid() then
      return;
    end if;
    raise exception 'ya_tomado';
  end if;

  if not (es_de_area(v_area) or is_admin(auth.uid())) then
    raise exception 'sin_acceso';
  end if;

  update tickets
  set responsable_id = auth.uid(),
      estado = case when estado = 'abierto' then 'en_revision'::ticket_estado
                    else estado end
  where id = p_ticket_id
    and responsable_id is null;
end;
$$;

-- ---------------------------------------------------------------
-- 6) La vista expone el estado real
-- ---------------------------------------------------------------
-- Dos cambios críticos:
--   · `left join profiles r` — con responsable NULL el join interno
--     hacía DESAPARECER de la vista justo los tickets de la cola.
--   · `status` deja de derivarse y sale de la columna, conservando el
--     nombre para no romper todo lo que ya lo consume.

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
  t.estado::text                    as status
from tickets t
join problem_catalog pc  on pc.id = t.problem_catalog_id
-- El área sale del ticket, no del catálogo: el ticket ya es dueño de su
-- cola y a futuro podrá transferirse sin cambiarle el tipo de problema.
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
