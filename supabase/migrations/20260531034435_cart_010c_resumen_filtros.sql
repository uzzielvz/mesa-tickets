-- CART-010c: filtros opcionales para cartera_resumen + RPC auxiliar cartera_filtros.
-- Extiende la firma con coordinacion / codigo_recuperador / ciclo (todos opcionales).
-- Agrega cartera_filtros(fecha_corte) → catálogos para poblar los dropdowns.

-- ---------------------------------------------------------------------------
-- 1. cartera_resumen con filtros opcionales
-- ---------------------------------------------------------------------------

-- La firma cambia: drop explícito de la versión anterior (mismo nombre, distintos args).
drop function if exists public.cartera_resumen(date);

create or replace function public.cartera_resumen(
  p_fecha_corte        date,
  p_coordinacion       text default null,
  p_codigo_recuperador text default null,
  p_ciclo              text default null
)
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
  select rol, acceso_cartera into v_caller_role, v_caller_acceso
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if v_caller_role <> 'admin' and coalesce(v_caller_acceso, false) = false then
    raise exception 'Sin acceso a cartera' using errcode = '42501';
  end if;

  -- Subconjunto pre-filtrado. Usamos parámetros con IS NULL para hacer los filtros
  -- "opcionales" sin generar SQL dinámico (más seguro y cacheable).
  with base as (
    select
      coalesce(dias_mora, 0)   as dias_mora,
      coalesce(saldo_total, 0) as saldo
    from public.stg_yunius_cartera_individual
    where fecha_corte = p_fecha_corte
      and (p_coordinacion       is null or coordinacion       = p_coordinacion)
      and (p_codigo_recuperador is null or codigo_recuperador = p_codigo_recuperador)
      and (p_ciclo              is null or ciclo              = p_ciclo)
  ),
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
  totales as (
    select
      coalesce(sum(saldo), 0)                                   as cartera_total,
      count(*)::int                                              as creditos,
      coalesce(sum(saldo) filter (where dias_mora > 0), 0)      as cartera_en_mora,
      count(*) filter (where dias_mora > 0)::int                as creditos_en_mora,
      coalesce(sum(saldo) filter (where dias_mora >= 31), 0)    as saldo_par_30,
      coalesce(sum(saldo) filter (where dias_mora >= 91), 0)    as saldo_par_90
    from base
  ),
  par_agg as (
    select
      d.bucket, d.label, d.dias_min, d.dias_max, d.orden,
      coalesce(count(c.bucket), 0)::int  as creditos,
      coalesce(sum(c.saldo), 0)::numeric as saldo
    from bucket_def d
    left join clasificado c on c.bucket = d.bucket
    group by d.bucket, d.label, d.dias_min, d.dias_max, d.orden
  )
  select json_build_object(
    'fecha_corte', p_fecha_corte,
    'filtros_aplicados', json_build_object(
      'coordinacion',       p_coordinacion,
      'codigo_recuperador', p_codigo_recuperador,
      'ciclo',              p_ciclo
    ),
    'totales', json_build_object(
      'creditos',         t.creditos,
      'cartera_total',    t.cartera_total,
      'creditos_en_mora', t.creditos_en_mora,
      'cartera_en_mora',  t.cartera_en_mora,
      'pct_mora', case when t.cartera_total > 0
                       then round((t.cartera_en_mora / t.cartera_total * 100)::numeric, 2)
                       else 0 end
    ),
    'par', (
      select json_agg(json_build_object(
        'bucket',    p.bucket,
        'label',     p.label,
        'dias_min',  p.dias_min,
        'dias_max',  p.dias_max,
        'creditos',  p.creditos,
        'saldo',     p.saldo,
        'pct_saldo', case when t.cartera_total > 0
                          then round((p.saldo / t.cartera_total * 100)::numeric, 2)
                          else 0 end
      ) order by p.orden)
      from par_agg p
    ),
    'indicadores', json_build_object(
      'pct_par_30', case when t.cartera_total > 0
                         then round((t.saldo_par_30 / t.cartera_total * 100)::numeric, 2)
                         else 0 end,
      'pct_par_90', case when t.cartera_total > 0
                         then round((t.saldo_par_90 / t.cartera_total * 100)::numeric, 2)
                         else 0 end
    )
  ) into v_resultado
  from totales t;

  return v_resultado;
end;
$$;

revoke all on function public.cartera_resumen(date, text, text, text) from public;
revoke all on function public.cartera_resumen(date, text, text, text) from anon;
grant execute on function public.cartera_resumen(date, text, text, text) to authenticated;

comment on function public.cartera_resumen(date, text, text, text) is
  'CART-010: snapshot ejecutivo de cartera con filtros opcionales (coordinacion, codigo_recuperador, ciclo). Métrica = saldo_total. Devuelve totales + 8 buckets PAR + indicadores PAR>30/90.';


-- ---------------------------------------------------------------------------
-- 2. cartera_filtros: catálogos para poblar dropdowns en el dashboard
-- ---------------------------------------------------------------------------

create or replace function public.cartera_filtros(p_fecha_corte date)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller_role  text;
  v_caller_acceso boolean;
  v_resultado json;
begin
  select rol, acceso_cartera into v_caller_role, v_caller_acceso
  from public.profiles
  where id = auth.uid();

  if v_caller_role is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if v_caller_role <> 'admin' and coalesce(v_caller_acceso, false) = false then
    raise exception 'Sin acceso a cartera' using errcode = '42501';
  end if;

  select json_build_object(
    'fecha_corte', p_fecha_corte,
    'coordinaciones', coalesce((
      select json_agg(distinct coordinacion order by coordinacion)
      from public.stg_yunius_cartera_individual
      where fecha_corte = p_fecha_corte and coordinacion is not null
    ), '[]'::json),
    'recuperadores', coalesce((
      select json_agg(json_build_object(
        'codigo', codigo_recuperador,
        'nombre', max(nombre_recuperador)
      ) order by codigo_recuperador)
      from public.stg_yunius_cartera_individual
      where fecha_corte = p_fecha_corte and codigo_recuperador is not null
      group by codigo_recuperador
    ), '[]'::json),
    'ciclos', coalesce((
      select json_agg(distinct ciclo order by ciclo)
      from public.stg_yunius_cartera_individual
      where fecha_corte = p_fecha_corte and ciclo is not null
    ), '[]'::json)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.cartera_filtros(date) from public;
revoke all on function public.cartera_filtros(date) from anon;
grant execute on function public.cartera_filtros(date) to authenticated;

comment on function public.cartera_filtros(date) is
  'CART-010c: devuelve catálogos (coordinaciones, recuperadores, ciclos) disponibles para una fecha_corte, para poblar dropdowns en el dashboard.';
