-- VAC-004 — Vacaciones, fase 2: el empleado solicita, el jefe autoriza y RH
-- da el Vo. Bo.
--
-- Es el flujo que pidió Montellano el 21 de septiembre: "te quedan 12 días" →
-- Solicitar → el jefe directo confirma DESDE LA PÁGINA → RH cierra. Las tres
-- firmas del formato GYC quedan registradas como acciones con fecha y usuario.
-- La alarma por correo al jefe que no contesta queda para después: depende de
-- que el envío de correos de la plataforma esté verificado.
--
-- Quién es quién:
--   · El EMPLEADO se reconoce por su correo: el de su cuenta de la plataforma
--     contra `vac_empleados.email` (cargado del archivo "Información para
--     Sistemas"). No necesita bandera.
--   · Su JEFE es `vac_empleados.jefe_id`, congelado en la solicitud al crearla.
--   · RH es quien tiene `acceso_vacaciones_rh`.
--
-- Nada de esto confía en el navegador: días hábiles, saldo, empalmes y quién
-- puede autorizar se calculan y validan aquí.

-- ── Festivos (Art. 74 LFT) ──────────────────────────────────────────────────
-- La misma lista que `lib/vacaciones/calendario.ts`, que la usa solo para la
-- vista previa del formulario. La que cuenta es esta. Si se agrega un año, se
-- agrega en los dos lugares.
create table if not exists vac_festivos (
  fecha  date primary key,
  nombre text not null
);

insert into vac_festivos (fecha, nombre) values
  ('2025-01-01', 'Año Nuevo'), ('2025-02-03', 'Día de la Constitución'),
  ('2025-03-17', 'Natalicio de Benito Juárez'), ('2025-05-01', 'Día del Trabajo'),
  ('2025-09-16', 'Día de la Independencia'), ('2025-11-17', 'Día de la Revolución'),
  ('2025-12-25', 'Navidad'),
  ('2026-01-01', 'Año Nuevo'), ('2026-02-02', 'Día de la Constitución'),
  ('2026-03-16', 'Natalicio de Benito Juárez'), ('2026-05-01', 'Día del Trabajo'),
  ('2026-09-16', 'Día de la Independencia'), ('2026-11-16', 'Día de la Revolución'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'), ('2027-02-01', 'Día de la Constitución'),
  ('2027-03-15', 'Natalicio de Benito Juárez'), ('2027-05-01', 'Día del Trabajo'),
  ('2027-09-16', 'Día de la Independencia'), ('2027-11-15', 'Día de la Revolución'),
  ('2027-12-25', 'Navidad')
on conflict (fecha) do nothing;

alter table vac_festivos enable row level security;
create policy "vac_festivos_select" on vac_festivos for select to authenticated using (true);

create or replace function public.vac_dias_habiles(p_inicio date, p_fin date)
returns int
language sql
stable
set search_path = public, pg_catalog
as $$
  select count(*)::int
  from generate_series(p_inicio, p_fin, interval '1 day') d
  where extract(isodow from d) < 6
    and d::date not in (select fecha from vac_festivos)
$$;

create or replace function public.vac_fecha_regreso(p_fin date)
returns date
language sql
stable
set search_path = public, pg_catalog
as $$
  select min(d)::date
  from generate_series(p_fin + 1, p_fin + 20, interval '1 day') d
  where extract(isodow from d) < 6
    and d::date not in (select fecha from vac_festivos)
$$;

grant execute on function public.vac_dias_habiles(date, date) to authenticated;
grant execute on function public.vac_fecha_regreso(date) to authenticated;

-- ── Solicitudes ──────────────────────────────────────────────────────────────
create table if not exists vac_solicitudes (
  id              uuid primary key default gen_random_uuid(),
  folio           bigint generated always as identity unique,
  empleado_id     uuid not null references vac_empleados(id) on delete cascade,
  tipo            text not null check (tipo in ('vacaciones', 'flotante')),
  fecha_inicio    date not null,
  fecha_fin       date not null,
  dias            numeric(5,1) not null check (dias > 0),
  fecha_regreso   date,
  observaciones   text,
  -- pendiente_jefe → pendiente_rh → aprobada; o rechazada / cancelada en el camino.
  -- Sin jefe asignado (el Director General) nace directo en pendiente_rh.
  estado          text not null default 'pendiente_jefe'
                  check (estado in ('pendiente_jefe', 'pendiente_rh', 'aprobada', 'rechazada', 'cancelada')),
  jefe_id         uuid references vac_empleados(id) on delete set null,
  solicitada_por  uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  -- Las tres "firmas": quién y cuándo. Es el acuse de la firma electrónica simple.
  jefe_at         timestamptz,
  jefe_por        uuid references auth.users(id),
  jefe_comentario text,
  rh_at           timestamptz,
  rh_por          uuid references auth.users(id),
  rh_comentario   text,
  cancelada_at    timestamptz,
  check (fecha_fin >= fecha_inicio)
);

create index if not exists idx_vac_sol_empleado on vac_solicitudes(empleado_id, created_at desc);
create index if not exists idx_vac_sol_jefe     on vac_solicitudes(jefe_id, estado);
create index if not exists idx_vac_sol_estado   on vac_solicitudes(estado);

alter table vac_solicitudes enable row level security;
-- RH lee todo directo; empleados y jefes leen lo suyo por los RPCs de abajo.
create policy "vac_solicitudes_select" on vac_solicitudes
  for select to authenticated using (has_vacaciones_rh());

-- Un movimiento puede nacer de una solicitud aprobada.
alter table vac_movimientos drop constraint if exists vac_movimientos_origen_check;
alter table vac_movimientos
  add constraint vac_movimientos_origen_check check (origen in ('importado', 'registro_rh', 'solicitud'));
alter table vac_movimientos
  add column if not exists solicitud_id uuid references vac_solicitudes(id);

-- ── ¿Quién soy? ──────────────────────────────────────────────────────────────
create or replace function public.vac_mi_empleado()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select e.id
  from vac_empleados e
  join profiles p on lower(p.email) = lower(e.email)
  where p.id = auth.uid() and e.activo
  limit 1
$$;

revoke all on function public.vac_mi_empleado() from public, anon;
grant execute on function public.vac_mi_empleado() to authenticated;

-- Lo que necesitan el menú y el layout en cada página: si soy empleado, si soy
-- jefe de alguien y cuántas solicitudes me esperan.
create or replace function public.vac_mi_contexto()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := vac_mi_empleado();
begin
  if v_yo is null then
    return json_build_object('empleado_id', null, 'es_jefe', false, 'pendientes_jefe', 0);
  end if;
  return json_build_object(
    'empleado_id',     v_yo,
    'es_jefe',         exists (select 1 from vac_empleados where jefe_id = v_yo and activo),
    'pendientes_jefe', (select count(*) from vac_solicitudes where jefe_id = v_yo and estado = 'pendiente_jefe')
  );
end;
$$;

grant execute on function public.vac_mi_contexto() to authenticated;

-- ── Saldos: el cálculo se separa de la autorización ─────────────────────────
-- `vac_saldos` (RH) y los RPCs del empleado y del jefe usan el mismo cálculo.
-- La versión interna no revisa permisos y nadie puede llamarla directo.
create or replace function public.vac_saldos_interno(p_empleado uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  return coalesce((
    select json_agg(x order by x.nombre)
    from (
      select
        e.id, e.nombre, e.puesto, e.area, e.numero_empleado, e.fecha_ingreso,
        e.email, e.jefe_id, j.nombre as jefe_nombre, e.activo,
        e.en_ciclo1, e.en_ciclo2,
        a.anios,
        (v_hoy - e.fecha_ingreso)                                     as dias_trabajados,
        (e.fecha_ingreso + make_interval(years => a.anios + 1))::date as proximo_aniversario,
        vac_dias_por_anio(a.anios + 1)                                as dias_proximo,
        coalesce(p.periodos, '[]'::json)                              as periodos,
        coalesce(p.restantes_total, 0)                                as restantes_total,
        coalesce((
          select sum(m.dias) from vac_movimientos m
          where m.empleado_id = e.id and m.tipo = 'flotante' and m.anulado_at is null
            and extract(year from coalesce(m.fecha_inicio, m.created_at::date)) = extract(year from v_hoy)
        ), 0)                                                          as flotantes_anio,
        coalesce((
          select sum(s.dias) from vac_solicitudes s
          where s.empleado_id = e.id and s.tipo = 'vacaciones'
            and s.estado in ('pendiente_jefe', 'pendiente_rh')
        ), 0)                                                          as dias_en_tramite
      from vac_empleados e
      left join vac_empleados j on j.id = e.jefe_id
      cross join lateral (
        select greatest(extract(year from age(v_hoy, e.fecha_ingreso))::int, 0) as anios
      ) a
      left join lateral (
        select
          json_agg(json_build_object(
            'periodo',   n,
            'desde',     (e.fecha_ingreso + make_interval(years => n - 1))::date,
            'hasta',     (e.fecha_ingreso + make_interval(years => n))::date,
            'derecho',   vac_dias_por_anio(n),
            'tomados',   coalesce(t.tomados, 0),
            'restantes', vac_dias_por_anio(n) - coalesce(t.tomados, 0)
          ) order by n) as periodos,
          sum(vac_dias_por_anio(n) - coalesce(t.tomados, 0)) as restantes_total
        from generate_series(1, a.anios) n
        left join lateral (
          select sum(m.dias) as tomados from vac_movimientos m
          where m.empleado_id = e.id and m.tipo = 'vacaciones'
            and m.periodo = n and m.anulado_at is null
        ) t on true
      ) p on true
      where p_empleado is null or e.id = p_empleado
    ) x
  ), '[]'::json);
end;
$$;

revoke all on function public.vac_saldos_interno(uuid) from public, anon, authenticated;

create or replace function public.vac_saldos(p_empleado uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  return vac_saldos_interno(p_empleado);
end;
$$;

-- Reparte días entre periodos: primero el más viejo con saldo, como hace la
-- base de Excel. Si no alcanza, el excedente va al último periodo (queda en
-- negativo y RH lo ve).
create or replace function public.vac_asignar_periodos(p_empleado uuid, p_dias numeric)
returns table(periodo int, dias numeric)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy     date := (now() at time zone 'America/Mexico_City')::date;
  v_ingreso date;
  v_anios   int;
  v_resta   numeric := p_dias;
  v_rest    numeric;
  v_toma    numeric;
begin
  select fecha_ingreso into v_ingreso from vac_empleados where id = p_empleado;
  v_anios := greatest(extract(year from age(v_hoy, v_ingreso))::int, 0);
  if v_anios = 0 then
    raise exception 'Todavía no cumple un año de servicio: no tiene días de vacaciones';
  end if;

  for n in 1..v_anios loop
    exit when v_resta <= 0;
    select vac_dias_por_anio(n) - coalesce(sum(m.dias), 0) into v_rest
    from vac_movimientos m
    where m.empleado_id = p_empleado and m.tipo = 'vacaciones'
      and m.periodo = n and m.anulado_at is null;
    if v_rest > 0 then
      v_toma := least(v_rest, v_resta);
      periodo := n; dias := v_toma;
      return next;
      v_resta := v_resta - v_toma;
    end if;
  end loop;

  if v_resta > 0 then
    periodo := v_anios; dias := v_resta;
    return next;
  end if;
end;
$$;

revoke all on function public.vac_asignar_periodos(uuid, numeric) from public, anon, authenticated;

-- ── El empleado ──────────────────────────────────────────────────────────────
create or replace function public.vac_mis_vacaciones()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := vac_mi_empleado();
begin
  if v_yo is null then
    return json_build_object('empleado', null);
  end if;

  return json_build_object(
    'empleado', (vac_saldos_interno(v_yo) -> 0),
    'solicitudes', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'folio', s.folio, 'tipo', s.tipo,
        'fecha_inicio', s.fecha_inicio, 'fecha_fin', s.fecha_fin, 'dias', s.dias,
        'fecha_regreso', s.fecha_regreso, 'observaciones', s.observaciones,
        'estado', s.estado, 'created_at', s.created_at,
        'jefe_nombre', j.nombre, 'jefe_at', s.jefe_at, 'jefe_comentario', s.jefe_comentario,
        'rh_at', s.rh_at, 'rh_comentario', s.rh_comentario
      ) order by s.created_at desc)
      from vac_solicitudes s
      left join vac_empleados j on j.id = s.jefe_id
      where s.empleado_id = v_yo
    ), '[]'::json),
    'movimientos', coalesce((
      select json_agg(json_build_object(
        'tipo', m.tipo, 'periodo', m.periodo, 'dias', m.dias,
        'fecha_inicio', m.fecha_inicio, 'fecha_fin', m.fecha_fin,
        'fechas_texto', m.fechas_texto, 'origen', m.origen, 'created_at', m.created_at
      ) order by coalesce(m.fecha_inicio, m.created_at::date) desc)
      from vac_movimientos m
      where m.empleado_id = v_yo and m.anulado_at is null
    ), '[]'::json)
  );
