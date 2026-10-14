-- AUD-006 — Interruptor de los avisos del Auditor (13 de octubre).
--
-- Los avisos de AUD-005 arrancan APAGADOS: el usuario no quiere que salgan
-- correos a promotores y gerentes antes de presentar el Auditor (jueves 15).
-- Mientras estén apagados, ninguna carga avisa a nadie (ni campana ni correo).
-- Quien carga los enciende en /auditor/cargar; al encenderlos se avisa en ese
-- momento con lo que haya pendiente.
--
-- `aud_avisar` (la que llaman las tres cargas) pasa a ser la puerta: revisa el
-- interruptor y llama a `aud_avisar_ahora`, que es la de AUD-005 sin cambios.

create table if not exists aud_ajustes (
  id              boolean primary key default true check (id),
  avisos_activos  boolean not null default false,
  actualizado_por uuid references auth.users(id),
  updated_at      timestamptz not null default now()
);

insert into aud_ajustes (id) values (true) on conflict (id) do nothing;

alter table aud_ajustes enable row level security;
create policy "aud_ajustes_select" on aud_ajustes for select to authenticated using (has_auditor_carga());
-- Sin políticas de escritura: solo por `aud_avisos_encender`.

alter function public.aud_avisar() rename to aud_avisar_ahora;

create or replace function public.aud_avisar()
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not coalesce((select avisos_activos from aud_ajustes where id), false) then
    return json_build_object('avisados', 0, 'motivo', 'apagados');
  end if;
  return aud_avisar_ahora();
end;
$$;

revoke all on function public.aud_avisar()       from public, anon, authenticated;
revoke all on function public.aud_avisar_ahora() from public, anon, authenticated;

-- Encender avisa en ese momento (el acuse vuelve igual que el de una carga);
-- apagar solo apaga.
create or replace function public.aud_avisos_encender(p_activos boolean)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;
  update aud_ajustes
     set avisos_activos = coalesce(p_activos, false), actualizado_por = auth.uid(), updated_at = now()
   where id;
  if coalesce(p_activos, false) then
    return aud_avisar_ahora();
  end if;
  return json_build_object('avisados', 0, 'motivo', 'apagados');
end;
$$;

revoke all on function public.aud_avisos_encender(boolean) from public, anon;
grant execute on function public.aud_avisos_encender(boolean) to authenticated;
