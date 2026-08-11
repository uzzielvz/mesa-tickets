-- ================================================================
-- TKT-038 — Bitácora de cambios del ticket
--
-- Hasta ahora sabíamos EN QUÉ estado está un ticket, pero no cuánto
-- estuvo en cada uno ni quién lo tomó, soltó o reasignó. Sin esto no
-- hay métricas reales de atención (el SLA con pausas acumuladas, el
-- tiempo por técnico) ni auditoría de la cola.
--
-- Diseño: DOS triggers sobre `tickets` en vez de instrumentar cada
-- RPC. Así se captura *todo* camino que mueva el ticket — las RPCs,
-- el trigger de cierre que disparan las respuestas, y cualquier
-- update de admin — con un solo mecanismo imposible de esquivar.
-- ================================================================

create table ticket_historial (
  id                 uuid primary key default gen_random_uuid(),
  ticket_id          uuid not null references tickets(id) on delete cascade,
  -- Quién movió. NULL cuando el cambio no vino de una sesión (backfills).
  actor_id           uuid references profiles(id),
  evento             text not null check (evento in (
    'creado', 'tomado', 'devuelto', 'reasignado', 'cambio_estado'
  )),
  de_estado          ticket_estado,
  a_estado           ticket_estado,
  de_responsable_id  uuid references profiles(id),
  a_responsable_id   uuid references profiles(id),
  created_at         timestamptz not null default now()
);

create index idx_tkt_historial_ticket on ticket_historial(ticket_id, created_at);

-- Visibilidad = la del ticket. Escritura: nadie directo — solo los
-- triggers (security definer); sin política de insert, un cliente no
-- puede fabricar historia.
alter table ticket_historial enable row level security;

create policy "tkt_historial_select" on ticket_historial
  for select to authenticated
  using (
    exists (
      select 1 from tickets t
      where t.id = ticket_historial.ticket_id
        and (
          auth.uid() = t.levantado_por_id
          or auth.uid() = t.responsable_id
          or es_de_area(t.area_id)
          or is_admin(auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------

create or replace function log_ticket_creado()
returns trigger
language plpgsql security definer
as $$
begin
  insert into ticket_historial (ticket_id, actor_id, evento, a_estado, a_responsable_id)
  values (new.id, coalesce(auth.uid(), new.levantado_por_id), 'creado', new.estado, new.responsable_id);
  return new;
end;
$$;

drop trigger if exists trg_log_ticket_creado on tickets;
create trigger trg_log_ticket_creado
  after insert on tickets
  for each row execute function log_ticket_creado();

create or replace function log_ticket_cambio()
returns trigger
language plpgsql security definer
as $$
declare
  v_evento text;
begin
  -- Solo interesan estado y responsable; un update de otra columna no es historia.
  if old.estado is not distinct from new.estado
     and old.responsable_id is not distinct from new.responsable_id then
    return new;
  end if;

  -- El evento se deriva de QUÉ cambió, no de quién llamó.
  if old.responsable_id is distinct from new.responsable_id then
    if old.responsable_id is null then
      v_evento := 'tomado';
    elsif new.responsable_id is null then
      v_evento := 'devuelto';
    else
      v_evento := 'reasignado';
    end if;
  else
    v_evento := 'cambio_estado';
  end if;

  insert into ticket_historial (
    ticket_id, actor_id, evento,
    de_estado, a_estado, de_responsable_id, a_responsable_id
  )
  values (
    new.id, auth.uid(), v_evento,
    old.estado, new.estado, old.responsable_id, new.responsable_id
  );
  return new;
end;
$$;

drop trigger if exists trg_log_ticket_cambio on tickets;
create trigger trg_log_ticket_cambio
  after update on tickets
  for each row execute function log_ticket_cambio();
