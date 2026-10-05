-- VAC-003 — RPCs del módulo de Vacaciones (fase 1).
--
-- Convención de inv_005 / aho_003: security definer con la autorización
-- validada a mano, returns json, estructura coherente sin datos.

-- ── Días que da la ley por año de servicio ──────────────────────────────────
create or replace function public.vac_dias_por_anio(p_anio int)
returns int
language sql
stable
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select dias from vac_dias_ley where p_anio between desde and hasta),
    -- Más allá de la tabla se queda en el último tramo; nadie en CrediFlexi
    -- se acerca a 35 años de antigüedad.
    (select dias from vac_dias_ley order by desde desc limit 1)
  )
  where p_anio >= 1
$$;

grant execute on function public.vac_dias_por_anio(int) to authenticated;

-- ── Saldos ───────────────────────────────────────────────────────────────────
-- Un periodo por año de servicio cumplido (el "CICLO" del Excel): el periodo N
-- se gana en el N-ésimo aniversario y da vac_dias_por_anio(N) días.
--
-- "Hoy" es la fecha de México, calculada en cada consulta. Es el arreglo
-- principal sobre la base de Excel, cuyo TODAY() se quedó congelado el día que
-- se guardó.
--
-- Forma: [{ id, nombre, puesto, area, numero_empleado, fecha_ingreso, email,
--           jefe_id, jefe_nombre, activo, en_ciclo1, en_ciclo2, anios,
--           dias_trabajados, proximo_aniversario, dias_proximo,
--           periodos[{periodo, desde, hasta, derecho, tomados, restantes}],
--           restantes_total, flotantes_anio }]
create or replace function public.vac_saldos(p_empleado uuid default null)
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

  return coalesce((
    select json_agg(x order by x.nombre)
    from (
      select
        e.id, e.nombre, e.puesto, e.area, e.numero_empleado, e.fecha_ingreso,
        e.email, e.jefe_id, j.nombre as jefe_nombre, e.activo,
        e.en_ciclo1, e.en_ciclo2,
        a.anios,
        (v_hoy - e.fecha_ingreso)                                   as dias_trabajados,
        (e.fecha_ingreso + make_interval(years => a.anios + 1))::date as proximo_aniversario,
        vac_dias_por_anio(a.anios + 1)                              as dias_proximo,
        coalesce(p.periodos, '[]'::json)                            as periodos,
        coalesce(p.restantes_total, 0)                              as restantes_total,
        coalesce((
          select sum(m.dias) from vac_movimientos m
          where m.empleado_id = e.id and m.tipo = 'flotante' and m.anulado_at is null
            and extract(year from coalesce(m.fecha_inicio, m.created_at::date)) = extract(year from v_hoy)
        ), 0)                                                        as flotantes_anio
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

grant execute on function public.vac_saldos(uuid) to authenticated;

-- ── Import de la base de Excel ───────────────────────────────────────────────
-- Atómico: o entra todo el archivo o nada. El parseo lo hace la ruta
-- (lib/vacaciones/base-excel.ts); aquí solo se escribe.
--
-- Volver a importar es seguro: la persona se reconoce por `nombre_clave`, sus
-- movimientos importados anteriores se ANULAN (no se borran) y entran los del
-- archivo nuevo. Lo que RH capturó en la plataforma no se toca: ni sus
-- registros, ni correo, jefe, área o número de empleado.
create or replace function public.vac_importar_base(p_empleados jsonb)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  e        record;
  v_id     uuid;
  v_nuevo  boolean;
  v_nuevos int := 0;
  v_act    int := 0;
  v_movs   int := 0;
  v_n      int;
begin
  if not has_vacaciones_rh() then
    raise exception 'Sin acceso a vacaciones' using errcode = '42501';
  end if;
  if p_empleados is null or jsonb_typeof(p_empleados) <> 'array' or jsonb_array_length(p_empleados) = 0 then
    raise exception 'El archivo no trae empleados';
  end if;

  for e in
    select * from jsonb_to_recordset(p_empleados) as x(
      nombre text, nombre_clave text, puesto text, fecha_ingreso date,
      en_ciclo1 boolean, en_ciclo2 boolean, movimientos jsonb
    )
  loop
    insert into vac_empleados as t (nombre, nombre_clave, puesto, fecha_ingreso, en_ciclo1, en_ciclo2)
    values (e.nombre, e.nombre_clave, e.puesto, e.fecha_ingreso,
            coalesce(e.en_ciclo1, false), coalesce(e.en_ciclo2, false))
    on conflict (nombre_clave) do update set
      nombre        = excluded.nombre,
      puesto        = coalesce(excluded.puesto, t.puesto),
      fecha_ingreso = excluded.fecha_ingreso,
      en_ciclo1     = excluded.en_ciclo1,
      en_ciclo2     = excluded.en_ciclo2
    returning id, (xmax = 0) into v_id, v_nuevo;

    if v_nuevo then v_nuevos := v_nuevos + 1; else v_act := v_act + 1; end if;

    update vac_movimientos
       set anulado_at = now(), anulado_por = auth.uid()
     where empleado_id = v_id and origen = 'importado' and anulado_at is null;

    insert into vac_movimientos (empleado_id, tipo, periodo, dias, fecha_inicio, fechas_texto, origen, registrado_por)
    select v_id, m.tipo, m.periodo, m.dias, m.fecha_inicio, m.fechas_texto, 'importado', auth.uid()
    from jsonb_to_recordset(coalesce(e.movimientos, '[]'::jsonb)) as m(
      tipo text, periodo smallint, dias numeric, fecha_inicio date, fechas_texto text
    );
    get diagnostics v_n = row_count;
    v_movs := v_movs + v_n;
  end loop;

  return json_build_object('nuevos', v_nuevos, 'actualizados', v_act, 'movimientos', v_movs);
end;
$$;

revoke all on function public.vac_importar_base(jsonb) from public, anon;
grant execute on function public.vac_importar_base(jsonb) to authenticated;
