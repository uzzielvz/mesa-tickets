-- VAC-010 — Reglas de Gente y Cultura: vencimiento de vacaciones y tope de
-- días flotantes (21 de octubre).
--
-- La base no sabía dos cosas que solo decide la política de la empresa:
--   · Si las vacaciones vencen. Hasta hoy los saldos se acumulaban sin fin
--     (de ahí los 450 días pendientes y los 26 del Director General).
--   · Cuántos días flotantes hay por año. Se contaban, pero sin tope.
--
-- Las dos quedan como AJUSTES que Gente y Cultura llena en /vacaciones, no
-- como números escritos en el código. Vacíos = como hasta hoy: nada vence y
-- los flotantes no tienen tope. Esta migración no cambia ningún saldo hasta
-- que alguien los llena.
--
-- Cómo vence un periodo. El año de servicio N se gana en el aniversario N
-- (el `hasta` del periodo) y vence `meses_vigencia` meses después. Lo que no
-- se tomó para entonces deja de contar como disponible: se reporta como
-- "vencido", no se borra nada.
--
-- Transición (`vigencia_desde`). Si la regla se aplicara hacia atrás, mucha
-- gente perdería días de golpe el día que se enciende. Con `vigencia_desde`,
-- ningún periodo vence antes de `vigencia_desde + meses_vigencia`: lo
-- acumulado tiene el mismo plazo, contado desde que arranca la regla.
-- Vacío = sin transición (cada periodo vence a sus meses del aniversario).

create table if not exists vac_ajustes (
  id                 boolean primary key default true check (id),
  -- Null = las vacaciones no vencen.
  meses_vigencia     smallint check (meses_vigencia between 1 and 60),
  vigencia_desde     date,
  -- Null = sin tope. Por año calendario.
  flotantes_por_anio smallint check (flotantes_por_anio between 0 and 30),
  actualizado_por    uuid references auth.users(id),
  updated_at         timestamptz not null default now()
);

insert into vac_ajustes (id) values (true) on conflict (id) do nothing;

alter table vac_ajustes enable row level security;
drop policy if exists "vac_ajustes_select" on vac_ajustes;
create policy "vac_ajustes_select" on vac_ajustes for select to authenticated using (true);
-- Sin políticas de escritura: solo por `vac_guardar_reglas`.

comment on table vac_ajustes is
  'VAC-010: reglas de Gente y Cultura. Una sola fila. Vacíos = nada vence y los flotantes no tienen tope.';

