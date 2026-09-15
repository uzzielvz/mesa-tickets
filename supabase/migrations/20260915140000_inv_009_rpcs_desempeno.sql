-- INV-009 (I5) — Agregados del Tablero Ejecutivo, servidos por RPC.
--
-- Misma convención que INV-005 (Calendario): `returns json`, `security definer`
-- con autorización a mano, estructura vacía coherente sin datos. Todo agregado
-- sale por RPC — es lo que después se envuelve como tool del chat (I7).
--
-- **No se recalcula nada.** Las cifras vienen de `inv_tablero_resumen`,
-- `inv_ranking` e `inv_cumplimiento`, que I4 guardó tal cual del Excel
-- (regla 1 de §9.2).
--
-- Corte = `periodo_fin` de la carga. Es lo que Dirección lee ("corte al 27/08"),
-- no el mes completo. Si hay varias cargas del mismo corte, gana la más reciente
-- ya procesada.

-- ── Resolución de la carga ──────────────────────────────────────────────────
create or replace function public.inv_carga_tablero(
  p_corte date default null
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id
  from inv_cargas
  where tipo_reporte = 'tablero'
    and estado = 'procesado'
    and (p_corte is null or periodo_fin = p_corte)
  order by periodo_fin desc, created_at desc
  limit 1
$$;

revoke execute on function public.inv_carga_tablero(date) from public;

-- ── Cortes disponibles ──────────────────────────────────────────────────────
create or replace function public.inv_cortes_tablero()
returns json
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(json_agg(x order by x.corte desc), '[]'::json)
  from (
    select distinct periodo_fin as corte,
                    periodo_inicio,
                    periodo_fin
    from inv_cargas
    where tipo_reporte = 'tablero' and estado = 'procesado'
  ) x
$$;

revoke execute on function public.inv_cortes_tablero() from public;

-- ── Resumen del corte (tiles + meta de la carga) ────────────────────────────
-- Los tiles salen de la fila TOTALES / nivel=total de la hoja Tablero — la
-- verdad que el Excel ya calculó, no una suma nuestra sobre gerentes.
create or replace function public.inv_resumen_tablero(
  p_corte date default null
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_carga  uuid;
  v_cabeza record;
  v_tot    record;
  v_result json;
begin
  if not has_inversiones_desempeno() then
    raise exception 'Sin acceso al tablero de desempeño' using errcode = '42501';
  end if;

  v_carga := inv_carga_tablero(p_corte);

  if v_carga is null then
    return json_build_object(
      'corte', null,
      'cortes', inv_cortes_tablero(),
      'carga', null,
      'vigente', 0, 'abierto', 0, 'vencido', 0, 'crecimiento_neto', 0,
      'inv_vigentes', 0, 'ejecutivos', 0,
      'movimientos', 0, 'ranking', 0, 'cumplimiento', 0,
      'degradadas', '[]'::json
    );
  end if;

  select c.id, c.periodo_inicio, c.periodo_fin, c.nombre_archivo,
         c.created_at, c.avisos, c.hojas_degradadas
    into v_cabeza
  from inv_cargas c where c.id = v_carga;

  select vigente, abierto, vencido, crecimiento_neto, inv_vigentes, ejecutivos
    into v_tot
  from inv_tablero_resumen
  where carga_id = v_carga
    and hoja = 'Tablero'
    and universo = 'TOTALES'
    and nivel = 'total'
  order by orden
  limit 1;

  select json_build_object(
    'corte',   v_cabeza.periodo_fin,
    'cortes',  inv_cortes_tablero(),
    'carga', json_build_object(
      'id',               v_cabeza.id,
      'nombre_archivo',   v_cabeza.nombre_archivo,
      'periodo_inicio',   v_cabeza.periodo_inicio,
      'periodo_fin',      v_cabeza.periodo_fin,
      'created_at',       v_cabeza.created_at,
      'avisos',           to_json(v_cabeza.avisos),
      'hojas_degradadas', to_json(v_cabeza.hojas_degradadas)
    ),
    'vigente',          coalesce(v_tot.vigente, 0),
    'abierto',          coalesce(v_tot.abierto, 0),
    'vencido',          coalesce(v_tot.vencido, 0),
    'crecimiento_neto', coalesce(v_tot.crecimiento_neto, 0),
    'inv_vigentes',     coalesce(v_tot.inv_vigentes, 0),
    'ejecutivos',       coalesce(v_tot.ejecutivos, 0),
    'movimientos', (select count(*) from inv_movimientos where carga_id = v_carga),
    'ranking',     (select count(*) from inv_ranking where carga_id = v_carga),
    'cumplimiento',(select count(*) from inv_cumplimiento where carga_id = v_carga),
    'degradadas',  coalesce(to_json(v_cabeza.hojas_degradadas), '[]'::json)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.inv_resumen_tablero(date) to authenticated;

-- ── Filas del Tablero / Tablero_Estructura ──────────────────────────────────
-- p_hoja: 'Tablero' | 'Tablero_Estructura'
-- Se sirven tal cual, ordenadas por `orden` (el del parser = el del Excel).
create or replace function public.inv_tablero_filas(
  p_corte date default null,
  p_hoja  text default 'Tablero'
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
  if not has_inversiones_desempeno() then
    raise exception 'Sin acceso al tablero de desempeño' using errcode = '42501';
  end if;

  if p_hoja is distinct from 'Tablero' and p_hoja is distinct from 'Tablero_Estructura' then
    raise exception 'Hoja inválida: %', p_hoja using errcode = '22023';
  end if;

  v_carga := inv_carga_tablero(p_corte);
  if v_carga is null then
    return json_build_object('corte', null, 'hoja', p_hoja, 'filas', '[]'::json);
  end if;

  select json_build_object(
    'corte', (select periodo_fin from inv_cargas where id = v_carga),
    'hoja',  p_hoja,
    'filas', coalesce((
      select json_agg(json_build_object(
               'universo',          universo,
               'nivel',             nivel,
               'orden',             orden,
               'gerente_ejecutivo', gerente_ejecutivo,
               'gerente_inversion', gerente_inversion,
               'ejecutivo',         ejecutivo,
               'generacion',        generacion,
               'tipo_colaborador',  tipo_colaborador,
               'origen',            origen,
               'ejecutivos',        ejecutivos,
               'inv_vigentes',      inv_vigentes,
               'vigente',           vigente,
               'abierto',           abierto,
               'vencido',           vencido,
               'crecimiento_neto',  crecimiento_neto
             ) order by orden)
      from inv_tablero_resumen
      where carga_id = v_carga and hoja = p_hoja
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.inv_tablero_filas(date, text) to authenticated;

-- ── Ranking ─────────────────────────────────────────────────────────────────
-- p_con_meta: false = Ranking_Comercial, true = Ranking_Con_Meta
-- p_nivel: gerente_ejecutivo | gerente_inversion | ejecutivo
create or replace function public.inv_ranking_filas(
  p_corte    date default null,
  p_con_meta boolean default false,
  p_nivel    text default 'gerente_ejecutivo'
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
  if not has_inversiones_desempeno() then
    raise exception 'Sin acceso al tablero de desempeño' using errcode = '42501';
  end if;

  if p_nivel not in ('gerente_ejecutivo', 'gerente_inversion', 'ejecutivo') then
    raise exception 'Nivel inválido: %', p_nivel using errcode = '22023';
  end if;

  v_carga := inv_carga_tablero(p_corte);
  if v_carga is null then
    return json_build_object(
      'corte', null, 'con_meta', p_con_meta, 'nivel', p_nivel,
      'degradado', false, 'filas', '[]'::json
    );
  end if;

  select json_build_object(
    'corte',     (select periodo_fin from inv_cargas where id = v_carga),
    'con_meta',  p_con_meta,
    'nivel',     p_nivel,
    -- Si la hoja entera vino SIN_DATOS, I4 la anotó en hojas_degradadas.
    'degradado', exists (
      select 1 from inv_cargas c
      where c.id = v_carga
        and c.hojas_degradadas ? (
          case when p_con_meta then 'Ranking_Con_Meta' else 'Ranking_Comercial' end
        )
    ),
    'filas', coalesce((
      select json_agg(json_build_object(
               'posicion',              posicion,
               'gerente_ejecutivo',     gerente_ejecutivo,
               'gerente_inversion',     gerente_inversion,
               'ejecutivo',             ejecutivo,
               'produccion_ponderada',  produccion_ponderada,
               'clientes_nuevos',       clientes_nuevos,
               'retencion_vencimientos', retencion_vencimientos,
               'saldo_vigente_corte',   saldo_vigente_corte,
               'crecimiento_neto',      crecimiento_neto,
               'meta_periodo',          meta_periodo,
               'colocacion_para_meta',  colocacion_para_meta,
               'cumplimiento_meta',     cumplimiento_meta,
               'puntaje',               puntaje,
               'puntaje_sin_meta',      puntaje_sin_meta,
               'puntaje_meta',          puntaje_meta,
               'lectura',               lectura
             ) order by posicion nulls last, puntaje desc nulls last)
      from inv_ranking
      where carga_id = v_carga
        and con_meta = p_con_meta
        and nivel = p_nivel
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.inv_ranking_filas(date, boolean, text) to authenticated;

-- ── Cumplimiento de metas (serie mensual agregada + detalle del último mes) ─
-- Cada archivo ya trae el histórico desde 2024-11. No hace falta acumular cortes.
create or replace function public.inv_cumplimiento_serie(
  p_corte date default null
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_carga  uuid;
  v_ultimo date;
  v_result json;
begin
  if not has_inversiones_desempeno() then
    raise exception 'Sin acceso al tablero de desempeño' using errcode = '42501';
  end if;

  v_carga := inv_carga_tablero(p_corte);
  if v_carga is null then
    return json_build_object(
      'corte', null, 'serie', '[]'::json, 'ultimo_mes', null, 'detalle', '[]'::json
    );
  end if;

  select max(mes) into v_ultimo
  from inv_cumplimiento where carga_id = v_carga;

  select json_build_object(
    'corte', (select periodo_fin from inv_cargas where id = v_carga),
    'serie', coalesce((
      select json_agg(json_build_object(
               'mes',              mes,
               'meta',             meta,
               'colocacion',       colocacion,
               'cumplimiento_pct', case when meta > 0 then colocacion / meta else null end,
               'cumplieron',       cumplieron,
               'evaluados',        evaluados
             ) order by mes)
      from (
        select mes,
               sum(meta_mensual)     as meta,
               sum(colocacion_total) as colocacion,
               count(*) filter (where cumplio) as cumplieron,
               count(*)              as evaluados
        from inv_cumplimiento
        where carga_id = v_carga and mes is not null
        group by mes
      ) g
    ), '[]'::json),
    'ultimo_mes', v_ultimo,
    'detalle', coalesce((
      select json_agg(json_build_object(
               'gerente_ejecutivo', gerente_ejecutivo,
               'gerente_inversion', gerente_inversion,
               'ejecutivo',         ejecutivo,
               'meta_mensual',      meta_mensual,
               'nueva',             nueva,
               'renovacion',        renovacion,
               'incremento',        incremento,
               'colocacion_total',  colocacion_total,
               'cumplimiento_pct',  cumplimiento_pct,
               'cumplio',           cumplio
             ) order by cumplimiento_pct desc nulls last, ejecutivo)
      from inv_cumplimiento
      where carga_id = v_carga and mes = v_ultimo
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.inv_cumplimiento_serie(date) to authenticated;
