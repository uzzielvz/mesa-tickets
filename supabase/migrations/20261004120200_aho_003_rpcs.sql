-- AHO-003 — RPCs del visor de ahorros.
--
-- Convención de `inv_005`: `security definer` con la autorización validada a
-- mano, `returns json`, y una estructura coherente cuando no hay datos.
--
-- La carga va por lotes desde el NAVEGADOR (el CSV completo pesa ~29 MB y el
-- límite de cuerpo de una función de Vercel es 4.5 MB):
--   aho_iniciar_carga → aho_cargar_lote × N → aho_cerrar_carga

-- ── Carga ────────────────────────────────────────────────────────────────────
create or replace function public.aho_iniciar_carga(
  p_nombre     text,
  p_filas      int,
  p_rechazadas int,
  p_grupos     text[],
  p_avisos     text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if not has_ahorros_carga() then
    raise exception 'Sin permiso para cargar ahorros' using errcode = '42501';
  end if;

  insert into aho_cargas (nombre_archivo, filas_archivo, rechazadas, grupos, avisos, subido_por)
  values (
    left(coalesce(nullif(trim(p_nombre), ''), 'sin nombre'), 255),
    greatest(coalesce(p_filas, 0), 0),
    greatest(coalesce(p_rechazadas, 0), 0),
    coalesce(p_grupos, '{}'),
    coalesce(p_avisos[1:30], '{}'),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.aho_iniciar_carga(text, int, int, text[], text[]) from public, anon;
grant execute on function public.aho_iniciar_carga(text, int, int, text[], text[]) to authenticated;

-- Un lote: upsert por `pago_id`, nunca borra (regla 2).
--
-- Los números llegan como TEXTO dentro del json y se convierten a `numeric`
-- aquí: un rendimiento trae hasta 20 decimales y pasarlo por un `number` de
-- JavaScript lo redondearía antes de guardarlo (regla 1).
create or replace function public.aho_cargar_lote(
  p_carga uuid,
  p_filas jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_estado text;
  v_dueno  uuid;
  v_ins    int := 0;
  v_upd    int := 0;
begin
  if not has_ahorros_carga() then
    raise exception 'Sin permiso para cargar ahorros' using errcode = '42501';
  end if;

  select estado, subido_por into v_estado, v_dueno
  from aho_cargas where id = p_carga
  for update;

  if not found then
    raise exception 'La carga no existe';
  end if;
  if v_estado <> 'en_curso' then
    raise exception 'La carga ya se cerró; sube el archivo de nuevo';
  end if;
  if v_dueno is distinct from auth.uid() then
    raise exception 'La carga la inició otra persona' using errcode = '42501';
  end if;

  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'El lote debe ser un arreglo de filas';
  end if;
  if jsonb_array_length(p_filas) > 2000 then
    raise exception 'Lote demasiado grande (máximo 2000 filas)';
  end if;

  with entrada as (
    -- El navegador ya quita los repetidos; esto solo evita que un lote con
    -- dos filas del mismo pago truene el ON CONFLICT.
    select distinct on (x.pago_id) x.*
    from jsonb_to_recordset(p_filas) as x(
      pago_id text, key_grupo text, grupo_id text, ciclo text,
      cliente_id text, key_cliente text, semana smallint,
      pago numeric, garantia numeric, confirmada boolean, usuario_captura text,
      pago_semanal numeric, cantidad_prestada numeric, inicio_ciclo date,
      garantia_min numeric, base_ahorro numeric, fecha_pago date,
      falta_pago boolean, falta_ahorro boolean, tasa numeric,
      rend_10 numeric, rend_11 numeric, rend_12 numeric, rend_13 numeric,
      rend_14 numeric, rend_15 numeric, rend_16 numeric
    )
    where x.pago_id is not null
  ),
  escritas as (
    insert into aho_pagos as t (
      pago_id, key_grupo, grupo_id, ciclo, cliente_id, key_cliente, semana,
      pago, garantia, confirmada, usuario_captura,
      pago_semanal, cantidad_prestada, inicio_ciclo, garantia_min, base_ahorro, fecha_pago,
      falta_pago, falta_ahorro, tasa,
      rend_10, rend_11, rend_12, rend_13, rend_14, rend_15, rend_16,
      carga_id, actualizado_at
    )
    select
      pago_id, key_grupo, grupo_id, ciclo, cliente_id, key_cliente, semana,
      pago, garantia, confirmada, usuario_captura,
      pago_semanal, cantidad_prestada, inicio_ciclo, garantia_min, base_ahorro, fecha_pago,
      coalesce(falta_pago, false), coalesce(falta_ahorro, false), tasa,
      coalesce(rend_10, 0), coalesce(rend_11, 0), coalesce(rend_12, 0), coalesce(rend_13, 0),
      coalesce(rend_14, 0), coalesce(rend_15, 0), coalesce(rend_16, 0),
      p_carga, now()
    from entrada
    on conflict (pago_id) do update set
      key_grupo         = excluded.key_grupo,
      grupo_id          = excluded.grupo_id,
      ciclo             = excluded.ciclo,
      cliente_id        = excluded.cliente_id,
      key_cliente       = excluded.key_cliente,
      semana            = excluded.semana,
      pago              = excluded.pago,
      garantia          = excluded.garantia,
      confirmada        = excluded.confirmada,
      usuario_captura   = excluded.usuario_captura,
      pago_semanal      = excluded.pago_semanal,
      cantidad_prestada = excluded.cantidad_prestada,
      inicio_ciclo      = excluded.inicio_ciclo,
      garantia_min      = excluded.garantia_min,
      base_ahorro       = excluded.base_ahorro,
      fecha_pago        = excluded.fecha_pago,
      falta_pago        = excluded.falta_pago,
      falta_ahorro      = excluded.falta_ahorro,
      tasa              = excluded.tasa,
      rend_10           = excluded.rend_10,
      rend_11           = excluded.rend_11,
      rend_12           = excluded.rend_12,
      rend_13           = excluded.rend_13,
      rend_14           = excluded.rend_14,
      rend_15           = excluded.rend_15,
      rend_16           = excluded.rend_16,
      carga_id          = excluded.carga_id,
      actualizado_at    = excluded.actualizado_at
    -- Una fila idéntica no se reescribe. Así `carga_id` sigue apuntando a la
    -- carga que de verdad la cambió, y resubir el mismo archivo da 0 y 0.
    -- `numeric` compara por valor: 38.0 y 38.00 son la misma cifra.
    where (t.key_grupo, t.grupo_id, t.ciclo, t.cliente_id, t.key_cliente, t.semana,
           t.pago, t.garantia, t.confirmada, t.usuario_captura,
           t.pago_semanal, t.cantidad_prestada, t.inicio_ciclo, t.garantia_min,
           t.base_ahorro, t.fecha_pago, t.falta_pago, t.falta_ahorro, t.tasa,
           t.rend_10, t.rend_11, t.rend_12, t.rend_13, t.rend_14, t.rend_15, t.rend_16)
      is distinct from
          (excluded.key_grupo, excluded.grupo_id, excluded.ciclo, excluded.cliente_id,
           excluded.key_cliente, excluded.semana,
           excluded.pago, excluded.garantia, excluded.confirmada, excluded.usuario_captura,
           excluded.pago_semanal, excluded.cantidad_prestada, excluded.inicio_ciclo,
           excluded.garantia_min, excluded.base_ahorro, excluded.fecha_pago,
           excluded.falta_pago, excluded.falta_ahorro, excluded.tasa,
           excluded.rend_10, excluded.rend_11, excluded.rend_12, excluded.rend_13,
           excluded.rend_14, excluded.rend_15, excluded.rend_16)
    returning (t.xmax = 0) as nueva
  )
  select count(*) filter (where nueva), count(*) filter (where not nueva)
    into v_ins, v_upd
  from escritas;

  update aho_cargas
     set insertadas   = insertadas + v_ins,
         actualizadas = actualizadas + v_upd
   where id = p_carga;

  return json_build_object('insertadas', v_ins, 'actualizadas', v_upd);
end;
$$;

revoke all on function public.aho_cargar_lote(uuid, jsonb) from public, anon;
grant execute on function public.aho_cargar_lote(uuid, jsonb) to authenticated;

create or replace function public.aho_cerrar_carga(p_carga uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v record;
begin
  if not has_ahorros_carga() then
    raise exception 'Sin permiso para cargar ahorros' using errcode = '42501';
  end if;

  update aho_cargas
     set estado = 'completa', cerrada_at = now()
   where id = p_carga and estado = 'en_curso' and subido_por = auth.uid()
  returning id, filas_archivo, rechazadas, insertadas, actualizadas,
            coalesce(array_length(grupos, 1), 0) as grupos
  into v;

  if not found then
    raise exception 'La carga no existe o ya estaba cerrada';
  end if;

  return json_build_object(
    'id',           v.id,
    'filas',        v.filas_archivo,
    'rechazadas',   v.rechazadas,
    'insertadas',   v.insertadas,
    'actualizadas', v.actualizadas,
    'sin_cambio',   greatest(v.filas_archivo - v.insertadas - v.actualizadas, 0),
    'grupos',       v.grupos
  );
end;
$$;

revoke all on function public.aho_cerrar_carga(uuid) from public, anon;
grant execute on function public.aho_cerrar_carga(uuid) to authenticated;

-- ── Consulta por grupo + ciclo ───────────────────────────────────────────────
-- "Grupo 439 ciclo 1" → `000439_C01`. Los ceros a la izquierda se agregan aquí:
-- no generan ambigüedad (verificado contra el CSV, 2026-09-29).
--
-- Forma de la respuesta, pensada para sobrevivir al cambio de origen (regla 3):
--   { encontrado, motivo?, grupo_id, ciclo, key_grupo, ciclos[],
--     actualizado_at, carga{nombre_archivo, created_at}, sin_datos_credito,
--     resumen{clientes, prestado, base, ahorro, rend{"10".."16"}},
--     clientes[{cliente_id, cantidad_prestada, base_ahorro, pago_semanal,
--               inicio_ciclo, ahorro, pagado, semanas_con_ahorro, sin_credito,
--               rend{"10".."16"}, semanas[{semana, fecha_pago, pago, garantia,
--                                          confirmada, falta_ahorro}]}] }
--
-- Las sumas son las mismas que hace la plantilla de Felix (Σ garantías,
-- Σ rendimiento_hasta_pagoN). Ningún rendimiento se recalcula (regla 1).
create or replace function public.aho_buscar(
  p_grupo text,
  p_ciclo text
)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_grupo  text;
  v_ciclo  text;
  v_key    text;
  v_ciclos json;
  v_result json;
begin
  if not has_ahorros_access() then
    raise exception 'Sin acceso al visor de ahorros' using errcode = '42501';
  end if;

  v_grupo := regexp_replace(coalesce(p_grupo, ''), '\D', '', 'g');
  v_ciclo := regexp_replace(coalesce(p_ciclo, ''), '\D', '', 'g');

  if v_grupo = '' or length(v_grupo) > 6 then
    return json_build_object('encontrado', false, 'motivo', 'grupo_invalido');
  end if;
  v_grupo := lpad(v_grupo, 6, '0');

  select coalesce(json_agg(x.ciclo order by x.ciclo), '[]'::json) into v_ciclos
  from (select distinct ciclo from aho_pagos where grupo_id = v_grupo) x;

  if v_ciclo = '' or length(v_ciclo) > 3 then
    return json_build_object(
      'encontrado', false, 'motivo', 'falta_ciclo',
      'grupo_id', v_grupo, 'ciclos', v_ciclos
    );
  end if;
  v_ciclo := lpad((v_ciclo::int)::text, 2, '0');
  v_key   := v_grupo || '_C' || v_ciclo;

  if not exists (select 1 from aho_pagos where key_grupo = v_key) then
    return json_build_object(
      'encontrado', false, 'motivo', 'sin_datos',
      'grupo_id', v_grupo, 'ciclo', v_ciclo, 'key_grupo', v_key, 'ciclos', v_ciclos
    );
  end if;

  with p as (
    select * from aho_pagos where key_grupo = v_key
  ),
  cli as (
    select
      cliente_id,
      max(cantidad_prestada)                         as cantidad_prestada,
      max(base_ahorro)                               as base_ahorro,
      max(pago_semanal)                              as pago_semanal,
      max(inicio_ciclo)                              as inicio_ciclo,
      coalesce(sum(garantia), 0)                     as ahorro,
      coalesce(sum(pago), 0)                         as pagado,
      count(*) filter (where coalesce(garantia, 0) > 0) as semanas_con_ahorro,
      bool_and(falta_pago)                           as sin_credito,
      sum(rend_10) as r10, sum(rend_11) as r11, sum(rend_12) as r12, sum(rend_13) as r13,
      sum(rend_14) as r14, sum(rend_15) as r15, sum(rend_16) as r16,
      json_agg(json_build_object(
        'semana',       semana,
        'fecha_pago',   fecha_pago,
        'pago',         pago,
        'garantia',     garantia,
        'confirmada',   confirmada,
        'falta_ahorro', falta_ahorro
      ) order by semana)                             as semanas
    from p
    group by cliente_id
  )
  select json_build_object(
    'encontrado',        true,
    'grupo_id',          v_grupo,
    'ciclo',             v_ciclo,
    'key_grupo',         v_key,
    'ciclos',            v_ciclos,
    'actualizado_at',    (select max(actualizado_at) from p),
    'carga',             (select json_build_object('nombre_archivo', c.nombre_archivo,
                                                   'created_at', c.created_at)
                            from aho_cargas c
                           where c.id = (select carga_id from p
                                          order by actualizado_at desc limit 1)),
    'sin_datos_credito', (select bool_and(falta_pago) from p),
    'resumen',           (select json_build_object(
                            'clientes', count(*),
                            'prestado', sum(cantidad_prestada),
                            'base',     sum(base_ahorro),
                            'ahorro',   sum(ahorro),
                            'rend',     json_build_object(
                                          '10', sum(r10), '11', sum(r11), '12', sum(r12),
                                          '13', sum(r13), '14', sum(r14), '15', sum(r15),
                                          '16', sum(r16))
                          ) from cli),
    'clientes',          (select json_agg(json_build_object(
                            'cliente_id',         cliente_id,
                            'cantidad_prestada',  cantidad_prestada,
                            'base_ahorro',        base_ahorro,
                            'pago_semanal',       pago_semanal,
                            'inicio_ciclo',       inicio_ciclo,
                            'ahorro',             ahorro,
                            'pagado',             pagado,
                            'semanas_con_ahorro', semanas_con_ahorro,
                            'sin_credito',        sin_credito,
                            'rend',               json_build_object(
                                                    '10', r10, '11', r11, '12', r12, '13', r13,
                                                    '14', r14, '15', r15, '16', r16),
                            'semanas',            semanas
                          ) order by cliente_id) from cli)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.aho_buscar(text, text) to authenticated;

-- ── Uso ──────────────────────────────────────────────────────────────────────
create or replace function public.aho_registrar_evento(
  p_tipo      text,
  p_key_grupo text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not has_ahorros_access() then
    raise exception 'Sin acceso al visor de ahorros' using errcode = '42501';
  end if;
  if p_tipo not in ('consulta', 'descarga') then
    raise exception 'Tipo de evento inválido';
  end if;

  insert into aho_eventos (tipo, key_grupo, usuario)
  values (p_tipo, left(coalesce(p_key_grupo, ''), 20), auth.uid());
end;
$$;

revoke all on function public.aho_registrar_evento(text, text) from public, anon;
grant execute on function public.aho_registrar_evento(text, text) to authenticated;

-- ── Portada ──────────────────────────────────────────────────────────────────
-- Qué hay cargado, qué se actualizó al último y —solo para quien carga— cuánto
-- se usa. `uso` va en null para los asesores: es la métrica de Data Science.
create or replace function public.aho_resumen()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_carga boolean;
begin
  if not has_ahorros_access() then
    raise exception 'Sin acceso al visor de ahorros' using errcode = '42501';
  end if;

  v_carga := has_ahorros_carga();

  return json_build_object(
    'grupos',   (select count(distinct key_grupo)   from aho_pagos),
    'clientes', (select count(distinct key_cliente) from aho_pagos),
    'ultima_carga', (
      select json_build_object(
        'nombre_archivo', nombre_archivo,
        'created_at',     created_at,
        'estado',         estado,
        'grupos',         coalesce(array_length(grupos, 1), 0),
        'insertadas',     insertadas,
        'actualizadas',   actualizadas
      )
      from aho_cargas order by created_at desc limit 1
    ),
    'recientes', coalesce((
      select json_agg(r order by r.actualizado_at desc, r.key_grupo)
      from (
        select key_grupo, grupo_id, ciclo,
               count(distinct cliente_id) as clientes,
               max(actualizado_at)        as actualizado_at
        from aho_pagos
        group by key_grupo, grupo_id, ciclo
        order by max(actualizado_at) desc, key_grupo
        limit 12
      ) r
    ), '[]'::json),
    'uso', case when v_carga then (
      select json_build_object(
        'consultas_30d', count(*) filter (where tipo = 'consulta'),
        'descargas_30d', count(*) filter (where tipo = 'descarga'),
        'usuarios_30d',  count(distinct usuario)
      )
      from aho_eventos
      where created_at > now() - interval '30 days'
    ) end
  );
end;
$$;

grant execute on function public.aho_resumen() to authenticated;