create or replace function public.vac_guardar_reglas(
  p_meses_vigencia     int,
  p_vigencia_desde     date,
  p_flotantes_por_anio int
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  if p_meses_vigencia is not null and p_meses_vigencia not between 1 and 60 then
    raise exception 'La vigencia va de 1 a 60 meses (vacío si no vencen)';
  end if;
  if p_flotantes_por_anio is not null and p_flotantes_por_anio not between 0 and 30 then
    raise exception 'Los días flotantes van de 0 a 30 por año (vacío si no hay tope)';
  end if;

  update vac_ajustes
     set meses_vigencia     = p_meses_vigencia,
         vigencia_desde     = case when p_meses_vigencia is null then null else p_vigencia_desde end,
         flotantes_por_anio = p_flotantes_por_anio,
         actualizado_por    = auth.uid(),
         updated_at         = now()
   where id;
end;
$$;

revoke all on function public.vac_guardar_reglas(int, date, int) from public, anon;
grant execute on function public.vac_guardar_reglas(int, date, int) to authenticated;

-- Último día para tomar los días del año de servicio N. Null = no vence.
create or replace function public.vac_vence(p_ingreso date, p_periodo int)
returns date
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select (greatest((p_ingreso + make_interval(years => p_periodo))::date,
                   coalesce(a.vigencia_desde, '-infinity'::date))
          + make_interval(months => a.meses_vigencia))::date
  from vac_ajustes a
  where a.id and a.meses_vigencia is not null
$$;

revoke all on function public.vac_vence(date, int) from public, anon, authenticated;

-- ── Saldos: igual que en vac_004, más el vencimiento y el tope de flotantes ──
-- Cada periodo trae `vence` (null si no vence), `vencido` y `vencidos` (los
-- días que se perdieron). `restantes` ya no cuenta lo vencido, así que
-- `restantes_total`, y con él las solicitudes, la bandeja del jefe y los
-- reportes, dejan de ofrecer días que ya no existen. Un periodo sobregirado
-- conserva su negativo aunque venza: RH lo sigue viendo.
create or replace function public.vac_saldos_interno(p_empleado uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoy      date := (now() at time zone 'America/Mexico_City')::date;
  v_flot_max smallint;
begin
  select flotantes_por_anio into v_flot_max from vac_ajustes where id;

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
        coalesce(p.vencidos_total, 0)                                 as dias_vencidos,
        p.proximo_vencimiento,
        coalesce(p.dias_por_vencer, 0)                                as dias_por_vencer,
        coalesce((
          select sum(m.dias) from vac_movimientos m
          where m.empleado_id = e.id and m.tipo = 'flotante' and m.anulado_at is null
            and extract(year from coalesce(m.fecha_inicio, m.created_at::date)) = extract(year from v_hoy)
        ), 0)                                                          as flotantes_anio,
        coalesce((
          select sum(s.dias) from vac_solicitudes s
          where s.empleado_id = e.id and s.tipo = 'flotante'
            and s.estado in ('pendiente_jefe', 'pendiente_rh')
            and extract(year from s.fecha_inicio) = extract(year from v_hoy)
        ), 0)                                                          as flotantes_en_tramite,
        v_flot_max                                                     as flotantes_limite,
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
            'periodo',   r.n,
            'desde',     (e.fecha_ingreso + make_interval(years => r.n - 1))::date,
            'hasta',     (e.fecha_ingreso + make_interval(years => r.n))::date,
            'derecho',   r.derecho,
            'tomados',   r.tomados,
            'restantes', r.restantes,
            'vence',     r.vence,
            'vencido',   r.vencido,
            'vencidos',  r.vencidos
          ) order by r.n)                                         as periodos,
          sum(r.restantes)                                        as restantes_total,
          sum(r.vencidos)                                         as vencidos_total,
          min(r.vence) filter (where not r.vencido and r.restantes > 0) as proximo_vencimiento,
          sum(r.restantes) filter (where r.vence = r.proximo)     as dias_por_vencer
        from (
          select c.*, min(c.vence) filter (where not c.vencido and c.restantes > 0) over () as proximo
          from (
          select
            b.n, b.derecho, b.tomados, b.vence,
            coalesce(b.vence < v_hoy, false)                                           as vencido,
            case when b.vence < v_hoy then least(b.bruto, 0) else b.bruto end          as restantes,
            case when b.vence < v_hoy then greatest(b.bruto, 0) else 0 end             as vencidos
          from (
            select
              n,
              vac_dias_por_anio(n)                                as derecho,
              coalesce(t.tomados, 0)                              as tomados,
              vac_dias_por_anio(n) - coalesce(t.tomados, 0)       as bruto,
              vac_vence(e.fecha_ingreso, n)                       as vence
            from generate_series(1, a.anios) n
            left join lateral (
              select sum(m.dias) as tomados from vac_movimientos m
              where m.empleado_id = e.id and m.tipo = 'vacaciones'
                and m.periodo = n and m.anulado_at is null
            ) t on true
          ) b
          ) c
        ) r
      ) p on true
      where p_empleado is null or e.id = p_empleado
    ) x
  ), '[]'::json);
end;
$$;

revoke all on function public.vac_saldos_interno(uuid) from public, anon, authenticated;

-- ── Reparto de días: igual que en vac_004, pero salta los periodos vencidos ──
-- Primero el más viejo que siga vigente y con saldo. Si no alcanza, el
-- excedente va al último periodo (queda en negativo y RH lo ve).
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
    continue when vac_vence(v_ingreso, n) < v_hoy;
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

-- ── vac_solicitar: igual que en vac_007, más el tope de flotantes ────────────
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
  v_limite    smallint;
  v_usados    numeric;
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

  -- VAC-010: tope de días flotantes por año calendario, si Gente y Cultura lo
  -- fijó. Cuentan los ya tomados y los que están en trámite en el año en que
  -- empieza la solicitud.
  if p_tipo = 'flotante' then
    select flotantes_por_anio into v_limite from vac_ajustes where id;
    if v_limite is not null then
      v_usados := coalesce((
        select sum(m.dias) from vac_movimientos m
        where m.empleado_id = v_yo and m.tipo = 'flotante' and m.anulado_at is null
          and extract(year from coalesce(m.fecha_inicio, m.created_at::date)) = extract(year from p_inicio)
      ), 0) + coalesce((
        select sum(s.dias) from vac_solicitudes s
        where s.empleado_id = v_yo and s.tipo = 'flotante'
          and s.estado in ('pendiente_jefe', 'pendiente_rh')
          and extract(year from s.fecha_inicio) = extract(year from p_inicio)
      ), 0);
      if v_usados + v_dias > v_limite then
        raise exception 'Pides % y te quedan % de % en %',
          vac_dias_texto('flotante', v_dias), trim_scale(greatest(v_limite - v_usados, 0)),
          v_limite, extract(year from p_inicio);
      end if;
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

  perform vac_avisar(v_id, 'solicitada');

  return json_build_object('id', v_id, 'folio', v_folio, 'dias', v_dias,
                           'estado', case when v_jefe is null then 'pendiente_rh' else 'pendiente_jefe' end);
end;
$$;



