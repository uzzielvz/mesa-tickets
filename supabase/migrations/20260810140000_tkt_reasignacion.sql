-- ================================================================
-- TKT-002 — Soltar y reasignar tickets
--
-- El caso real: el responsable se va de vacaciones o el ticket cayó
-- con la persona equivocada. Antes la asignación era de por vida y
-- solo un admin con SQL podía moverla.
--
-- Una sola RPC con dos modos:
--   p_nuevo_responsable = null  → devolver a la cola del área
--   p_nuevo_responsable = uuid  → pasar a alguien del área
-- ================================================================

create or replace function tkt_reasignar_ticket(
  p_ticket_id         uuid,
  p_nuevo_responsable uuid default null
)
returns void
language plpgsql security definer
as $$
declare
  v_area        uuid;
  v_responsable uuid;
  v_estado      ticket_estado;
begin
  if auth.uid() is null then
    raise exception 'no_auth';
  end if;

  select area_id, responsable_id, estado
  into v_area, v_responsable, v_estado
  from tickets
  where id = p_ticket_id;

  if not found then
    raise exception 'no_existe';
  end if;

  if v_estado in ('cerrado', 'rechazado') then
    raise exception 'ticket_terminado';
  end if;

  -- Solo quien lo tiene puede moverlo (o un admin).
  if auth.uid() != coalesce(v_responsable, '00000000-0000-0000-0000-000000000000'::uuid)
     and not is_admin(auth.uid()) then
    raise exception 'sin_acceso';
  end if;

  if p_nuevo_responsable is null then
    -- Devolver a la cola. Si estaba en revisión vuelve a `abierto` (nadie lo
    -- atiende ya); `programado` se conserva — la validación no se pierde por
    -- cambiar de manos.
    update tickets
    set responsable_id = null,
        estado = case when estado = 'en_revision' then 'abierto'::ticket_estado
                      else estado end
    where id = p_ticket_id;
    return;
  end if;

  if p_nuevo_responsable = v_responsable then
    return;  -- idempotente
  end if;

  -- El destino tiene que ser del área que atiende: pasar el ticket a alguien
  -- de otra área lo dejaría en una cola que esa persona no ve.
  if not exists (
    select 1 from profiles
    where id = p_nuevo_responsable
      and area_id = v_area
  ) and not is_admin(p_nuevo_responsable) then
    raise exception 'fuera_del_area';
  end if;

  update tickets
  set responsable_id = p_nuevo_responsable
  where id = p_ticket_id;
end;
$$;

grant execute on function tkt_reasignar_ticket(uuid, uuid) to authenticated;
