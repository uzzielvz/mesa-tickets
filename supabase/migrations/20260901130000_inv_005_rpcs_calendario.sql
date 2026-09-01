-- INV-005 (I3) — Agregados del Calendario de Pagos, servidos por RPC.
--
-- **Todo agregado se sirve por RPC, no por SQL suelto en la página.** No es
-- estilo: un RPC es lo que después se envuelve como tool del chat de Gemini
-- (RESEARCH §14.7, punto 4). SQL escrito dentro de un Server Component hay que
-- reescribirlo el día que llegue I7.
--
-- Los tres siguen la convención de `act_resumen` (ACT-003): `returns json`,
-- `security definer` con la autorización validada a mano, y estructura vacía
-- coherente cuando no hay datos — nunca un error.

-- ── Resolución de la carga vigente ──────────────────────────────────────────
-- Vigente = la carga más reciente **ya procesada** de ese periodo. Sin periodo,
-- la del periodo más reciente que exista.
--
-- Que exija `estado = 'procesado'` importa: una carga recién subida que falló al
-- parsear no puede volverse la vigente y dejar a Tesorería viendo un mes vacío.
create or replace function public.inv_carga_vigente(
  p_tipo    text,
  p_periodo date default null
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id
  from inv_cargas
  where tipo_reporte = p_tipo
    and estado = 'procesado'
    and (p_periodo is null or periodo_inicio = p_periodo)
  order by periodo_inicio desc, created_at desc
  limit 1
$$;

-- No se expone: solo la usan las funciones de abajo, que corren como owner.
revoke execute on function public.inv_carga_vigente(text, date) from public;

-- ── Periodos disponibles ────────────────────────────────────────────────────
create or replace function public.inv_periodos_calendario()
returns json
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(json_agg(x order by x.periodo desc), '[]'::json)
  from (
    select distinct periodo_inicio as periodo
    from inv_cargas
    where tipo_reporte = 'calendario' and estado = 'procesado'
  ) x
$$;

revoke execute on function public.inv_periodos_calendario() from public;

-- ── Resumen del mes ─────────────────────────────────────────────────────────
create or replace function public.inv_resumen_calendario(
  p_periodo date default null
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_carga   uuid;
  v_cabeza  record;
  v_result  json;
begin
  -- security definer bypassa RLS: la autorización se valida a mano.
  if not has_inversiones_pagos() then
    raise exception 'Sin acceso al calendario de pagos' using errcode = '42501';
  end if;

  v_carga := inv_carga_vigente('calendario', p_periodo);

  if v_carga is null then
    return json_build_object(
      'periodo', null,
      'periodos', inv_periodos_calendario(),
      'carga', null,
      'filas', 0, 'total', 0, 'salidas', 0, 'capitalizado', 0, 'revisar', 0,
      'secciones', '[]'::json
    );
  end if;

  select c.id, c.periodo_inicio, c.periodo_fin, c.nombre_archivo,
         c.created_at, c.avisos
    into v_cabeza
  from inv_cargas c where c.id = v_carga;

  select json_build_object(
    'periodo',  v_cabeza.periodo_inicio,
    'periodos', inv_periodos_calendario(),
    'carga', json_build_object(
      'id',             v_cabeza.id,
      'nombre_archivo', v_cabeza.nombre_archivo,
      'periodo_inicio', v_cabeza.periodo_inicio,
      'periodo_fin',    v_cabeza.periodo_fin,
      'created_at',     v_cabeza.created_at,
      'avisos',         to_json(v_cabeza.avisos)
    ),
    'filas',        coalesce(t.filas, 0),
    'total',        coalesce(t.total, 0),
    -- `capitaliza` es la columna generada de INV-004: el rendimiento que se
    -- capitaliza en vez de pagarse. NO es lo mismo que forma_pago = 'AL PLAZO'
    -- — ahí se cuela una devolución de capital que sí sale de caja.
    'capitalizado', coalesce(t.capitalizado, 0),
    'salidas',      coalesce(t.total, 0) - coalesce(t.capitalizado, 0),
    'revisar',      coalesce(t.revisar, 0),
    'secciones',    coalesce(s.secciones, '[]'::json)
  )
  into v_result
  from (
    select
      count(*)                                                  as filas,
      sum(monto)                                                as total,
      sum(monto) filter (where capitaliza)                      as capitalizado,
      count(*)   filter (where seccion = 'REVISAR MEDIO DE PAGO') as revisar
    from inv_pagos where carga_id = v_carga
  ) t
  cross join (
    select json_agg(json_build_object(
             'seccion',    seccion,
             'pagos',      pagos,
             'monto',      monto,
             'capitaliza', capitaliza
           ) order by monto desc) as secciones
    from (
      select seccion, capitaliza, count(*) as pagos, sum(monto) as monto
      from inv_pagos where carga_id = v_carga
      group by seccion, capitaliza
    ) g
  ) s;

  return v_result;
end;
$$;

grant execute on function public.inv_resumen_calendario(date) to authenticated;

-- ── Curva de salidas por día ────────────────────────────────────────────────
create or replace function public.inv_curva_salidas(
  p_periodo date default null
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_carga  uuid;
  v_ini    date;
  v_fin    date;
  v_result json;
begin
  if not has_inversiones_pagos() then
    raise exception 'Sin acceso al calendario de pagos' using errcode = '42501';
  end if;

  v_carga := inv_carga_vigente('calendario', p_periodo);
  if v_carga is null then
    return json_build_object('periodo', null, 'dias', '[]'::json, 'max_salidas', 0);
  end if;

  select periodo_inicio, periodo_fin into v_ini, v_fin
  from inv_cargas where id = v_carga;

  -- Se genera el mes completo, no solo los días con pago: un calendario con
  -- huecos es información (esos días no sale dinero), y una serie que salta del
  -- 3 al 13 se lee como si faltaran datos.
  select json_build_object(
    'periodo',     v_ini,
    'dias',        coalesce(json_agg(json_build_object(
                     'dia',          d.dia,
                     'fecha',        d.fecha,
                     'pagos',        coalesce(p.pagos, 0),
                     'salidas',      coalesce(p.salidas, 0),
                     'capitalizado', coalesce(p.capitalizado, 0)
                   ) order by d.dia), '[]'::json),
    'max_salidas', coalesce(max(coalesce(p.salidas, 0)), 0)
  )
  into v_result
  from (
    select generate_series(v_ini, v_fin, interval '1 day')::date as fecha,
           extract(day from generate_series(v_ini, v_fin, interval '1 day'))::int as dia
  ) d
  left join (
    select dia,
           count(*)                                as pagos,
           sum(monto) filter (where not capitaliza) as salidas,
           sum(monto) filter (where capitaliza)     as capitalizado
    from inv_pagos where carga_id = v_carga
    group by dia
  ) p on p.dia = d.dia;

  return v_result;
end;
$$;

grant execute on function public.inv_curva_salidas(date) to authenticated;

-- ── Los que no tienen medio de pago ─────────────────────────────────────────
-- No es un anexo: es la lista de trabajo de Tesorería. Son pagos programados
-- que nadie puede ejecutar hasta que se defina cómo se pagan.
create or replace function public.inv_revisar_medio(
  p_periodo date default null
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_carga  uuid;
  v_result json;
begin
  if not has_inversiones_pagos() then
    raise exception 'Sin acceso al calendario de pagos' using errcode = '42501';
  end if;

  v_carga := inv_carga_vigente('calendario', p_periodo);
  if v_carga is null then
    return json_build_object('periodo', null, 'pagos', '[]'::json, 'validaciones', '[]'::json);
  end if;

  select json_build_object(
    'periodo', (select periodo_inicio from inv_cargas where id = v_carga),
    'pagos', coalesce((
      select json_agg(json_build_object(
               'clave',             clave,
               'inversionista',     inversionista,
               'fecha_pago',        fecha_pago,
               'dia',               dia,
               'monto',             monto,
               'universo',          universo,
               'gerente_inversion', gerente_inversion
             ) order by fecha_pago, clave)
      from inv_pagos
      where carga_id = v_carga and seccion = 'REVISAR MEDIO DE PAGO'
    ), '[]'::json),
    'validaciones', coalesce((
      select json_agg(json_build_object(
               'clave',         clave,
               'inversionista', inversionista,
               'universo',      universo,
               'observacion',   observacion
             ) order by clave)
      from inv_pagos_validaciones where carga_id = v_carga
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.inv_revisar_medio(date) to authenticated;
