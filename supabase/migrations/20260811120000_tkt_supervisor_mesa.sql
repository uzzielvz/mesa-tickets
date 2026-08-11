-- ================================================================
-- TKT-043 — Supervisor de la mesa
--
-- Con la cola por área (TKT-031), cada quien ve la cola de SU área.
-- Falta el rol de supervisión: quien necesita ver todas las colas sin
-- ser administrador del sistema (jefe de mesa, dirección).
--
-- Se implementa como FLAG booleano, no como valor nuevo del enum
-- `rol`. Razones:
--   1. Es el patrón que el repo ya usa para capacidades
--      (acceso_tickets / acceso_score / acceso_cartera /
--      acceso_reclutamiento), con su toggle en /admin/usuarios.
--   2. `rol = 'admin'` ya existe y otorga MÁS (usuarios, catálogo,
--      áreas, cartera). Meter un "superadmin" al enum crearía dos
--      nociones de admin compitiendo, y `is_admin()` se usa en media
--      docena de políticas.
--   3. Un flag es ortogonal: se puede supervisar la mesa sin poder
--      tocar la configuración del sistema. Es lo que se quiere.
-- ================================================================

alter table profiles
  add column if not exists supervisa_tickets boolean not null default false;

comment on column profiles.supervisa_tickets is
  'Ve las colas de TODAS las áreas en la mesa de tickets, sin ser admin del sistema.';

-- `security definer` para que la política no dependa de las RLS de
-- profiles, igual que is_admin() y es_de_area().
create or replace function supervisa_mesa()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and supervisa_tickets = true
  );
$$;

-- ---------------------------------------------------------------
-- RLS: el supervisor lee cualquier ticket, su hilo y sus adjuntos
-- ---------------------------------------------------------------

drop policy if exists "tickets_select" on tickets;

create policy "tickets_select" on tickets
  for select to authenticated
  using (
    auth.uid() = levantado_por_id
    or auth.uid() = responsable_id
    or es_de_area(area_id)
    or supervisa_mesa()
    or is_admin(auth.uid())
  );

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
          or supervisa_mesa()
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
          or supervisa_mesa()
          or is_admin(auth.uid())
        )
    )
  );

drop policy if exists "tkt_historial_select" on ticket_historial;

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
          or supervisa_mesa()
          or is_admin(auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------
-- El supervisor también puede tomar tickets de cualquier cola
-- ---------------------------------------------------------------
-- Antes solo `es_de_area or is_admin`. Sin esto, un supervisor vería
-- una cola atascada sin poder destrabarla.

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

  if not (es_de_area(v_area) or supervisa_mesa() or is_admin(auth.uid())) then
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
