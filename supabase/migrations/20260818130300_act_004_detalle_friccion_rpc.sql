-- ACT-004 — RPCs de las otras dos pantallas del módulo Actividades.
--
--   act_detalle  → "¿quién hace qué?"  (página 02 del Power BI)
--   act_friccion → "¿dónde duele?"     (la página que el .pbix dejó llamada
--                                       «Duplicado de 02 - Actividades»)
--
-- Ambas comparten la misma firma de filtros que act_resumen para que el estado
-- viva en la URL y moverse entre pantallas conserve lo que estabas mirando.

-- ── act_detalle ──────────────────────────────────────────────────────────────
create or replace function public.act_detalle(
  p_periodo   text default null,
  p_direccion text default null,
  p_gerencia  text default null,
  p_puesto    text default null,
  p_empleado  text default null,
  p_categoria text default null
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_periodo      text;
  v_periodo_prev text;
  v_horas        numeric;
  v_resultado    json;
begin
  if not has_actividades_access() then
    raise exception 'Sin acceso al módulo de actividades' using errcode = '42501';
  end if;

  v_periodo := coalesce(nullif(p_periodo, ''), (select max(periodo) from act_registros));
  if v_periodo is null then
    return json_build_object('periodo', null, 'actividades', '[]'::json, 'personas', '[]'::json);
  end if;

  v_periodo_prev := (select max(periodo) from act_registros where periodo < v_periodo);

  select coalesce(sum(horas), 0) into v_horas
  from act_registros
  where periodo = v_periodo
    and (p_direccion is null or direccion   = p_direccion)
    and (p_gerencia  is null or gerencia    = p_gerencia)
    and (p_puesto    is null or puesto      = p_puesto)
    and (p_empleado  is null or no_empleado = p_empleado)
    and (p_categoria is null or categoria   = p_categoria);

  with filtrado as (
    select * from act_registros
    where periodo = v_periodo
      and (p_direccion is null or direccion   = p_direccion)
      and (p_gerencia  is null or gerencia    = p_gerencia)
      and (p_puesto    is null or puesto      = p_puesto)
      and (p_empleado  is null or no_empleado = p_empleado)
      and (p_categoria is null or categoria   = p_categoria)
  ),
  -- Mismo filtro sobre el periodo anterior: sirve para la variación por persona.
  previo as (
    select no_empleado, sum(horas) horas
    from act_registros
    where periodo = v_periodo_prev
      and (p_direccion is null or direccion   = p_direccion)
      and (p_gerencia  is null or gerencia    = p_gerencia)
      and (p_puesto    is null or puesto      = p_puesto)
      and (p_empleado  is null or no_empleado = p_empleado)
      and (p_categoria is null or categoria   = p_categoria)
    group by no_empleado
  )
  select json_build_object(
    'periodo',          v_periodo,
    'periodo_anterior', v_periodo_prev,
    'horas_visibles',   round(v_horas, 2),

    -- Se devuelven TODAS las actividades, no un top N. El tablero original
    -- fijaba Top 5 en el propio visual; aquí el corte lo decide la pantalla,
    -- que además puede ofrecer "ver todas" sin otra consulta.
    'actividades', (
      select coalesce(json_agg(json_build_object(
        'actividad',     actividad,
        'categoria',     categoria,
        'horas',         round(horas, 2),
        'pct',           case when v_horas > 0 then round(horas / v_horas * 100, 2) else 0 end,
        'colaboradores', colaboradores,
        'gerencias',     gerencias,
        'registros',     registros
      ) order by horas desc), '[]'::json)
      from (
        select coalesce(actividad, 'Sin actividad') actividad,
               min(categoria) categoria,
               sum(horas) horas,
               count(distinct no_empleado)::int colaboradores,
               count(distinct gerencia)::int    gerencias,
               count(*)::int                    registros
        from filtrado group by coalesce(actividad, 'Sin actividad')
      ) t
    ),

    'personas', (
      select coalesce(json_agg(json_build_object(
        'no_empleado',      no_empleado,
        'nombre',           nombre,
        'puesto',           puesto,
        'gerencia',         gerencia,
        'direccion',        direccion,
        'horas',            round(horas, 2),
        'pct',              case when v_horas > 0 then round(horas / v_horas * 100, 2) else 0 end,
        'registros',        registros,
        'actividades',      actividades,
        'horas_anterior',   case when horas_prev is null then null else round(horas_prev, 2) end,
        'crecimiento_pct',  case
          when horas_prev is null or horas_prev = 0 then null
          else round((horas - horas_prev) / horas_prev * 100, 2)
        end,
        'pct_friccion', case when horas > 0
          then round(horas_friccion / horas * 100, 2) else 0 end
      ) order by horas desc), '[]'::json)
      from (
        select f.no_empleado,
               min(f.nombre)    nombre,
               min(f.puesto)    puesto,
               min(f.gerencia)  gerencia,
               min(f.direccion) direccion,
               sum(f.horas)     horas,
               count(*)::int    registros,
               count(distinct f.actividad)::int actividades,
               coalesce(sum(f.horas) filter (where f.tipo_motivo = 'FRICCION'), 0) horas_friccion,
               (select p.horas from previo p where p.no_empleado = f.no_empleado) horas_prev
        from filtrado f
        group by f.no_empleado
      ) t
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.act_detalle(text, text, text, text, text, text) from public, anon;
grant execute on function public.act_detalle(text, text, text, text, text, text) to authenticated;

comment on function public.act_detalle(text, text, text, text, text, text) is
  'ACT-004: actividades y personas del periodo, con variación contra el periodo anterior. Valida acceso.';

-- ── act_friccion ─────────────────────────────────────────────────────────────
create or replace function public.act_friccion(
  p_periodo   text default null,
  p_direccion text default null,
  p_gerencia  text default null,
  p_puesto    text default null,
  p_empleado  text default null,
  p_categoria text default null,
  p_tipo      text default null      -- POSITIVO | FRICCION | CONTEXTO
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_periodo    text;
  v_horas      numeric;   -- todas las horas del filtro (relevantes o no)
  v_horas_rel  numeric;   -- solo las que dejaron nota
  v_resultado  json;
begin
  if not has_actividades_access() then
    raise exception 'Sin acceso al módulo de actividades' using errcode = '42501';
  end if;

  v_periodo := coalesce(nullif(p_periodo, ''), (select max(periodo) from act_registros));
  if v_periodo is null then
    return json_build_object('periodo', null, 'por_tipo', '[]'::json,
                             'por_motivo', '[]'::json, 'detalle', '[]'::json);
  end if;

  select coalesce(sum(horas), 0),
         coalesce(sum(horas) filter (where hubo_algo_relevante), 0)
    into v_horas, v_horas_rel
  from act_registros
  where periodo = v_periodo
    and (p_direccion is null or direccion   = p_direccion)
    and (p_gerencia  is null or gerencia    = p_gerencia)
    and (p_puesto    is null or puesto      = p_puesto)
    and (p_empleado  is null or no_empleado = p_empleado)
    and (p_categoria is null or categoria   = p_categoria);

  with relevante as (
    select * from act_registros
    where periodo = v_periodo
      and hubo_algo_relevante
      and (p_direccion is null or direccion   = p_direccion)
      and (p_gerencia  is null or gerencia    = p_gerencia)
      and (p_puesto    is null or puesto      = p_puesto)
      and (p_empleado  is null or no_empleado = p_empleado)
      and (p_categoria is null or categoria   = p_categoria)
      and (p_tipo      is null or tipo_motivo = p_tipo)
  )
  select json_build_object(
    'periodo', v_periodo,

    'kpis', json_build_object(
      'horas',            round(v_horas, 2),
      'horas_relevantes', round(v_horas_rel, 2),
      -- Denominador = TODAS las horas, no solo las relevantes. Es la definición
      -- verificada contra el tablero (0.16 en agosto, no 0.37).
      'pct_relevante', case when v_horas > 0
        then round(v_horas_rel / v_horas * 100, 2) else 0 end,
      'pct_friccion', case when v_horas > 0 then round(
        (select coalesce(sum(horas), 0) from relevante where tipo_motivo = 'FRICCION')
        / v_horas * 100, 2) else 0 end,
      'horas_friccion', (select coalesce(round(sum(horas), 2), 0) from relevante
                         where tipo_motivo = 'FRICCION'),
      'personas',   (select count(distinct no_empleado)::int from relevante),
      'registros',  (select count(*)::int from relevante)
    ),

    'por_tipo', (
      select coalesce(json_agg(json_build_object(
        'tipo',  tipo,
        'horas', round(horas, 2),
        'pct',   case when v_horas_rel > 0 then round(horas / v_horas_rel * 100, 2) else 0 end,
        'registros', registros
      ) order by orden), '[]'::json)
      from (
        select coalesce(tipo_motivo, 'SIN TIPO') tipo,
               sum(horas) horas, count(*)::int registros,
               -- Orden de escala divergente: positivo → contexto → fricción.
               case coalesce(tipo_motivo, '') when 'POSITIVO' then 1
                                              when 'CONTEXTO' then 2
                                              when 'FRICCION' then 3 else 4 end orden
        from relevante group by tipo_motivo
      ) t
    ),

    'por_motivo', (
      select coalesce(json_agg(json_build_object(
        'motivo',    motivo,
        'tipo',      tipo,
        'horas',     round(horas, 2),
        'pct',       case when v_horas_rel > 0 then round(horas / v_horas_rel * 100, 2) else 0 end,
        'registros', registros,
        'personas',  personas
      ) order by horas desc), '[]'::json)
      from (
        select coalesce(motivo, 'Sin motivo') motivo,
               coalesce(min(tipo_motivo), 'SIN TIPO') tipo,
               sum(horas) horas, count(*)::int registros,
               count(distinct no_empleado)::int personas
        from relevante group by coalesce(motivo, 'Sin motivo')
      ) t
    ),

    -- Los comentarios son el activo real de esta pantalla: es lo único del
    -- dataset escrito por una persona y no elegido de una lista.
    'detalle', (
      select coalesce(json_agg(json_build_object(
        'fecha',      fecha,
        'nombre',     nombre,
        'gerencia',   gerencia,
        'direccion',  direccion,
        'actividad',  actividad,
        'motivo',     motivo,
        'tipo',       coalesce(tipo_motivo, 'SIN TIPO'),
        'comentario', comentario,
        'horas',      round(horas, 2)
      ) order by fecha desc, horas desc), '[]'::json)
      from (select * from relevante order by fecha desc, horas desc limit 300) t
    ),

    'detalle_truncado', (select count(*) > 300 from relevante)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.act_friccion(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.act_friccion(text, text, text, text, text, text, text) to authenticated;

comment on function public.act_friccion(text, text, text, text, text, text, text) is
  'ACT-004: motivos y comentarios del tiempo marcado como relevante, partido en POSITIVO/CONTEXTO/FRICCION. Valida acceso.';
