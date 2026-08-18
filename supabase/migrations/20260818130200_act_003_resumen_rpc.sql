-- ACT-003 — RPC act_resumen: la pantalla de estructura ("¿en qué se va el tiempo?").
--
-- Reemplaza las 8 medidas DAX del tablero de Power BI. Se verificaron una por una
-- contra el .pbix el 2026-08-18 (Horas Totales 452.50 sin filtros / 239.33 en
-- 2026-08 sirvió de ancla). Definiciones confirmadas:
--
--   Horas Totales ........... sum(horas)
--   Colaboradores ........... count(distinct no_empleado)
--   Gerencias Involucradas .. count(distinct gerencia)
--   % Tiempo Relevante ...... horas con hubo_algo_relevante ÷ horas totales
--                             (sobre HORAS, no sobre número de registros)
--   % Tiempo Fricción ....... horas con tipo_motivo='FRICCION' ÷ horas totales
--   % Participación ......... horas de la fila ÷ horas totales visibles
--   % Tiempo Seleccionado ... horas filtradas ÷ horas del periodo sin filtrar
--   Crecimiento Horas ....... (horas − horas periodo anterior) ÷ horas anterior
--
-- Dos cosas del original que NO se replican, a propósito:
--
--  1. En el .pbix, sin periodo seleccionado el crecimiento mostraba 1.12 — estaba
--     comparando julio+agosto contra junio+julio, y junio no existe. Un 112% de
--     crecimiento inventado. Aquí el periodo SIEMPRE tiene valor (default: el más
--     reciente con datos) y si no hay periodo anterior el KPI devuelve null, que
--     la UI pinta como "—" en vez de un número falso.
--
--  2. La matriz del original mostraba "% Participación = 1.00" en las ocho
--     direcciones: el DAX dividía las horas de la dirección entre sí mismas.
--     Aquí la participación es siempre contra el total visible, así que una
--     dirección con 91.75 de 452.50 horas se lee 20.28% y no 100%.

