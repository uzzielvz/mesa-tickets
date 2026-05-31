-- CART-010: RPC cartera_resumen(p_fecha_corte date) → json
-- Devuelve totales + distribución PAR + indicadores ejecutivos para el dashboard.
-- Buckets PAR definidos en services/cartera_etl.py::asignar_par (microservicio crediflexi-services).
-- Métrica monetaria: saldo_riesgo_total (consistente con pivots X_Coordinación/X_Recuperador del legacy).

create or replace function public.cartera_resumen(p_fecha_corte date)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller_role  text;
  v_caller_acceso boolean;
  v_total_cartera numeric;
  v_resultado json;
begin
  -- Autorización: admin o usuario con acceso_cartera explícito.
  -- (security definer bypassa RLS, así que validamos manualmente.)
  select rol, acceso_cartera into v_caller_role, v_caller_acceso
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if v_caller_role <> 'admin' and coalesce(v_caller_acceso, false) = false then
    raise exception 'Sin acceso a cartera' using errcode = '42501';
  end if;

  -- Denominador para porcentajes (evita división por cero abajo).
  select coalesce(sum(saldo_riesgo_total), 0) into v_total_cartera
  from public.stg_yunius_cartera_individual
  where fecha_corte = p_fecha_corte;

  -- Si no hay datos para esa fecha, devolvemos estructura vacía coherente.
  if v_total_cartera = 0 and not exists (
       select 1 from public.stg_yunius_cartera_individual where fecha_corte = p_fecha_corte
     ) then
    return json_build_object(
      'fecha_corte', p_fecha_corte,
      'totales', json_build_object(
        'creditos', 0,
        'cartera_total', 0,
        'creditos_en_mora', 0,
        'cartera_en_mora', 0,
        'pct_mora', 0
      ),
      'par', '[]'::json,
      'indicadores', json_build_object('pct_par_30', 0, 'pct_par_90', 0)
    );
  end if;

  with base as (
    select
      coalesce(dias_mora, 0)         as dias_mora,
      coalesce(saldo_riesgo_total, 0) as saldo
    from public.stg_yunius_cartera_individual
    where fecha_corte = p_fecha_corte
  ),
  -- Recalculamos el bucket aquí (no leemos par_bucket de la tabla) para
  -- garantizar consistencia aun si hay filas viejas con par_bucket NULL.
  clasificado as (
    select
      dias_mora,
      saldo,
      case
        when dias_mora < 1   then '0'
        when dias_mora <= 7  then '7'
        when dias_mora <= 15 then '15'
        when dias_mora <= 30 then '30'
        when dias_mora <= 60 then '60'
        when dias_mora <= 90 then '90'
        when dias_mora <= 180 then 'Mayor_90'
        else 'Mayor_180'
      end as bucket
    from base
  ),
  bucket_def(bucket, label, dias_min, dias_max, orden) as (
    values
      ('0',         'Corriente', 0,    0,    1),
      ('7',         '1-7',       1,    7,    2),
      ('15',        '8-15',      8,    15,   3),
      ('30',        '16-30',     16,   30,   4),
      ('60',        '31-60',     31,   60,   5),
      ('90',        '61-90',     61,   90,   6),
      ('Mayor_90',  '91-180',    91,   180,  7),
      ('Mayor_180', '181+',      181,  null, 8)
  ),
  par_agg as (
    select
      d.bucket,
      d.label,
      d.dias_min,
      d.dias_max,
      d.orden,
      coalesce(count(c.bucket), 0)::int as creditos,
      coalesce(sum(c.saldo), 0)::numeric as saldo,
      case
        when v_total_cartera > 0 then round((coalesce(sum(c.saldo), 0) / v_total_cartera * 100)::numeric, 2)
        else 0
      end as pct_saldo
    from bucket_def d
    left join clasificado c on c.bucket = d.bucket
    group by d.bucket, d.label, d.dias_min, d.dias_max, d.orden
  )
  select json_build_object(
    'fecha_corte', p_fecha_corte,
    'totales', json_build_object(
      'creditos',         (select count(*)::int from base),
      'cartera_total',    v_total_cartera,
      'creditos_en_mora', (select count(*)::int from base where dias_mora > 0),
      'cartera_en_mora',  (select coalesce(sum(saldo), 0) from base where dias_mora > 0),
      'pct_mora', case
        when v_total_cartera > 0 then
          round(((select coalesce(sum(saldo), 0) from base where dias_mora > 0) / v_total_cartera * 100)::numeric, 2)
        else 0
      end
    ),
    'par', (
      select json_agg(
        json_build_object(
          'bucket',    bucket,
          'label',     label,
          'dias_min',  dias_min,
          'dias_max',  dias_max,
          'creditos',  creditos,
          'saldo',     saldo,
          'pct_saldo', pct_saldo
        )
        order by orden
      )
      from par_agg
    ),
    'indicadores', json_build_object(
      'pct_par_30', case
        when v_total_cartera > 0 then
          round(((select coalesce(sum(saldo), 0) from clasificado where dias_mora >= 31) / v_total_cartera * 100)::numeric, 2)
        else 0
      end,
      'pct_par_90', case
        when v_total_cartera > 0 then
          round(((select coalesce(sum(saldo), 0) from clasificado where dias_mora >= 91) / v_total_cartera * 100)::numeric, 2)
        else 0
      end
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

-- Lockdown: anon nunca; authenticated puede llamar (la función valida internamente).
revoke all on function public.cartera_resumen(date) from public;
revoke all on function public.cartera_resumen(date) from anon;
grant execute on function public.cartera_resumen(date) to authenticated;

comment on function public.cartera_resumen(date) is
  'CART-010: snapshot ejecutivo de cartera para una fecha_corte. Devuelve totales, distribución PAR (8 buckets) y porcentajes PAR>30/PAR>90. Valida acceso (admin o profiles.acceso_cartera=true).';
