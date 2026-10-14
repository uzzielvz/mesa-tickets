-- AUD-004 — Cada promotor ve solo lo suyo (junta con Felix, 12 de octubre).
--
-- Ninguno de los dos archivos del Auditor trae al promotor. El cruce sale del
-- reporte de antigüedad grupal de Yunius ("AntigüedadGrupal_DDMMAA.xlsm", hoja
-- CARTERA): una fila por grupo, con su ciclo actual, su promotor y su gerente.
-- Se cruza por GRUPO, no por grupo y ciclo: el reporte trae solo el ciclo
-- actual y lo que sigue sin conciliar es reciente. En la foto del 12 de octubre
-- los 511 grupos del reporte de depósitos están en la antigüedad, y en los 12
-- pendientes el promotor coincide con el Recuperador del depósito.
--
-- El reporte trae nombres, no correos. `aud_personas` guarda de qué cuenta es
-- cada nombre. Al cargar se busca sola: el mismo nombre sin importar el orden,
-- los acentos ni los puntos, en perfiles, presets de alta y la base de
-- Vacaciones. Quien carga la corrige a mano cuando no la encuentra o cuando el
-- nombre viene escrito distinto ("Bentancourt" en la lista de altas).
--
-- Quién ve qué:
--   · admin, acceso_auditor o acceso_auditor_carga → toda la cartera.
--   · promotor → sus grupos; gerente → los grupos de su equipo. Sin bandera:
--     basta con que su correo esté asignado a un nombre del reporte vigente,
--     como en "Mis vacaciones".
-- Las tablas siguen cerradas a quien no ve todo: el promotor solo lee por
-- `aud_conciliacion`, que filtra adentro.