create or replace function public.act_resumen(
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
  v_horas        numeric;   -- con todos los filtros aplicados
  v_horas_univ   numeric;   -- del periodo, sin los filtros de estructura
  v_horas_prev   numeric;   -- periodo anterior, con los mismos filtros
  v_resultado    json;
begin
  -- security definer bypassa RLS: la autorización se valida a mano.
  if not has_actividades_access() then
    raise exception 'Sin acceso al módulo de actividades' using errcode = '42501';
  end if;

  -- El periodo nunca es null: sin selección, el más reciente con datos.
  v_periodo := coalesce(
    nullif(p_periodo, ''),
    (select max(periodo) from act_registros)
  );

  -- Sin datos cargados todavía: estructura vacía coherente, no error.
  if v_periodo is null then
    return json_build_object(
      'periodo', null, 'periodo_anterior', null,
      'periodos', '[]'::json,
      'filtros', json_build_object(
        'direcciones', '[]'::json, 'gerencias', '[]'::json,
        'puestos', '[]'::json, 'empleados', '[]'::json, 'categorias', '[]'::json
      ),
      'kpis', json_build_object(
        'horas', 0, 'colaboradores', 0, 'gerencias', 0, 'registros', 0,
        'crecimiento_pct', null, 'pct_relevante', 0, 'pct_friccion', 0,
        'pct_seleccionado', 0
      ),
      'por_direccion', '[]'::json, 'por_gerencia', '[]'::json,
      'por_categoria', '[]'::json, 'gerencia_categoria', '[]'::json,
      'por_nivel', '[]'::json
    );
  end if;

  -- Periodo anterior = el inmediatamente previo CON DATOS, no el mes calendario
  -- anterior. Si se deja de cargar un mes, la comparación sigue teniendo sentido
  -- en vez de dividir entre cero.
  v_periodo_prev := (
    select max(periodo) from act_registros where periodo < v_periodo
  );

  select coalesce(sum(horas), 0) into v_horas_univ
  from act_registros where periodo = v_periodo;

  select coalesce(sum(horas), 0) into v_horas
  from act_registros
  where periodo = v_periodo
    and (p_direccion is null or direccion   = p_direccion)
    and (p_gerencia  is null or gerencia    = p_gerencia)
    and (p_puesto    is null or puesto      = p_puesto)
    and (p_empleado  is null or no_empleado = p_empleado)
    and (p_categoria is null or categoria   = p_categoria);

  select coalesce(sum(horas), 0) into v_horas_prev
  from act_registros
  where periodo = v_periodo_prev
    and (p_direccion is null or direccion   = p_direccion)
    and (p_gerencia  is null or gerencia    = p_gerencia)
    and (p_puesto    is null or puesto      = p_puesto)
    and (p_empleado  is null or no_empleado = p_empleado)
    and (p_categoria is null or categoria   = p_categoria);

  with filtrado as (
    select *
    from act_registros
    where periodo = v_periodo
      and (p_direccion is null or direccion   = p_direccion)
      and (p_gerencia  is null or gerencia    = p_gerencia)
      and (p_puesto    is null or puesto      = p_puesto)
      and (p_empleado  is null or no_empleado = p_empleado)
      and (p_categoria is null or categoria   = p_categoria)
  )
  select json_build_object(
    'periodo',          v_periodo,
    'periodo_anterior', v_periodo_prev,

    'periodos', (
      select coalesce(json_agg(p order by p desc), '[]'::json)
      from (select distinct periodo as p from act_registros) t
    ),

    -- Opciones de los selectores: el universo del periodo, no lo ya filtrado
    -- (si se filtraran entre sí, elegir una dirección dejaría el selector de
    -- gerencia con una sola opción y no habría cómo cambiar de idea).
    'filtros', json_build_object(
      'direcciones', (select coalesce(json_agg(d order by d), '[]'::json)
                      from (select distinct direccion d from act_registros
                            where periodo = v_periodo and direccion is not null) t),
      'gerencias',   (select coalesce(json_agg(g order by g), '[]'::json)
                      from (select distinct gerencia g from act_registros
                            where periodo = v_periodo and gerencia is not null) t),
      'puestos',     (select coalesce(json_agg(p order by p), '[]'::json)
                      from (select distinct puesto p from act_registros
                            where periodo = v_periodo and puesto is not null) t),
      'categorias',  (select coalesce(json_agg(c order by c), '[]'::json)
                      from (select distinct categoria c from act_registros
                            where periodo = v_periodo and categoria is not null) t),
      'empleados',   (select coalesce(json_agg(
                        json_build_object('no_empleado', no_empleado, 'nombre', nombre)
                        order by nombre), '[]'::json)
                      from (select distinct no_empleado, nombre from act_registros
                            where periodo = v_periodo) t)
    ),

    'kpis', json_build_object(
      'horas',         round(v_horas, 2),
      'registros',     (select count(*)::int from filtrado),
      'colaboradores', (select count(distinct no_empleado)::int from filtrado),
      'gerencias',     (select count(distinct gerencia)::int from filtrado),

      -- null (no cero) cuando no hay con qué comparar: "—" es honesto, "0%" miente.
      'crecimiento_pct', case
        when v_periodo_prev is null or v_horas_prev = 0 then null
        else round((v_horas - v_horas_prev) / v_horas_prev * 100, 2)
      end,
      'horas_anterior', case when v_periodo_prev is null then null
                             else round(v_horas_prev, 2) end,

      'pct_relevante', case when v_horas > 0 then round(
        (select coalesce(sum(horas), 0) from filtrado where hubo_algo_relevante)
        / v_horas * 100, 2) else 0 end,

      'pct_friccion', case when v_horas > 0 then round(
        (select coalesce(sum(horas), 0) from filtrado where tipo_motivo = 'FRICCION')
        / v_horas * 100, 2) else 0 end,

      -- Qué tajada del periodo estás mirando. Sin filtros da 100.
      'pct_seleccionado', case when v_horas_univ > 0
        then round(v_horas / v_horas_univ * 100, 2) else 0 end
    ),

    'por_direccion', (
      select coalesce(json_agg(json_build_object(
        'direccion',     direccion,
        'horas',         round(horas, 2),
        'pct',           case when v_horas > 0 then round(horas / v_horas * 100, 2) else 0 end,
        'colaboradores', colaboradores,
        'gerencias',     gerencias
      ) order by horas desc), '[]'::json)
      from (
        select direccion,
               sum(horas) horas,
               count(distinct no_empleado)::int colaboradores,
               count(distinct gerencia)::int    gerencias
        from filtrado group by direccion
      ) t
    ),

    'por_gerencia', (
      select coalesce(json_agg(json_build_object(
        'gerencia',      gerencia,
        'direccion',     direccion,
        'horas',         round(horas, 2),
        'pct',           case when v_horas > 0 then round(horas / v_horas * 100, 2) else 0 end,
        'colaboradores', colaboradores
      ) order by horas desc), '[]'::json)
      from (
        select gerencia,
               min(direccion) direccion,   -- "First DIRECCION" del tablero original
               sum(horas) horas,
               count(distinct no_empleado)::int colaboradores
        from filtrado group by gerencia
      ) t
    ),

    'por_categoria', (
      select coalesce(json_agg(json_build_object(
        'categoria', categoria,
        'horas',     round(horas, 2),
        'pct',       case when v_horas > 0 then round(horas / v_horas * 100, 2) else 0 end
      ) order by horas desc), '[]'::json)
      from (select categoria, sum(horas) horas from filtrado group by categoria) t
    ),

    -- Insumo de las barras apiladas: mix de categorías dentro de cada gerencia.
    'gerencia_categoria', (
      select coalesce(json_agg(json_build_object(
        'gerencia',  gerencia,
        'categoria', categoria,
        'horas',     round(horas, 2)
      ) order by gerencia, horas desc), '[]'::json)
      from (
        select gerencia, categoria, sum(horas) horas
        from filtrado group by gerencia, categoria
      ) t
    ),

    -- No estaba en el Power BI. La columna existe y responde la primera pregunta
    -- de cualquier director: ¿cuánto del tiempo se va en niveles de dirección?
    'por_nivel', (
      select coalesce(json_agg(json_build_object(
        'nivel',         nivel_jerarquico,
        'horas',         round(horas, 2),
        'pct',           case when v_horas > 0 then round(horas / v_horas * 100, 2) else 0 end,
        'colaboradores', colaboradores
      ) order by horas desc), '[]'::json)
      from (
        select nivel_jerarquico, sum(horas) horas,
               count(distinct no_empleado)::int colaboradores
        from filtrado group by nivel_jerarquico
      ) t
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.act_resumen(text, text, text, text, text, text) from public, anon;
grant execute on function public.act_resumen(text, text, text, text, text, text) to authenticated;

comment on function public.act_resumen(text, text, text, text, text, text) is
  'ACT-003: KPIs y cortes por estructura del módulo Actividades. Replica las medidas del tablero de Power BI verificadas el 2026-08-18, corrigiendo el crecimiento sin periodo y la participación degenerada. Valida acceso (admin o profiles.acceso_actividades).';
