-- AUD-005 — Avisos del Auditor (pedido del 13 de octubre): cada que se carga
-- un reporte, cada promotor y cada gerente recibe lo que le falta por conciliar.
--
-- Usa el sistema de avisos de NTF-001 (campana + correo):
--   · Se avisa al cerrar una carga de depósitos, de registros o de antigüedad,
--     dentro de la misma transacción (`aud_avisar`). Si el aviso falla, la
--     carga no se pierde: el error vuelve en el acuse.
--   · Solo si los registros llegan al menos hasta el último día con depósitos.
--     Si los depósitos son más nuevos, todo lo reciente saldría "Sin registro"
--     por falta del archivo, no del promotor: no se avisa y se avisará cuando
--     entren los registros.
--   · Un aviso por persona y papel: el promotor, de sus grupos; el gerente, de
--     su equipo. Va al correo de `aud_personas`; sin correo no hay a quién.
--   · No se repite: si lo pendiente de esa persona es idéntico a su último
--     aviso (misma huella en `ref_id`), no se crea otro. Al crear uno nuevo, los
--     anteriores sin leer se marcan leídos porque ya no dicen la verdad; lo
--     mismo a quien ya no tiene pendientes.
--   · Correo solo si tiene algo que hacer (sin registro, diferencia o varios
--     registros). Si todo lo suyo está "listo para conciliar" le toca a
--     Tesorería: el aviso queda en la campana, sin correo.
--
-- De paso, el cálculo del estado sale a `aud_estado_vigente`, que comparten la
-- pantalla (`aud_conciliacion`) y los avisos: las dos dicen lo mismo siempre.

alter table notificaciones drop constraint if exists notificaciones_modulo_check;
alter table notificaciones add constraint notificaciones_modulo_check check (modulo in ('vacaciones', 'auditor'));