-- ── Cargas del reporte de antigüedad ─────────────────────────────────────────
-- Entra en una sola llamada (~520 grupos), así que nunca queda a medias: la
-- vigente es la de mayor secuencia.
create table if not exists aud_ant_cargas (
  id             uuid primary key default gen_random_uuid(),
  secuencia      bigint generated always as identity unique,
  nombre_archivo text not null,
  fecha_corte    date,
  grupos         int not null default 0,
  avisos         text[] not null default '{}',
  subido_por     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists idx_aud_ant_cargas_secuencia on aud_ant_cargas(secuencia desc);

create table if not exists aud_ant_grupos (
  carga_id       uuid not null references aud_ant_cargas(id) on delete cascade,
  grupo_id       text not null,   -- "ID de grupo" (6 dígitos con ceros)
  nombre_grupo   text,
  ciclo          text,            -- el ciclo actual del grupo
  estatus        text,            -- Vigente, Liquidado, Desertor…
  promotor       text,            -- "Nombre promotor", tal como viene
  promotor_clave text,            -- aud_clave(promotor)
  gerente        text,            -- "Nombre del gerente" (Yunius lo corta a 30 letras)
  gerente_clave  text,
  primary key (carga_id, grupo_id)
);

create index if not exists idx_aud_ant_grupos_promotor on aud_ant_grupos(carga_id, promotor_clave);
create index if not exists idx_aud_ant_grupos_gerente  on aud_ant_grupos(carga_id, gerente_clave);

-- ── De qué cuenta es cada nombre del reporte ─────────────────────────────────
-- Sobrevive a las cargas: lo que se asignó a mano no se pierde al subir el
-- reporte de la semana siguiente.
create table if not exists aud_personas (
  clave           text primary key,  -- aud_clave(nombre)
  nombre          text not null,     -- como viene en el último reporte
  email           text,              -- null = no se encontró cuenta
  origen          text not null default 'auto' check (origen in ('auto', 'manual')),
  actualizado_por uuid references auth.users(id),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_aud_personas_email on aud_personas(lower(email));

alter table aud_ant_cargas enable row level security;
alter table aud_ant_grupos enable row level security;
alter table aud_personas   enable row level security;
create policy "aud_ant_cargas_select" on aud_ant_cargas for select to authenticated using (has_auditor_access());
create policy "aud_ant_grupos_select" on aud_ant_grupos for select to authenticated using (has_auditor_access());
create policy "aud_personas_select"   on aud_personas   for select to authenticated using (has_auditor_carga());
-- Sin políticas de escritura: todo entra por las funciones de abajo.

-- ── Nombres ──────────────────────────────────────────────────────────────────
-- Las palabras de un nombre, en su orden, sin acentos ni signos:
-- "Juarez Palma Ma. Ines" → {juarez, palma, ma, ines}.
create or replace function public.aud_palabras(p text)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(array_remove(regexp_split_to_array(
    trim(regexp_replace(translate(lower(coalesce(p, '')), 'áéíóúüñàèìòùäëïö', 'aeiouunaeiouaeio'), '[^a-z]+', ' ', 'g')),
    ' '), ''), '{}')
$$;

-- La llave de una persona: sus palabras en orden alfabético. Así
-- "IRVIN URIEL MORA VELAZCO" (reporte) y "Mora Velazco Irvin Uriel" (alta)
-- son la misma.
create or replace function public.aud_clave(p text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(array_to_string(array(select w from unnest(public.aud_palabras(p)) as w order by w), ' '), '')
$$;

-- El correo de un nombre del reporte, o null si no hay exactamente una cuenta.
-- Busca en orden: perfiles (ya entró), presets de alta y la base de Vacaciones;
-- la primera fuente con un solo candidato gana. Dos candidatos en la misma
-- fuente no se adivinan: queda null y lo decide una persona.
-- Yunius corta los nombres a 30 caracteres ("JUDITH PATRICIA SERRANO HERRER"):
-- si viene cortado, la última palabra basta con que sea el principio de una.
create or replace function public.aud_buscar_correo(p_nombre text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_pal     text[]  := aud_palabras(p_nombre);
  v_clave   text    := aud_clave(p_nombre);
  v_cortado boolean := char_length(trim(coalesce(p_nombre, ''))) >= 30;
  v_resto   text[];
  v_ult     text;
  v_emails  text[];
  v_fuente  int;
begin
  if v_clave is null then
    return null;
  end if;
  v_resto := v_pal[1:cardinality(v_pal) - 1];
  v_ult   := v_pal[cardinality(v_pal)];

  for v_fuente in 1..3 loop
    select array_agg(distinct c.email) into v_emails
    from (
      select lower(p.email) as email, p.nombre_completo as nombre from profiles p where v_fuente = 1 and p.activo
      union all
      select lower(l.email), l.nombre_completo from login_presets l where v_fuente = 2
      union all
      select lower(e.email), e.nombre from vac_empleados e where v_fuente = 3 and e.activo and e.email is not null
    ) c
    where aud_clave(c.nombre) = v_clave
       or (v_cortado
           and cardinality(aud_palabras(c.nombre)) = cardinality(v_pal)
           and aud_palabras(c.nombre) @> v_resto
           and exists (select 1 from unnest(aud_palabras(c.nombre)) as w where w like v_ult || '%'));

    if cardinality(v_emails) = 1 then
      return v_emails[1];
    elsif cardinality(v_emails) > 1 then
      return null;
    end if;
  end loop;
  return null;
end;
$$;

-- ── Quién ve qué ─────────────────────────────────────────────────────────────
create or replace function public.aud_ant_vigente()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id from aud_ant_cargas order by secuencia desc limit 1
$$;

-- Los nombres del reporte asignados al correo de quien consulta.
create or replace function public.aud_mis_claves()
returns text[]
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(array_agg(a.clave), '{}')
  from aud_personas a
  join profiles p on p.id = auth.uid() and lower(p.email) = lower(a.email)
$$;

-- 'todo' (banderas o admin), 'gerente', 'promotor' o null (no entra). El papel
-- sale del reporte VIGENTE: quien ya no tiene grupos ahí deja de entrar.
create or replace function public.aud_mi_papel()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_claves text[];
  v_ger    boolean;
begin
  if has_auditor_access() then
    return 'todo';
  end if;
  v_claves := aud_mis_claves();
  if cardinality(v_claves) = 0 then
    return null;
  end if;
  select bool_or(coalesce(g.gerente_clave = any(v_claves), false)) into v_ger
  from aud_ant_grupos g
  where g.carga_id = aud_ant_vigente()
    and (g.promotor_clave = any(v_claves) or g.gerente_clave = any(v_claves));
  return case when v_ger then 'gerente' when not v_ger then 'promotor' end;
end;
$$;

revoke all on function public.aud_buscar_correo(text) from public, anon, authenticated;
revoke all on function public.aud_ant_vigente()       from public, anon, authenticated;
revoke all on function public.aud_mis_claves()        from public, anon, authenticated;
revoke all on function public.aud_mi_papel()          from public, anon;
grant execute on function public.aud_mi_papel() to authenticated;

-- ── Carga del reporte ────────────────────────────────────────────────────────
-- Forma de p_grupos: [{grupo_id, nombre_grupo, ciclo, estatus, promotor, gerente}]
-- (lib/auditor/antiguedad.ts). Devuelve el resumen y los nombres sin cuenta.
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

  -- Las cuentas automáticas se vuelven a buscar en cada carga (alguien pudo
  -- haber entrado desde la anterior); las asignadas a mano no se tocan.
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
      ), '[]'::json)
    )
    from aud_ant_grupos g where g.carga_id = v_id
  );
end;
$$;

-- Asignar a mano el correo de un nombre del reporte. Correo vacío = volver a
-- la búsqueda automática.
create or replace function public.aud_asignar_correo(p_clave text, p_email text)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  a       aud_personas%rowtype;
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ese correo no es válido';
  end if;

  update aud_personas p
     set email           = coalesce(v_email, aud_buscar_correo(p.nombre)),
         origen          = case when v_email is null then 'auto' else 'manual' end,
         actualizado_por = auth.uid(),
         updated_at      = now()
   where p.clave = p_clave
  returning * into a;
  if not found then
    raise exception 'Ese nombre no está en el reporte de antigüedad';
  end if;

  return json_build_object('clave', a.clave, 'email', a.email, 'origen', a.origen,
                           'entro', exists (select 1 from profiles where lower(email) = lower(a.email)));
