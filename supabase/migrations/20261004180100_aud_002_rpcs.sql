-- AUD-002 — RPCs del Auditor de depósitos.
--
-- Convención de inv_005 / aho_003 / vac_003: security definer con la
-- autorización validada a mano, returns json, estructura coherente sin datos.
-- Estos RPCs son también el lugar donde entran las consultas que escriba
-- Charly: la pantalla lee de aquí, no de las tablas.

-- ── Carga ────────────────────────────────────────────────────────────────────
-- Atómica: la foto entra completa o no entra. Los totales se calculan aquí,
-- desde lo que se insertó, para que el acuse no dependa del navegador.
create or replace function public.aud_cargar(
  p_nombre text,
  p_filas  jsonb,
  p_avisos text[]
)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id  uuid;
  v_res record;
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no trae registros';
  end if;
  if jsonb_array_length(p_filas) > 50000 then
    raise exception 'Demasiados registros para una carga (máximo 50,000)';
  end if;

  insert into aud_cargas (nombre_archivo, avisos, subido_por)
  values (left(coalesce(nullif(trim(p_nombre), ''), 'sin nombre'), 255), coalesce(p_avisos[1:30], '{}'), auth.uid())
  returning id into v_id;

  insert into aud_registros (carga_id, fila, conciliado, ciclo, grupo_id, periodo, nombre_grupo, fecha_deposito, monto, promotor)
  select v_id, x.fila, x.conciliado, x.ciclo, x.grupo_id, x.periodo, x.nombre_grupo, x.fecha_deposito, x.monto,
         nullif(lower(trim(x.promotor)), '')
  from jsonb_to_recordset(p_filas) as x(
    fila int, conciliado boolean, ciclo text, grupo_id text, periodo smallint,
    nombre_grupo text, fecha_deposito date, monto numeric, promotor text
  );

  select count(*)                                          as registros,
         count(*) filter (where not conciliado)            as sin_conciliar,
         coalesce(sum(monto) filter (where not conciliado), 0) as monto_sin_conciliar,
         min(fecha_deposito)                               as fecha_min,
         max(fecha_deposito)                               as fecha_max
    into v_res
  from aud_registros where carga_id = v_id;

  update aud_cargas
     set registros = v_res.registros,
         sin_conciliar = v_res.sin_conciliar,
         monto_sin_conciliar = v_res.monto_sin_conciliar,
         fecha_min = v_res.fecha_min,
         fecha_max = v_res.fecha_max
   where id = v_id;

  return json_build_object(
    'id', v_id,
    'registros', v_res.registros,
    'sin_conciliar', v_res.sin_conciliar,
    'monto_sin_conciliar', v_res.monto_sin_conciliar,
    'fecha_min', v_res.fecha_min,
    'fecha_max', v_res.fecha_max
  );
end;
$$;

revoke all on function public.aud_cargar(text, jsonb, text[]) from public, anon;
grant execute on function public.aud_cargar(text, jsonb, text[]) to authenticated;

-- ── Lo que hay que conciliar ─────────────────────────────────────────────────
-- Siempre sobre la carga vigente (la última). Con `p_grupo` filtra un grupo
-- (acepta "13" o "000013").
--
-- Forma: { carga{id, nombre_archivo, created_at, fecha_min, fecha_max} | null,
--          registros, sin_conciliar, monto_sin_conciliar, grupos_pendientes,
--          con_promotor, pendientes[{grupo_id, nombre_grupo, ciclo, periodo,
--                       fecha_deposito, monto, promotor}],
--          resueltos_desde_anterior }
--
-- `resueltos_desde_anterior`: depósitos que pasaron de sin conciliar a
-- conciliados entre la carga anterior y esta. Es la señal de que el aviso a los
-- promotores sirve. El archivo no trae un id de depósito, así que se cuenta por
-- llave (grupo, ciclo, periodo, fecha, monto): en cada llave, lo que bajó de N
-- y a la vez subió de C. Así no cuenta un depósito que solo dejó de venir en el
-- archivo (otro rango de fechas), ni se confunde con un gemelo ya conciliado.
create or replace function public.aud_pendientes(p_grupo text default null)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_carga    uuid;
  v_anterior uuid;
  v_grupo    text;
begin
  if not has_auditor_access() then
    raise exception 'Sin acceso al auditor' using errcode = '42501';
  end if;

  select id into v_carga from aud_cargas order by secuencia desc limit 1;
  if v_carga is null then
    return json_build_object('carga', null, 'registros', 0, 'sin_conciliar', 0,
                             'monto_sin_conciliar', 0, 'grupos_pendientes', 0,
                             'con_promotor', 0, 'pendientes', '[]'::json,
                             'resueltos_desde_anterior', 0);
  end if;
  select id into v_anterior from aud_cargas where id <> v_carga order by secuencia desc limit 1;

  v_grupo := nullif(regexp_replace(coalesce(p_grupo, ''), '\D', '', 'g'), '');
  if v_grupo is not null then v_grupo := lpad(v_grupo, 6, '0'); end if;

  return (
    select json_build_object(
      'carga', (select json_build_object('id', c.id, 'nombre_archivo', c.nombre_archivo,
                                         'created_at', c.created_at, 'fecha_min', c.fecha_min,
                                         'fecha_max', c.fecha_max)
                  from aud_cargas c where c.id = v_carga),
      'registros',           count(*),
      'sin_conciliar',       count(*) filter (where not r.conciliado),
      'monto_sin_conciliar', coalesce(sum(r.monto) filter (where not r.conciliado), 0),
      'grupos_pendientes',   count(distinct r.grupo_id) filter (where not r.conciliado),
      'con_promotor',        count(*) filter (where r.promotor is not null),
      'pendientes', coalesce((
        select json_agg(json_build_object(
                 'grupo_id', p.grupo_id, 'nombre_grupo', p.nombre_grupo, 'ciclo', p.ciclo,
                 'periodo', p.periodo, 'fecha_deposito', p.fecha_deposito, 'monto', p.monto,
                 'promotor', p.promotor
               ) order by p.fecha_deposito, p.grupo_id)
        from aud_registros p
        where p.carga_id = v_carga and not p.conciliado
          and (v_grupo is null or p.grupo_id = v_grupo)
      ), '[]'::json),
      'resueltos_desde_anterior', case when v_anterior is null then 0 else (
        select coalesce(sum(least(
                 greatest(coalesce(a.n, 0) - coalesce(b.n, 0), 0),
                 greatest(coalesce(b.c, 0) - coalesce(a.c, 0), 0)
               )), 0)
        from (
          select grupo_id, ciclo, coalesce(periodo, -1) as periodo, fecha_deposito, monto,
                 count(*) filter (where not conciliado) as n,
                 count(*) filter (where conciliado)     as c
          from aud_registros where carga_id = v_anterior
          group by 1, 2, 3, 4, 5
        ) a
        full join (
          select grupo_id, ciclo, coalesce(periodo, -1) as periodo, fecha_deposito, monto,
                 count(*) filter (where not conciliado) as n,
                 count(*) filter (where conciliado)     as c
          from aud_registros where carga_id = v_carga
          group by 1, 2, 3, 4, 5
        ) b using (grupo_id, ciclo, periodo, fecha_deposito, monto)
      ) end
    )
    from aud_registros r
    where r.carga_id = v_carga
  );
end;
$$;

grant execute on function public.aud_pendientes(text) to authenticated;
