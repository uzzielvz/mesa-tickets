-- CART-010d: fix cartera_filtros.
-- Postgres no permite max() anidado dentro de json_agg(). Resolvemos el grouping
-- en una subquery y solo json_agg-eamos el resultado.

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
      select json_agg(
        json_build_object('codigo', codigo, 'nombre', nombre)
        order by codigo
      )
      from (
        select
          codigo_recuperador          as codigo,
          max(nombre_recuperador)     as nombre
        from public.stg_yunius_cartera_individual
        where fecha_corte = p_fecha_corte
          and codigo_recuperador is not null
        group by codigo_recuperador
      ) sub
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
