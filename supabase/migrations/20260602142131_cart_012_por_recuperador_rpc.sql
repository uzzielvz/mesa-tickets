-- CART-012: RPC cartera_por_recuperador(p_fecha_corte date, p_coordinacion text default null).
-- Igual que cartera_por_coordinacion pero agrupado por recuperador (codigo + nombre),
-- con filtro opcional por coordinacion para acotar a una región.
-- Alimenta el dashboard /cartera/recuperador.

create or replace function public.cartera_por_recuperador(
  p_fecha_corte  date,
  p_coordinacion text default null
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
      coalesce(codigo_recuperador, 'S/R')        as codigo,
      coalesce(coordinacion, 'Sin coordinación') as coordinacion,
      nombre_recuperador                         as nombre,
      coalesce(dias_mora, 0)   as dias_mora,
      coalesce(saldo_total, 0) as saldo
    from public.stg_yunius_cartera_individual
    where fecha_corte = p_fecha_corte
      and (p_coordinacion is null or coordinacion = p_coordinacion)
  ),
  clasificado as (
    select
      codigo,
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
  ),
  bucket_def(bucket, label, dias_min, dias_max, orden) as (
    values
      ('0',         'Corriente', 0,   0,    1),
      ('7',         '1-7',       1,   7,    2),
      ('15',        '8-15',      8,   15,   3),
      ('30',        '16-30',     16,  30,   4),
      ('60',        '31-60',     31,  60,   5),
      ('90',        '61-90',     61,  90,   6),
      ('Mayor_90',  '91-180',    91,  180,  7),
      ('Mayor_180', '181+',      181, null, 8)
  ),
  -- Totales por recuperador. coordinacion/nombre resueltos por max (1 valor por codigo).
  totales_rec as (
    select
      codigo,
      max(coordinacion)                                      as coordinacion,
      max(nombre)                                            as nombre,
      coalesce(sum(saldo), 0)                                as cartera_total,
      count(*)::int                                          as creditos,
      coalesce(sum(saldo) filter (where dias_mora > 0), 0)   as cartera_en_mora,
      count(*) filter (where dias_mora > 0)::int             as creditos_en_mora,
      coalesce(sum(saldo) filter (where dias_mora >= 31), 0) as saldo_par_30,
      coalesce(sum(saldo) filter (where dias_mora >= 91), 0) as saldo_par_90
    from base
    group by codigo
  ),
  rec_bucket as (
    select c.codigo, d.bucket, d.label, d.dias_min, d.dias_max, d.orden
    from (select distinct codigo from base) c
    cross join bucket_def d
  ),
  par_por_rec as (
    select
      rb.codigo,
      rb.bucket,
      rb.label,
      rb.dias_min,
      rb.dias_max,
      rb.orden,
      coalesce(count(cl.bucket), 0)::int  as creditos,
      coalesce(sum(cl.saldo), 0)::numeric as saldo
    from rec_bucket rb
    left join clasificado cl
      on cl.codigo = rb.codigo
     and cl.bucket = rb.bucket
    group by rb.codigo, rb.bucket, rb.label, rb.dias_min, rb.dias_max, rb.orden
  ),
  par_agg as (
    select
      codigo,
      json_agg(json_build_object(
        'bucket',    bucket,
        'label',     label,
        'dias_min',  dias_min,
        'dias_max',  dias_max,
        'creditos',  creditos,
        'saldo',     saldo
      ) order by orden) as par
    from par_por_rec
    group by codigo
  ),
  por_rec as (
    select
      t.codigo,
      t.nombre,
      t.coordinacion,
      t.creditos,
      t.cartera_total,
      t.creditos_en_mora,
      t.cartera_en_mora,
      case when t.cartera_total > 0
           then round((t.cartera_en_mora / t.cartera_total * 100)::numeric, 2)
           else 0 end as pct_mora,
      case when t.cartera_total > 0
           then round((t.saldo_par_30 / t.cartera_total * 100)::numeric, 2)
           else 0 end as pct_par_30,
      case when t.cartera_total > 0
           then round((t.saldo_par_90 / t.cartera_total * 100)::numeric, 2)
           else 0 end as pct_par_90,
      p.par
    from totales_rec t
    left join par_agg p on p.codigo = t.codigo
  )
  select json_build_object(
    'fecha_corte',  p_fecha_corte,
    'coordinacion', p_coordinacion,
    'recuperadores', coalesce((
      select json_agg(json_build_object(
        'codigo',           codigo,
        'nombre',           nombre,
        'coordinacion',     coordinacion,
        'creditos',         creditos,
        'cartera_total',    cartera_total,
        'creditos_en_mora', creditos_en_mora,
        'cartera_en_mora',  cartera_en_mora,
        'pct_mora',         pct_mora,
        'pct_par_30',       pct_par_30,
        'pct_par_90',       pct_par_90,
        'par',              par
      ) order by pct_par_30 desc, cartera_total desc)
      from por_rec
    ), '[]'::json)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.cartera_por_recuperador(date, text) from public;
revoke all on function public.cartera_por_recuperador(date, text) from anon;
grant execute on function public.cartera_por_recuperador(date, text) to authenticated;

comment on function public.cartera_por_recuperador(date, text) is
  'CART-012: cartera × PAR agregada por recuperador (codigo + nombre + coordinacion). Filtro opcional por coordinacion. Para cada recuperador devuelve totales + indicadores PAR>30/90 + array par con 8 buckets. Ordenado por pct_par_30 desc. Métrica = saldo_total. Security definer + check rol=admin OR acceso_cartera=true.';