-- ── El estado de cada grupo, ciclo y día (AUD-003, sin cambios) ─────────────
create or replace function public.aud_estado_vigente()
returns table (
  grupo_id text, ciclo text, fecha_deposito date, nombre_grupo text, semanas smallint[],
  monto_depositado numeric, n_depositos bigint, depositos json,
  monto_registrado numeric, n_registros bigint, estado text, diferencia numeric
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with v as (
    select (select id from aud_dep_cargas where estado = 'completa' order by secuencia desc limit 1) as dep_id,
           (select id from aud_cargas order by secuencia desc limit 1)                              as reg_id
  ),
  dep as (
    select d.grupo_id, d.ciclo, d.fecha_deposito,
           max(d.nombre_grupo)                                             as nombre_grupo,
           array_agg(distinct d.periodo order by d.periodo)
             filter (where d.periodo is not null)                         as semanas,
           sum(d.monto)                                                    as monto_depositado,
           count(*)                                                        as n_depositos,
           json_agg(json_build_object('fecha_deposito', d.fecha_deposito, 'monto', d.monto,
                                      'periodo', d.periodo) order by d.fila) as depositos
    from aud_depositos d, v
    where d.carga_id = v.dep_id and not d.conciliado
    group by d.grupo_id, d.ciclo, d.fecha_deposito
  ),
  reg as (
    select r.grupo_id, r.ciclo, r.fecha_deposito,
           sum(r.monto) as monto_registrado, count(*) as n_registros
    from aud_registros r, v
    where r.carga_id = v.reg_id
      and (r.grupo_id, r.ciclo, r.fecha_deposito) in (select grupo_id, ciclo, fecha_deposito from dep)
    group by r.grupo_id, r.ciclo, r.fecha_deposito
  )
  select dep.grupo_id, dep.ciclo, dep.fecha_deposito, dep.nombre_grupo, dep.semanas,
         dep.monto_depositado, dep.n_depositos, dep.depositos,
         coalesce(reg.monto_registrado, 0), coalesce(reg.n_registros, 0),
         case
           when reg.n_registros is null                       then 'sin_registro'
           when reg.monto_registrado <> dep.monto_depositado  then 'diferencia'
           when reg.n_registros > 1                           then 'un_registro'
           else 'listo'
         end,
         dep.monto_depositado - coalesce(reg.monto_registrado, 0)
  from dep
  left join reg using (grupo_id, ciclo, fecha_deposito)
$$;

revoke all on function public.aud_estado_vigente() from public, anon, authenticated;

-- ── La conciliación (AUD-004), ahora sobre `aud_estado_vigente` ──────────────
create or replace function public.aud_conciliacion(p_grupo text default null, p_promotor text default null)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_papel  text := aud_mi_papel();
  v_ant    uuid := aud_ant_vigente();
  v_prom   text := aud_clave(p_promotor);
  v_claves text[];
  v_mios   text[];   -- null = toda la cartera
  v_dep    uuid;
  v_reg    uuid;
  v_grupo  text;
begin
  if v_papel is null then
    raise exception 'Sin acceso al auditor' using errcode = '42501';
  end if;
  if v_papel <> 'todo' then
    v_claves := aud_mis_claves();
    v_mios := array(
      select g.grupo_id from aud_ant_grupos g
      where g.carga_id = v_ant and (g.promotor_clave = any(v_claves) or g.gerente_clave = any(v_claves))
    );
  end if;

  select id into v_dep from aud_dep_cargas where estado = 'completa' order by secuencia desc limit 1;
  select id into v_reg from aud_cargas order by secuencia desc limit 1;

  v_grupo := nullif(regexp_replace(coalesce(p_grupo, ''), '\D', '', 'g'), '');
  if v_grupo is not null then v_grupo := lpad(v_grupo, 6, '0'); end if;

  return (
    with ant as (
      select g.grupo_id, g.promotor, g.promotor_clave, g.gerente
      from aud_ant_grupos g
      where g.carga_id = v_ant
    ),
    alcance as (
      select x.*, ant.promotor, ant.promotor_clave, ant.gerente
      from aud_estado_vigente() x
      left join ant using (grupo_id)
      where v_mios is null or x.grupo_id = any(v_mios)
    ),
    j as (
      select * from alcance where v_prom is null or promotor_clave = v_prom
    )
    select json_build_object(
      'papel', v_papel,
      'dep_carga', (select json_build_object('id', c.id, 'nombre_archivo', c.nombre_archivo,
                      'created_at', c.created_at, 'fecha_min', c.fecha_min, 'fecha_max', c.fecha_max)
                    from aud_dep_cargas c where c.id = v_dep),
      'reg_carga', (select json_build_object('id', c.id, 'nombre_archivo', c.nombre_archivo,
                      'created_at', c.created_at, 'fecha_min', c.fecha_min, 'fecha_max', c.fecha_max)
                    from aud_cargas c where c.id = v_reg),
      'ant_carga', (select json_build_object('id', c.id, 'nombre_archivo', c.nombre_archivo,
                      'created_at', c.created_at, 'fecha_corte', c.fecha_corte)
                    from aud_ant_cargas c where c.id = v_ant),
      'promotor', case when v_prom is null then null else json_build_object(
                    'clave', v_prom,
                    'nombre', coalesce((select max(promotor) from ant where promotor_clave = v_prom), p_promotor)
                  ) end,
      'depositos_no_conciliados', coalesce((select sum(n_depositos) from j), 0),
      'monto_no_conciliado',      coalesce((select sum(monto_depositado) from j), 0),
      'conteo', json_build_object(
        'listo',        (select count(*) from j where estado = 'listo'),
        'sin_registro', (select count(*) from j where estado = 'sin_registro'),
        'diferencia',   (select count(*) from j where estado = 'diferencia'),
        'un_registro',  (select count(*) from j where estado = 'un_registro')
      ),
      'promotores', coalesce((
        select json_agg(json_build_object(
                 'clave', x.promotor_clave, 'nombre', x.promotor, 'gerente', x.gerente,
                 'filas', x.filas, 'depositos', x.depositos, 'monto', x.monto, 'cuenta', x.cuenta
               ) order by x.monto desc, x.promotor)
        from (
          select a.promotor_clave, max(a.promotor) as promotor, max(a.gerente) as gerente,
                 count(*) as filas, sum(a.n_depositos) as depositos, sum(a.monto_depositado) as monto,
                 case
                   when v_papel = 'promotor' then null
                   when p.email is null then 'sin_correo'
                   when exists (select 1 from profiles pr where lower(pr.email) = lower(p.email)) then 'activa'
                   else 'sin_entrar'
                 end as cuenta
          from alcance a
          left join aud_personas p on p.clave = a.promotor_clave
          where a.promotor_clave is not null
          group by a.promotor_clave, p.email
        ) x
      ), '[]'::json),
      'sin_promotor', (select count(*) from alcance where promotor_clave is null),
      'filas', coalesce((
        select json_agg(json_build_object(
                 'grupo_id', grupo_id, 'nombre_grupo', nombre_grupo, 'ciclo', ciclo,
                 'fecha_deposito', fecha_deposito, 'semanas', coalesce(to_json(semanas), '[]'::json),
                 'monto_depositado', monto_depositado, 'n_depositos', n_depositos,
                 'monto_registrado', monto_registrado, 'n_registros', n_registros,
                 'estado', estado, 'diferencia', diferencia, 'depositos', depositos,
                 'promotor', promotor
               ) order by fecha_deposito, grupo_id, ciclo)
        from j
        where v_grupo is null or grupo_id = v_grupo
      ), '[]'::json)
    )
  );
end;
$$;

-- ── Textos ───────────────────────────────────────────────────────────────────
-- "$6,435" o "$53,722.95": decimales solo cuando el monto los trae (como `pesos`).
create or replace function public.aud_pesos(p numeric)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select '$' || case when p = trunc(p) then to_char(p, 'FM999,999,999,990')
                     else to_char(p, 'FM999,999,999,990.00') end
$$;

-- {a, b, c} → "a, b y c".
create or replace function public.aud_enlistar(p text[])
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when coalesce(cardinality(p), 0) = 0 then null
    when cardinality(p) = 1 then p[1]
    else array_to_string(p[1:cardinality(p) - 1], ', ') || ' y ' || p[cardinality(p)]
  end
$$;

-- ── Los avisos ───────────────────────────────────────────────────────────────
-- Devuelve {avisados, sin_cambios, sin_correo, motivo}. motivo:
--   null · 'faltan_archivos' · 'registros_atrasados' (con registros_hasta y
--   depositos_hasta) · 'error' (con detalle).
create or replace function public.aud_avisar()
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dep     aud_dep_cargas%rowtype;
  v_reg     aud_cargas%rowtype;
  v_ant     uuid := aud_ant_vigente();
  v_creados int := 0;
  v_iguales int := 0;
  v_sin     int := 0;
  v_activos text[] := '{}';   -- correo|tipo de quien sigue con pendientes
  v_tipo    text;
  v_ultima  uuid;
  v_accion  int;
  v_partes  text[];
  v_detalle text;
  v_titulo  text;
  v_cuerpo  text;
  p         record;
begin
  select * into v_dep from aud_dep_cargas where estado = 'completa' order by secuencia desc limit 1;
  select * into v_reg from aud_cargas order by secuencia desc limit 1;
  if v_dep.id is null or v_reg.id is null or v_ant is null then
    return json_build_object('avisados', 0, 'motivo', 'faltan_archivos');
  end if;
  if v_reg.fecha_max < v_dep.fecha_max then
    return json_build_object('avisados', 0, 'motivo', 'registros_atrasados',
                             'registros_hasta', v_reg.fecha_max, 'depositos_hasta', v_dep.fecha_max);
  end if;

  for p in
    with e as (
      select x.*, g.promotor_clave, g.gerente_clave
      from aud_estado_vigente() x
      join aud_ant_grupos g on g.carga_id = v_ant and g.grupo_id = x.grupo_id
    ),
    pp as (
      select 'promotor' as papel, e.promotor_clave as clave, e.* from e where e.promotor_clave is not null
      union all
      select 'gerente', e.gerente_clave, e.* from e where e.gerente_clave is not null
    )
    select pp.papel, pp.clave, lower(a.email) as email,
           sum(pp.n_depositos)::int                                 as depositos,
           sum(pp.monto_depositado)                                 as monto,
           (count(*) filter (where pp.estado = 'sin_registro'))::int as sin_registro,
           (count(*) filter (where pp.estado = 'diferencia'))::int   as diferencia,
           (count(*) filter (where pp.estado = 'un_registro'))::int  as un_registro,
           (count(*) filter (where pp.estado = 'listo'))::int        as listo,
           md5(string_agg(concat_ws('|', pp.grupo_id, pp.ciclo, pp.fecha_deposito, pp.estado,
                                    pp.monto_depositado, pp.monto_registrado),
                          ',' order by pp.grupo_id, pp.ciclo, pp.fecha_deposito))::uuid as huella
    from pp
    left join aud_personas a on a.clave = pp.clave
    group by pp.papel, pp.clave, a.email
  loop
    if p.email is null then
      v_sin := v_sin + 1;
      continue;
    end if;
    v_tipo := case p.papel when 'promotor' then 'aud_pendientes' else 'aud_equipo' end;
    v_activos := v_activos || (p.email || '|' || v_tipo);

    select n.ref_id into v_ultima
    from notificaciones n
    where n.para_email = p.email and n.modulo = 'auditor' and n.tipo = v_tipo
    order by n.created_at desc
    limit 1;
    if v_ultima = p.huella then
      v_iguales := v_iguales + 1;
      continue;
    end if;

    update notificaciones set leida_at = now()
     where para_email = p.email and modulo = 'auditor' and tipo = v_tipo and leida_at is null;

    v_accion := p.sin_registro + p.diferencia + p.un_registro;
    v_partes := array_remove(array[
      case when p.sin_registro > 0 then p.sin_registro || ' sin registro' end,
      case when p.diferencia  > 0 then p.diferencia  || ' con diferencia de monto' end,
      case when p.un_registro > 0 then p.un_registro || ' que deben ser un solo registro' end
    ], null);

    v_detalle := null;
    if p.papel = 'gerente' then
      select string_agg(s.promotor || ': ' || s.n || ' (' || aud_pesos(s.monto) || ')', '; ' order by s.monto desc)
        into v_detalle
      from (
        select coalesce(g.promotor, 'sin promotor') as promotor, sum(x.n_depositos) as n, sum(x.monto_depositado) as monto
        from aud_estado_vigente() x
        join aud_ant_grupos g on g.carga_id = v_ant and g.grupo_id = x.grupo_id
        where g.gerente_clave = p.clave
        group by g.promotor
      ) s;
    end if;

    v_titulo := format('%s %s %s sin conciliar (%s)',
                       case p.papel when 'promotor' then 'Tienes' else 'Tu equipo tiene' end,
                       p.depositos, case when p.depositos = 1 then 'depósito' else 'depósitos' end,
                       aud_pesos(p.monto));
    v_cuerpo := concat_ws(' ',
      case when v_accion > 0 then 'Por corregir: ' || aud_enlistar(v_partes) || '.' end,
      case when p.listo > 0 then p.listo || case when p.listo = 1 then ' está listo' else ' están listos' end
                                 || ' para conciliar: eso ya le toca a Tesorería.' end,
      case when v_detalle is not null then 'Por promotor: ' || v_detalle || '.' end
    );

    perform ntf_crear(p.email, 'auditor', v_tipo, v_titulo, v_cuerpo, '/auditor', p.huella, v_accion > 0);
    v_creados := v_creados + 1;
  end loop;

  -- A quien ya no tiene pendientes, su último aviso ya no dice la verdad.
  update notificaciones set leida_at = now()
   where modulo = 'auditor' and leida_at is null
     and (para_email || '|' || tipo) <> all (v_activos);

  return json_build_object('avisados', v_creados, 'sin_cambios', v_iguales, 'sin_correo', v_sin, 'motivo', null);
exception when others then
  return json_build_object('avisados', 0, 'motivo', 'error', 'detalle', sqlerrm);
end;
$$;

revoke all on function public.aud_pesos(numeric)   from public, anon, authenticated;
revoke all on function public.aud_enlistar(text[]) from public, anon, authenticated;
revoke all on function public.aud_avisar()         from public, anon, authenticated;

-- ── Las tres cargas avisan al terminar ───────────────────────────────────────
-- Igual que en AUD-002, AUD-003 y AUD-004, más `notificaciones` en el acuse.

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
    'fecha_max', v_res.fecha_max,
    'notificaciones', aud_avisar()
  );