end;
$$;

-- Para /auditor/cargar: las personas del reporte vigente con su cuenta, y los
-- candidatos para asignar a mano (perfiles, presets de alta y Vacaciones).
create or replace function public.aud_personas_vigentes()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ant uuid := aud_ant_vigente();
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;

  return json_build_object(
    'personas', coalesce((
      with g as (select * from aud_ant_grupos where carga_id = v_ant),
      per as (
        select promotor_clave as clave, 'promotor' as papel, count(*) as grupos
        from g where promotor_clave is not null group by promotor_clave
        union all
        select gerente_clave, 'gerente', count(*)
        from g where gerente_clave is not null group by gerente_clave
      )
      select json_agg(json_build_object(
               'clave', per.clave, 'nombre', a.nombre, 'papel', per.papel, 'grupos', per.grupos,
               'email', a.email, 'origen', a.origen,
               'entro', exists (select 1 from profiles p where lower(p.email) = lower(a.email))
             ) order by per.papel, a.nombre)
      from per join aud_personas a on a.clave = per.clave
    ), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object('email', c.email, 'nombre', c.nombre) order by c.nombre)
      from (
        select distinct on (lower(t.email)) lower(t.email) as email, t.nombre
        from (
          select email, nombre_completo as nombre, 1 as o from profiles
           where activo and nullif(trim(nombre_completo), '') is not null
          union all
          select email, nombre_completo, 2 from login_presets where nullif(trim(nombre_completo), '') is not null
          union all
          select email, nombre, 3 from vac_empleados where activo and email is not null
        ) t
        order by lower(t.email), t.o
      ) c
    ), '[]'::json)
  );
end;
$$;

revoke all on function public.aud_ant_cargar(text, date, jsonb, text[]) from public, anon;
revoke all on function public.aud_asignar_correo(text, text)           from public, anon;
revoke all on function public.aud_personas_vigentes()                  from public, anon;
grant execute on function public.aud_ant_cargar(text, date, jsonb, text[]) to authenticated;
grant execute on function public.aud_asignar_correo(text, text)           to authenticated;
grant execute on function public.aud_personas_vigentes()                  to authenticated;

-- ── La conciliación, con alcance ─────────────────────────────────────────────
-- Igual que en AUD-003, más:
--   · papel: 'todo' | 'gerente' | 'promotor'. Quien no ve todo solo recibe
--     los depósitos de sus grupos; los conteos son de ese alcance.
--   · p_promotor: filtra por un promotor (nombre o clave). Se cruza con el
--     alcance, así que no abre nada que no se viera ya.
--   · promotores[{clave, nombre, gerente, filas, depositos, monto, cuenta}]:
--     lo pendiente de cada promotor dentro del alcance, sin el filtro.
--     cuenta: 'activa' | 'sin_entrar' | 'sin_correo' (null para el promotor).
--   · sin_promotor: filas cuyo grupo no viene en el reporte de antigüedad.
--   · cada fila trae `promotor`.
-- El filtro de grupo sigue tocando solo `filas`.
drop function if exists public.aud_conciliacion(text);

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
    dep as (
      select d.grupo_id, d.ciclo, d.fecha_deposito,
             max(d.nombre_grupo)                                             as nombre_grupo,
             array_agg(distinct d.periodo order by d.periodo)
               filter (where d.periodo is not null)                         as semanas,
             sum(d.monto)                                                    as monto_depositado,
             count(*)                                                        as n_depositos,
             json_agg(json_build_object('fecha_deposito', d.fecha_deposito, 'monto', d.monto,
                                        'periodo', d.periodo) order by d.fila) as depositos
      from aud_depositos d
      where d.carga_id = v_dep and not d.conciliado
        and (v_mios is null or d.grupo_id = any(v_mios))
      group by d.grupo_id, d.ciclo, d.fecha_deposito
    ),
    reg as (
      select r.grupo_id, r.ciclo, r.fecha_deposito,
             sum(r.monto) as monto_registrado, count(*) as n_registros
      from aud_registros r
      where r.carga_id = v_reg
        and (r.grupo_id, r.ciclo, r.fecha_deposito) in (select grupo_id, ciclo, fecha_deposito from dep)
      group by r.grupo_id, r.ciclo, r.fecha_deposito
    ),
    alcance as (
      select dep.*,
             coalesce(reg.monto_registrado, 0) as monto_registrado,
             coalesce(reg.n_registros, 0)      as n_registros,
             case
               when reg.n_registros is null                       then 'sin_registro'
               when reg.monto_registrado <> dep.monto_depositado  then 'diferencia'
               when reg.n_registros > 1                           then 'un_registro'
               else 'listo'
             end                                                 as estado,
             dep.monto_depositado - coalesce(reg.monto_registrado, 0) as diferencia,
             ant.promotor, ant.promotor_clave, ant.gerente
      from dep
      left join reg using (grupo_id, ciclo, fecha_deposito)
      left join ant using (grupo_id)
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

revoke all on function public.aud_conciliacion(text, text) from public, anon;
grant execute on function public.aud_conciliacion(text, text) to authenticated;
