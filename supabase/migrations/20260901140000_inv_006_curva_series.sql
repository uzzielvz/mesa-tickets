-- INV-006 (I3) — `inv_curva_salidas` reescrita sin dos set-returning functions
-- en la misma lista de selección.
--
-- La versión de INV-005 llamaba `generate_series` dos veces en el mismo SELECT
-- (una para la fecha y otra para el día). Postgres ≥10 evalúa varias SRF de la
-- lista en paralelo, así que **funciona**, pero el resultado depende de un
-- detalle de evaluación que no se lee en el código: si alguien cambiara uno de
-- los dos rangos, las dos series se desalinearían en silencio y la curva
-- quedaría corrida de días sin que nada falle.
--
-- Aquí la serie se genera una sola vez en el FROM y el día se deriva de ella.
-- Mismo resultado, sin depender de nada implícito.
--
-- Se hace en una migración nueva y no editando INV-005 porque esa ya está
-- aplicada en remoto: cambiar el archivo dejaría el repo diciendo una cosa y la
-- base teniendo otra.

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

  -- El mes completo, no solo los días con pago: un calendario con huecos es
  -- información (esos días no sale dinero), y una serie que salta del 3 al 13 se
  -- lee como si faltaran datos.
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
    select g::date                        as fecha,
           extract(day from g)::int       as dia
    from generate_series(v_ini, v_fin, interval '1 day') g
  ) d
  left join (
    select dia,
           count(*)                                 as pagos,
           sum(monto) filter (where not capitaliza) as salidas,
           sum(monto) filter (where capitaliza)     as capitalizado
    from inv_pagos where carga_id = v_carga
    group by dia
  ) p on p.dia = d.dia;

  return v_result;
end;
$$;

grant execute on function public.inv_curva_salidas(date) to authenticated;
