-- CART-014: RPC cartera_cohort.
-- Parte la cartera de un corte en dos cohortes por `fecha_inicio_ciclo`:
--   'antes' = ciclos iniciados ANTES de la fecha frontera (equivale a la hoja "Marzo" del legacy).
--   'desde' = ciclos iniciados DESDE la fecha frontera en adelante (hoja "Abril").
-- Las hojas "Marzo"/"Abril" del output original son solo etiquetas: el corte real es por fecha
-- frontera (1-abr-2026 por defecto, configurable después).
-- Cada cohorte devuelve el mismo contrato que cartera_resumen: totales + par (8 buckets) + indicadores.
-- `sin_fecha` reporta los créditos sin fecha_inicio_ciclo para que el total cuadre.
-- Métrica monetaria = saldo_total (estándar industria, igual que cartera_resumen).

create or replace function public.cartera_cohort(
  p_fecha_corte date,
  p_frontera date default date '2026-04-01'
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_caller_role   text;
  v_caller_acceso boolean;
  v_resultado     json;
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

  with base as (
    select
      case
        when fecha_inicio_ciclo is null      then 'sin_fecha'
        when fecha_inicio_ciclo < p_frontera then 'antes'
        else 'desde'
      end                      as cohorte,
      coalesce(dias_mora, 0)   as dias_mora,
      coalesce(saldo_total, 0) as saldo
    from public.stg_yunius_cartera_individual
    where fecha_corte = p_fecha_corte
  ),
  clasificado as (
    select
      cohorte,
      dias_mora,
      saldo,
      case
        when dias_mora < 1    then '0'
        when dias_mora <= 7   then '7'
        when dias_mora <= 15  then '15'
        when dias_mora <= 30  then '30'
        when dias_mora <= 60  then '60'
        when dias_mora <= 90  then '90'
        when dias_mora <= 180 then 'Mayor_90'
        else 'Mayor_180'
      end as bucket
    from base
    where cohorte in ('antes', 'desde')
  ),
  cohorte_def(cohorte, etiqueta, orden) as (
    values
      ('antes', 'Antes del 1-abr', 1),
      ('desde', 'Desde el 1-abr',  2)
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
  cohorte_tot as (
    select
      cohorte,
      count(*)::int                                              as creditos,
      coalesce(sum(saldo), 0)::numeric                           as cartera_total,
      count(*) filter (where dias_mora > 0)::int                 as creditos_en_mora,
      coalesce(sum(saldo) filter (where dias_mora > 0), 0)::numeric  as cartera_en_mora,
      coalesce(sum(saldo) filter (where dias_mora >= 31), 0)::numeric as saldo_par30,
      coalesce(sum(saldo) filter (where dias_mora >= 91), 0)::numeric as saldo_par90
    from clasificado
    group by cohorte
  ),
  par_agg as (
    select
      cd.cohorte,
      bd.bucket,
      bd.label,
      bd.dias_min,
      bd.dias_max,
      bd.orden,
      coalesce(count(c.bucket), 0)::int  as creditos,
      coalesce(sum(c.saldo), 0)::numeric as saldo,
      coalesce(ct.cartera_total, 0)::numeric as cartera_total
    from cohorte_def cd
    cross join bucket_def bd
    left join clasificado c  on c.cohorte = cd.cohorte and c.bucket = bd.bucket
    left join cohorte_tot ct on ct.cohorte = cd.cohorte
    group by cd.cohorte, bd.bucket, bd.label, bd.dias_min, bd.dias_max, bd.orden, ct.cartera_total
  )
  select json_build_object(
    'fecha_corte', p_fecha_corte,
    'frontera',    p_frontera,
    'sin_fecha',   (select count(*)::int from base where cohorte = 'sin_fecha'),
    'cohortes', (
      select json_agg(c_obj order by orden)
      from (
        select
          cd.orden,
          json_build_object(
            'clave',    cd.cohorte,
            'etiqueta', cd.etiqueta,
            'totales', json_build_object(
              'creditos',         coalesce(ct.creditos, 0),
              'cartera_total',    coalesce(ct.cartera_total, 0),
              'creditos_en_mora', coalesce(ct.creditos_en_mora, 0),
              'cartera_en_mora',  coalesce(ct.cartera_en_mora, 0),
              'pct_mora', case
                when coalesce(ct.cartera_total, 0) > 0
                  then round((ct.cartera_en_mora / ct.cartera_total * 100)::numeric, 2)
                else 0
              end
            ),
            'indicadores', json_build_object(
              'pct_par_30', case
                when coalesce(ct.cartera_total, 0) > 0
                  then round((ct.saldo_par30 / ct.cartera_total * 100)::numeric, 2)
                else 0
              end,
              'pct_par_90', case
                when coalesce(ct.cartera_total, 0) > 0
                  then round((ct.saldo_par90 / ct.cartera_total * 100)::numeric, 2)
                else 0
              end
            ),
            'par', (
              select json_agg(
                json_build_object(
                  'bucket',   pa.bucket,
                  'label',    pa.label,
                  'dias_min', pa.dias_min,
                  'dias_max', pa.dias_max,
                  'creditos', pa.creditos,
                  'saldo',    pa.saldo,
                  'pct_saldo', case
                    when pa.cartera_total > 0
                      then round((pa.saldo / pa.cartera_total * 100)::numeric, 2)
                    else 0
                  end
                )
                order by pa.orden
              )
              from par_agg pa
              where pa.cohorte = cd.cohorte
            )
          ) as c_obj
        from cohorte_def cd
        left join cohorte_tot ct on ct.cohorte = cd.cohorte
      ) q
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

grant execute on function public.cartera_cohort(date, date) to authenticated;

comment on function public.cartera_cohort(date, date) is
  'CART-014: parte la cartera de un corte en dos cohortes por fecha_inicio_ciclo (antes/desde la fecha frontera, 1-abr-2026 por defecto). Cada cohorte = totales + PAR (8 buckets) + PAR>30/PAR>90, mismo contrato que cartera_resumen. Métrica = saldo_total. Valida acceso (admin o profiles.acceso_cartera=true).';