end;
$$;

grant execute on function public.vac_mis_vacaciones() to authenticated;

create or replace function public.vac_solicitar(
  p_tipo          text,
  p_inicio        date,
  p_fin           date,
  p_observaciones text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy       date := (now() at time zone 'America/Mexico_City')::date;
  v_yo        uuid := vac_mi_empleado();
  v_jefe      uuid;
  v_dias      int;
  v_saldo     json;
  v_disp      numeric;
  v_id        uuid;
  v_folio     bigint;
begin
  if v_yo is null then
    raise exception 'Tu correo no está en la base de vacaciones. Pídele a Gente y Cultura que te registre.';
  end if;
  if p_tipo not in ('vacaciones', 'flotante') then
    raise exception 'Tipo de solicitud inválido';
  end if;
  if p_inicio is null or p_fin is null or p_fin < p_inicio then
    raise exception 'Revisa las fechas: el último día no puede ser antes del primero';
  end if;
  if p_inicio < v_hoy then
    raise exception 'Las vacaciones se solicitan con anticipación: la fecha de inicio ya pasó';
  end if;
  if p_fin > p_inicio + 60 then
    raise exception 'El periodo es demasiado largo para una sola solicitud';
  end if;

  v_dias := vac_dias_habiles(p_inicio, p_fin);
  if v_dias <= 0 then
    raise exception 'Esas fechas no tienen días hábiles (son fin de semana o festivos)';
  end if;

  if p_tipo = 'vacaciones' then
    v_saldo := vac_saldos_interno(v_yo) -> 0;
    if (v_saldo ->> 'anios')::int < 1 then
      raise exception 'Todavía no cumples un año de servicio. Tus primeros días llegan el %', v_saldo ->> 'proximo_aniversario';
    end if;
    v_disp := (v_saldo ->> 'restantes_total')::numeric - (v_saldo ->> 'dias_en_tramite')::numeric;
    if v_dias > v_disp then
      raise exception 'Pides % días hábiles y tienes % disponibles', v_dias, trim_scale(greatest(v_disp, 0));
    end if;
  end if;

  if exists (
    select 1 from vac_solicitudes s
    where s.empleado_id = v_yo and s.estado in ('pendiente_jefe', 'pendiente_rh', 'aprobada')
      and daterange(s.fecha_inicio, s.fecha_fin, '[]') && daterange(p_inicio, p_fin, '[]')
  ) or exists (
    select 1 from vac_movimientos m
    where m.empleado_id = v_yo and m.anulado_at is null
      and m.fecha_inicio is not null
      and daterange(m.fecha_inicio, coalesce(m.fecha_fin, m.fecha_inicio), '[]') && daterange(p_inicio, p_fin, '[]')
  ) then
    raise exception 'Ya tienes días solicitados o registrados en esas fechas';
  end if;

  select jefe_id into v_jefe from vac_empleados where id = v_yo;

  insert into vac_solicitudes (
    empleado_id, tipo, fecha_inicio, fecha_fin, dias, fecha_regreso, observaciones,
    estado, jefe_id, solicitada_por
  ) values (
    v_yo, p_tipo, p_inicio, p_fin, v_dias, vac_fecha_regreso(p_fin),
    nullif(trim(coalesce(p_observaciones, '')), ''),
    case when v_jefe is null then 'pendiente_rh' else 'pendiente_jefe' end,
    v_jefe, auth.uid()
  )
  returning id, folio into v_id, v_folio;

  return json_build_object('id', v_id, 'folio', v_folio, 'dias', v_dias,
                           'estado', case when v_jefe is null then 'pendiente_rh' else 'pendiente_jefe' end);
end;
$$;

revoke all on function public.vac_solicitar(text, date, date, text) from public, anon;
grant execute on function public.vac_solicitar(text, date, date, text) to authenticated;

create or replace function public.vac_cancelar_solicitud(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := vac_mi_empleado();
begin
  update vac_solicitudes
     set estado = 'cancelada', cancelada_at = now()
   where id = p_id and empleado_id = v_yo
     and estado in ('pendiente_jefe', 'pendiente_rh');
  if not found then
    raise exception 'Esa solicitud ya no se puede cancelar';
  end if;
end;
$$;

revoke all on function public.vac_cancelar_solicitud(uuid) from public, anon;
grant execute on function public.vac_cancelar_solicitud(uuid) to authenticated;

-- ── El jefe ──────────────────────────────────────────────────────────────────
create or replace function public.vac_bandeja_jefe()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := vac_mi_empleado();
begin
  if v_yo is null then
    return json_build_object('es_jefe', false, 'pendientes', '[]'::json, 'resueltas', '[]'::json, 'equipo', '[]'::json);
  end if;

  return json_build_object(
    'es_jefe', exists (select 1 from vac_empleados where jefe_id = v_yo and activo),
    'pendientes', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'folio', s.folio, 'tipo', s.tipo, 'empleado', e.nombre, 'puesto', e.puesto,
        'fecha_inicio', s.fecha_inicio, 'fecha_fin', s.fecha_fin, 'dias', s.dias,
        'fecha_regreso', s.fecha_regreso, 'observaciones', s.observaciones, 'created_at', s.created_at,
        'disponibles', ((vac_saldos_interno(e.id) -> 0) ->> 'restantes_total')::numeric
      ) order by s.fecha_inicio)
      from vac_solicitudes s join vac_empleados e on e.id = s.empleado_id
      where s.jefe_id = v_yo and s.estado = 'pendiente_jefe'
    ), '[]'::json),
    'resueltas', coalesce((
      select json_agg(r order by r.jefe_at desc)
      from (
        select s.id, s.folio, s.tipo, e.nombre as empleado, s.fecha_inicio, s.fecha_fin, s.dias,
               s.estado, s.jefe_at, s.jefe_comentario
        from vac_solicitudes s join vac_empleados e on e.id = s.empleado_id
        where s.jefe_id = v_yo and s.jefe_at is not null
        order by s.jefe_at desc
        limit 15
      ) r
    ), '[]'::json),
    'equipo', coalesce((
      select json_agg(json_build_object(
        'id', x ->> 'id', 'nombre', x ->> 'nombre', 'puesto', x ->> 'puesto',
        'anios', (x ->> 'anios')::int, 'restantes', (x ->> 'restantes_total')::numeric,
        'proximo_aniversario', x ->> 'proximo_aniversario'
      ) order by x ->> 'nombre')
      from vac_empleados e
      cross join lateral json_array_elements(vac_saldos_interno(e.id)) x
      where e.jefe_id = v_yo and e.activo
    ), '[]'::json)
  );