end;
$$;

create or replace function public.aud_dep_cerrar_carga(p_carga uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  c   aud_dep_cargas%rowtype;
  v   record;
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;
  select * into c from aud_dep_cargas where id = p_carga and subido_por = auth.uid() for update;
  if not found or c.estado <> 'en_curso' then
    raise exception 'La carga no existe o ya estaba cerrada';
  end if;
  if c.insertadas <> c.filas_archivo then
    raise exception 'La carga está incompleta: entraron % de % filas. Súbela de nuevo.', c.insertadas, c.filas_archivo;
  end if;

  select count(*) filter (where not conciliado) as no_conciliados,
         min(fecha_deposito) as fecha_min, max(fecha_deposito) as fecha_max
    into v
  from aud_depositos where carga_id = p_carga;

  update aud_dep_cargas
     set estado = 'completa', cerrada_at = now(),
         no_conciliados = v.no_conciliados, fecha_min = v.fecha_min, fecha_max = v.fecha_max
   where id = p_carga;

  return json_build_object('filas', c.insertadas, 'rechazadas', c.rechazadas,
                           'no_conciliados', v.no_conciliados,
                           'fecha_min', v.fecha_min, 'fecha_max', v.fecha_max,
                           'notificaciones', aud_avisar());
end;
$$;

create or replace function public.aud_ant_cargar(
  p_nombre text, p_fecha_corte date, p_grupos jsonb, p_avisos text[]
)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
  v_n  int;
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;
  if p_grupos is null or jsonb_typeof(p_grupos) <> 'array'
     or jsonb_array_length(p_grupos) = 0 or jsonb_array_length(p_grupos) > 5000 then
    raise exception 'Lista de grupos inválida (de 1 a 5,000)';
  end if;

  insert into aud_ant_cargas (nombre_archivo, fecha_corte, avisos, subido_por)
  values (left(coalesce(nullif(trim(p_nombre), ''), 'sin nombre'), 255), p_fecha_corte,
          coalesce(p_avisos[1:30], '{}'), auth.uid())
  returning id into v_id;

  insert into aud_ant_grupos (carga_id, grupo_id, nombre_grupo, ciclo, estatus,
                              promotor, promotor_clave, gerente, gerente_clave)
  select v_id, x.grupo_id, nullif(trim(x.nombre_grupo), ''), nullif(trim(x.ciclo), ''),
         nullif(trim(x.estatus), ''),
         nullif(trim(x.promotor), ''), aud_clave(x.promotor),
         nullif(trim(x.gerente), ''),  aud_clave(x.gerente)
  from jsonb_to_recordset(p_grupos) as x(
    grupo_id text, nombre_grupo text, ciclo text, estatus text, promotor text, gerente text
  )
  where x.grupo_id ~ '^\d{6}$';
  get diagnostics v_n = row_count;
  update aud_ant_cargas set grupos = v_n where id = v_id;

  insert into aud_personas as a (clave, nombre, email, origen)
  select t.clave, t.nombre, aud_buscar_correo(t.nombre), 'auto'
  from (
    select distinct on (clave) clave, nombre
    from (
      select promotor_clave as clave, promotor as nombre from aud_ant_grupos where carga_id = v_id and promotor_clave is not null
      union all
      select gerente_clave, gerente from aud_ant_grupos where carga_id = v_id and gerente_clave is not null
    ) s
    order by clave, char_length(nombre) desc
  ) t
  on conflict (clave) do update set
    nombre     = excluded.nombre,
    email      = case when a.origen = 'manual' then a.email else excluded.email end,
    updated_at = case when a.origen = 'manual' then a.updated_at else now() end;

  return (
    select json_build_object(
      'grupos',     v_n,
      'promotores', count(distinct g.promotor_clave),
      'gerentes',   count(distinct g.gerente_clave),
      'sin_correo', coalesce((
        select json_agg(a.nombre order by a.nombre)
        from aud_personas a
        where a.email is null
          and a.clave in (select promotor_clave from aud_ant_grupos where carga_id = v_id
                          union select gerente_clave from aud_ant_grupos where carga_id = v_id)
      ), '[]'::json),
      'notificaciones', aud_avisar()
    )
    from aud_ant_grupos g where g.carga_id = v_id
  );
end;
$$;
