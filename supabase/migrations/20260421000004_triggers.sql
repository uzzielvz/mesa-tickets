-- Trigger: validar paridad de orden en ticket_responses
-- Orden impar → debe ser levantado_por_id del ticket
-- Orden par   → debe ser responsable_id del ticket
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

  -- Asignar automáticamente el orden si no viene
  if new.orden is null then
    new.orden := next_response_order(new.ticket_id);
  end if;

  -- Validar paridad
  if new.orden % 2 = 1 then
    -- Impar: debe ser quien levantó el ticket
    if new.autor_id != v_levantado_por then
      raise exception 'El orden % debe ser respondido por quien levantó el ticket', new.orden;
    end if;
  else
    -- Par: debe ser el responsable
    if new.autor_id != v_responsable then
      raise exception 'El orden % debe ser respondido por el responsable', new.orden;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_validate_response_order
  before insert on ticket_responses
  for each row execute function validate_response_order();

-- Trigger: crear profile automáticamente al registrarse
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into profiles (id, email, nombre_completo, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'usuario'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Trigger: cerrar ticket cuando se confirma terminado_usuario
create or replace function handle_ticket_closure()
returns trigger
language plpgsql security definer
as $$
begin
  if new.tipo = 'terminado_usuario' then
    update tickets
    set closed_at = now()
    where id = new.ticket_id;
  end if;
  return new;
end;
$$;

create trigger trg_ticket_closure
  after insert on ticket_responses
  for each row execute function handle_ticket_closure();
