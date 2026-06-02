-- CART-013: RPC cartera_mora_operativa(fecha, coordinacion?, dias_min?) returns json.
-- Lista accionable de créditos en mora (la "bandeja operativa" del Excel, hoja `Mora`).
-- A diferencia de los RPCs ejecutivos, devuelve filas individuales (un crédito por fila)
-- con los campos que el equipo de cobranza necesita para gestionar.

create or replace function public.cartera_mora_operativa(
  p_fecha_corte  date,
  p_coordinacion text default null,
  p_dias_min     int  default 1
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

  select json_build_object(
    'fecha_corte',  p_fecha_corte,
    'coordinacion', p_coordinacion,
    'dias_min',     p_dias_min,
    'creditos', coalesce((
      select json_agg(json_build_object(
        'codigo_acreditado',      codigo_acreditado,
        'nombre_acreditado',      nombre_acreditado,
        'coordinacion',           coalesce(coordinacion, 'Sin coordinación'),
        'codigo_recuperador',     codigo_recuperador,
        'nombre_recuperador',     nombre_recuperador,
        'ciclo',                  ciclo,
        'dias_mora',              coalesce(dias_mora, 0),
        'bucket',                 case
                                    when coalesce(dias_mora,0) <= 7   then '1-7'
                                    when dias_mora <= 15  then '8-15'
                                    when dias_mora <= 30  then '16-30'
                                    when dias_mora <= 60  then '31-60'
                                    when dias_mora <= 90  then '61-90'
                                    when dias_mora <= 180 then '91-180'
                                    else '181+'
                                  end,
        'saldo_total',            coalesce(saldo_total, 0),
        'saldo_vencido',          coalesce(saldo_vencido, 0),
        'pagos_vencidos',         pagos_vencidos,
        'dias_desde_ultimo_pago', dias_desde_ultimo_pago,
        'fecha_ultimo_pago',      fecha_ultimo_pago,
        'alerta',                 alerta,
        'criticidad',             criticidad,
        'contacto',               coalesce(medio_comunic_1, medio_comunic_2, medio_comunic_3)
      ) order by dias_mora desc, saldo_vencido desc)
      from public.stg_yunius_cartera_individual
      where fecha_corte = p_fecha_corte
        and coalesce(dias_mora, 0) >= greatest(p_dias_min, 1)
        and (p_coordinacion is null or coordinacion = p_coordinacion)
    ), '[]'::json)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.cartera_mora_operativa(date, text, int) from public;
revoke all on function public.cartera_mora_operativa(date, text, int) from anon;
grant execute on function public.cartera_mora_operativa(date, text, int) to authenticated;

comment on function public.cartera_mora_operativa(date, text, int) is
  'CART-013: bandeja operativa de cobranza. Devuelve créditos con dias_mora >= dias_min (default 1) para la fecha de corte, con datos del acreditado/recuperador, saldos vencidos, alerta/criticidad y contacto. Filtro opcional por coordinacion. Ordenado por dias_mora desc. Security definer + check rol=admin OR acceso_cartera=true.';