end;
$$;

grant execute on function public.vac_bandeja_jefe() to authenticated;

create or replace function public.vac_resolver_jefe(p_id uuid, p_autoriza boolean, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_yo uuid := vac_mi_empleado();
begin
  if v_yo is null then
    raise exception 'No estás en la base de vacaciones' using errcode = '42501';
  end if;
  if not p_autoriza and nullif(trim(coalesce(p_comentario, '')), '') is null then
    raise exception 'Escribe el motivo del rechazo: la persona lo va a leer';
  end if;

  update vac_solicitudes
     set estado = case when p_autoriza then 'pendiente_rh' else 'rechazada' end,
         jefe_at = now(), jefe_por = auth.uid(),
         jefe_comentario = nullif(trim(coalesce(p_comentario, '')), '')
   where id = p_id and jefe_id = v_yo and estado = 'pendiente_jefe';
  if not found then
    raise exception 'Esa solicitud no te toca o ya se resolvió';
  end if;
end;
$$;

revoke all on function public.vac_resolver_jefe(uuid, boolean, text) from public, anon;
grant execute on function public.vac_resolver_jefe(uuid, boolean, text) to authenticated;

-- ── RH ───────────────────────────────────────────────────────────────────────
create or replace function public.vac_bandeja_rh()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;

  return json_build_object(
    'por_vobo', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'folio', s.folio, 'tipo', s.tipo, 'empleado_id', e.id, 'empleado', e.nombre,
        'fecha_inicio', s.fecha_inicio, 'fecha_fin', s.fecha_fin, 'dias', s.dias,
        'jefe', j.nombre, 'jefe_at', s.jefe_at, 'jefe_comentario', s.jefe_comentario,
        'observaciones', s.observaciones,
        'disponibles', ((vac_saldos_interno(e.id) -> 0) ->> 'restantes_total')::numeric
      ) order by s.fecha_inicio)
      from vac_solicitudes s
      join vac_empleados e on e.id = s.empleado_id
      left join vac_empleados j on j.id = s.jefe_id
      where s.estado = 'pendiente_rh'
    ), '[]'::json),
    -- Las que esperan al jefe: lo que hoy RH persigue a mano y después hará la alarma.
    'esperando_jefe', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'folio', s.folio, 'empleado', e.nombre, 'jefe', j.nombre,
        'fecha_inicio', s.fecha_inicio, 'dias', s.dias,
        'dias_esperando', v_hoy - (s.created_at at time zone 'America/Mexico_City')::date,
        'dias_para_inicio', s.fecha_inicio - v_hoy
      ) order by s.fecha_inicio)
      from vac_solicitudes s
      join vac_empleados e on e.id = s.empleado_id
      left join vac_empleados j on j.id = s.jefe_id
      where s.estado = 'pendiente_jefe'
    ), '[]'::json)
  );
