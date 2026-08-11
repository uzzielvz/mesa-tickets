-- ================================================================
-- TKT-031 — Modelo de cola por área
--
-- Hasta ahora el ticket nacía con un responsable FIJO (el
-- `responsable_default_id` del catálogo). Si esa persona no estaba,
-- el ticket se atascaba: nadie más lo veía siquiera.
--
-- A partir de aquí el ticket pertenece a un ÁREA (la cola) y
-- `responsable_id` queda NULL hasta que alguien del área lo toma.
--
-- Todo es aditivo: los tickets existentes conservan su responsable y
-- siguen funcionando igual.
-- ================================================================

-- ---------------------------------------------------------------
-- 1) El ticket guarda su área
-- ---------------------------------------------------------------
-- Se desnormaliza (en vez de leerla siempre vía problem_catalog)
-- por dos razones: la política RLS se evalúa por fila y un join ahí
-- se paga caro, y a futuro permite mover un ticket de área sin
-- reescribir su tipo de problema (TKT-002, transferencia).

alter table tickets
  add column if not exists area_id uuid references areas(id);

update tickets t
set area_id = pc.area_id
from problem_catalog pc
where pc.id = t.problem_catalog_id
  and t.area_id is null;

alter table tickets
  alter column area_id set not null;

create index if not exists idx_tickets_area_id on tickets(area_id);

-- Relleno automático. Las mutaciones de tickets todavía se hacen con
-- el cliente Supabase desde el navegador (`ticket-form.tsx`), así que
-- el área NO puede depender de que el front la mande: aquí nadie
-- puede crear un ticket sin cola aunque lo intente.
create or replace function set_ticket_area()
returns trigger
language plpgsql security definer
as $$
begin
  if new.area_id is null then
    select area_id into new.area_id
    from problem_catalog
    where id = new.problem_catalog_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_ticket_area on tickets;
create trigger trg_set_ticket_area
  before insert on tickets
  for each row execute function set_ticket_area();

-- ---------------------------------------------------------------
-- 2) El responsable deja de ser obligatorio
-- ---------------------------------------------------------------
-- NULL = en la cola, sin tomar.

alter table tickets
  alter column responsable_id drop not null;

comment on column tickets.responsable_id is
  'Quién atiende el ticket. NULL = todavía en la cola del área, sin tomar.';

-- ---------------------------------------------------------------
-- 3) Pertenencia al área
-- ---------------------------------------------------------------
-- `security definer` para que la política no dependa de las RLS de
-- profiles, igual que `is_admin()`.

create or replace function es_de_area(p_area_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and area_id = p_area_id
  );
$$;

-- ---------------------------------------------------------------
-- 4) RLS: el área ve su cola
-- ---------------------------------------------------------------

drop policy if exists "tickets_select" on tickets;

create policy "tickets_select" on tickets
  for select to authenticated
  using (
    auth.uid() = levantado_por_id
    or auth.uid() = responsable_id
    or es_de_area(area_id)
    or is_admin(auth.uid())
  );

-- Las respuestas y los adjuntos cuelgan de la visibilidad del ticket:
-- si el área ya puede ver el ticket, tiene que poder leer su hilo.
drop policy if exists "responses_select" on ticket_responses;

create policy "responses_select" on ticket_responses
  for select to authenticated
  using (
    exists (
      select 1 from tickets t
      where t.id = ticket_responses.ticket_id
        and (
          auth.uid() = t.levantado_por_id
          or auth.uid() = t.responsable_id
          or es_de_area(t.area_id)
          or is_admin(auth.uid())
        )
    )
  );

drop policy if exists "attachments_select" on ticket_attachments;

create policy "attachments_select" on ticket_attachments
  for select to authenticated
  using (
    exists (
      select 1 from tickets t
      where t.id = ticket_attachments.ticket_id
        and (
          auth.uid() = t.levantado_por_id
          or auth.uid() = t.responsable_id
          or es_de_area(t.area_id)
          or is_admin(auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------
-- 5) Tomar un ticket de la cola
-- ---------------------------------------------------------------
-- Vía RPC y no con una política UPDATE: una política lo bastante
-- amplia para permitir el self-assign también abriría la puerta a
-- editar otras columnas. Aquí la única escritura posible es la que
-- esta función hace, y valida adentro (mismo patrón que
-- `rec_transicion_etapa`).
--
-- Códigos de error pensados para mapearse a español en el cliente.

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

  -- Ya lo tomó alguien. Si fue uno mismo, no es error: la acción ya
  -- surtió efecto (doble clic, dos pestañas abiertas).
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
  set responsable_id = auth.uid()
  where id = p_ticket_id
    and responsable_id is null;  -- carrera: gana quien llegue primero
end;
$$;

grant execute on function tkt_tomar_ticket(uuid) to authenticated;