end;
$$;

grant execute on function public.vac_bandeja_rh() to authenticated;

create or replace function public.vac_resolver_rh(p_id uuid, p_aprueba boolean, p_comentario text default null)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s   vac_solicitudes%rowtype;
  a   record;
  v_n int := 0;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;

  select * into s from vac_solicitudes where id = p_id for update;
  if not found or s.estado <> 'pendiente_rh' then
    raise exception 'Esa solicitud no está esperando el Vo. Bo. de RH';
  end if;

  if not p_aprueba then
    if nullif(trim(coalesce(p_comentario, '')), '') is null then
      raise exception 'Escribe el motivo del rechazo: la persona lo va a leer';
    end if;
    update vac_solicitudes
       set estado = 'rechazada', rh_at = now(), rh_por = auth.uid(), rh_comentario = trim(p_comentario)
     where id = p_id;
    return json_build_object('estado', 'rechazada', 'movimientos', 0);
  end if;

  -- Aprobada: los días entran al saldo como movimientos ligados a la solicitud.
  if s.tipo = 'vacaciones' then
    for a in select * from vac_asignar_periodos(s.empleado_id, s.dias) loop
      insert into vac_movimientos (empleado_id, tipo, periodo, dias, fecha_inicio, fecha_fin, fecha_regreso,
                                   observaciones, origen, registrado_por, solicitud_id)
      values (s.empleado_id, 'vacaciones', a.periodo, a.dias, s.fecha_inicio, s.fecha_fin, s.fecha_regreso,
              s.observaciones, 'solicitud', auth.uid(), s.id);
      v_n := v_n + 1;
    end loop;
  else
    insert into vac_movimientos (empleado_id, tipo, periodo, dias, fecha_inicio, fecha_fin, fecha_regreso,
                                 observaciones, origen, registrado_por, solicitud_id)
    values (s.empleado_id, 'flotante', null, s.dias, s.fecha_inicio, s.fecha_fin, s.fecha_regreso,
            s.observaciones, 'solicitud', auth.uid(), s.id);
    v_n := 1;
  end if;

  update vac_solicitudes
     set estado = 'aprobada', rh_at = now(), rh_por = auth.uid(),
         rh_comentario = nullif(trim(coalesce(p_comentario, '')), '')
   where id = p_id;

  return json_build_object('estado', 'aprobada', 'movimientos', v_n);
end;
$$;

revoke all on function public.vac_resolver_rh(uuid, boolean, text) from public, anon;
grant execute on function public.vac_resolver_rh(uuid, boolean, text) to authenticated;
