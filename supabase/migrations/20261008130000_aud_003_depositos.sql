-- AUD-003 — El Auditor parte de los DEPÓSITOS del banco (pedido de Felix, 8 de octubre).
--
-- Antes la lista salía de `aud_registros` con CONCILIADO = N (lo que el
-- promotor registró). Felix pidió que la base sean los depósitos: el reporte de
-- depósitos de Yunius ("Grup_Depósito_Garantía"), donde la columna Conciliado
-- dice "Distribuido" (conciliado) o "No Conciliado" (pendiente). Ese estado
-- manda; el C/N del archivo de registros ya no.
--
-- La comparación, en sus palabras: "un join en código, ciclo, fecha".
--   1. Depósitos No Conciliado de la carga vigente, agrupados por grupo, ciclo
--      y fecha: monto depositado y cuántos depósitos.
--   2. LEFT JOIN, por esa llave EXACTA, contra TODOS los registros (C y N) de
--      la carga vigente de registros, agrupados igual.
--   3. Estado, en este orden: sin registro → diferencia de montos → debe ser
--      un solo registro → listo para conciliar ("si está igual y no conciliado
--      es porque Tesorería no le ha picado el botón").
-- La fecha es exacta a propósito: un depósito del 2 de octubre registrado el 1
-- sale "Sin registro" (caso MS 000265, para revisarlo con Felix).
--
-- El reporte pesa más de 4.5 MB (límite de una función de Vercel): se lee en
-- el navegador y entra por lotes, como Ahorros.

-- ── Cargas de depósitos ──────────────────────────────────────────────────────
-- Separadas de `aud_cargas` (registros): son otra fuente con otra forma de
-- carga. Cada una es una foto completa; la vigente es la COMPLETA de mayor
-- secuencia, para que una carga que se cortó a medias no se vuelva la vigente.
create table if not exists aud_dep_cargas (
  id              uuid primary key default gen_random_uuid(),
  secuencia       bigint generated always as identity unique,
  nombre_archivo  text not null,
  filas_archivo   int not null default 0,
  rechazadas      int not null default 0,
  insertadas      int not null default 0,
  no_conciliados  int not null default 0,
  fecha_min       date,
  fecha_max       date,
  avisos          text[] not null default '{}',
  estado          text not null default 'en_curso' check (estado in ('en_curso', 'completa')),
  subido_por      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  cerrada_at      timestamptz
);

create index if not exists idx_aud_dep_cargas_vigente on aud_dep_cargas(estado, secuencia desc);

-- Un movimiento del reporte de depósitos. Se guardan TODAS las filas, no solo
-- las No Conciliado: la foto completa permite compararla con la siguiente.
create table if not exists aud_depositos (
  id               bigint generated always as identity primary key,
  carga_id         uuid not null references aud_dep_cargas(id) on delete cascade,
  fila             int not null,
  fecha_deposito   date not null,     -- "Fecha del depósito"
  grupo_id         text not null,     -- "Código" (6 dígitos con ceros)
  nombre_grupo     text,              -- "Grupo solidario "
  ciclo            text not null,     -- "Ciclo" ('04')
  periodo          smallint,          -- "Periodo" (semana)
  monto            numeric not null,  -- "Cantidad"
  conciliado       boolean not null,  -- false solo si "Conciliado" = "No Conciliado"
  estatus          text not null,     -- "Conciliado" tal como viene
  cod_recuperador  text,              -- "Cód. Recuperador"
  recuperador      text               -- "Recuperador" (no se muestra; para la vista por promotor)
);

create index if not exists idx_aud_dep_carga_pend on aud_depositos(carga_id, conciliado);
create index if not exists idx_aud_dep_llave on aud_depositos(carga_id, grupo_id, ciclo, fecha_deposito);
create index if not exists idx_aud_reg_llave on aud_registros(carga_id, grupo_id, ciclo, fecha_deposito);

alter table aud_dep_cargas enable row level security;
alter table aud_depositos  enable row level security;
create policy "aud_dep_cargas_select" on aud_dep_cargas for select to authenticated using (has_auditor_access());
create policy "aud_depositos_select"  on aud_depositos  for select to authenticated using (has_auditor_access());
-- Sin políticas de escritura: todo entra por las funciones de abajo.

-- ── Carga por lotes: iniciar → lote × N → cerrar ────────────────────────────
create or replace function public.aud_dep_iniciar_carga(
  p_nombre text, p_filas int, p_rechazadas int, p_avisos text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;
  insert into aud_dep_cargas (nombre_archivo, filas_archivo, rechazadas, avisos, subido_por)
  values (left(coalesce(nullif(trim(p_nombre), ''), 'sin nombre'), 255),
          greatest(coalesce(p_filas, 0), 0), greatest(coalesce(p_rechazadas, 0), 0),
          coalesce(p_avisos[1:30], '{}'), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.aud_dep_cargar_lote(p_carga uuid, p_filas jsonb)
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_estado text;
  v_dueno  uuid;
  v_n      int;
begin
  if not has_auditor_carga() then
    raise exception 'Sin permiso para cargar el auditor' using errcode = '42501';
  end if;
  select estado, subido_por into v_estado, v_dueno from aud_dep_cargas where id = p_carga for update;
  if not found then
    raise exception 'La carga no existe';
  end if;
  if v_estado <> 'en_curso' then
    raise exception 'La carga ya se cerró; sube el archivo de nuevo';
  end if;
  if v_dueno is distinct from auth.uid() then
    raise exception 'La carga la inició otra persona' using errcode = '42501';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 5000 then
    raise exception 'Lote inválido (máximo 5,000 filas)';
  end if;

  insert into aud_depositos (carga_id, fila, fecha_deposito, grupo_id, nombre_grupo, ciclo, periodo,
                             monto, conciliado, estatus, cod_recuperador, recuperador)
  select p_carga, x.fila, x.fecha_deposito, x.grupo_id, x.nombre_grupo, x.ciclo, x.periodo,
         x.monto, x.conciliado, x.estatus, x.cod_recuperador, x.recuperador
  from jsonb_to_recordset(p_filas) as x(
    fila int, fecha_deposito date, grupo_id text, nombre_grupo text, ciclo text, periodo smallint,
    monto numeric, conciliado boolean, estatus text, cod_recuperador text, recuperador text
  );
  get diagnostics v_n = row_count;

  update aud_dep_cargas set insertadas = insertadas + v_n where id = p_carga;
  return json_build_object('insertadas', v_n);
end;
$$;

-- Cierra solo si entró todo lo que el navegador dijo que iba a mandar: una
-- foto a medias no puede volverse la vigente.
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
                           'fecha_min', v.fecha_min, 'fecha_max', v.fecha_max);
end;
$$;

revoke all on function public.aud_dep_iniciar_carga(text, int, int, text[]) from public, anon;
revoke all on function public.aud_dep_cargar_lote(uuid, jsonb) from public, anon;
revoke all on function public.aud_dep_cerrar_carga(uuid) from public, anon;
grant execute on function public.aud_dep_iniciar_carga(text, int, int, text[]) to authenticated;
grant execute on function public.aud_dep_cargar_lote(uuid, jsonb) to authenticated;
grant execute on function public.aud_dep_cerrar_carga(uuid) to authenticated;

-- ── La conciliación ──────────────────────────────────────────────────────────
-- Forma:
--   { dep_carga{…} | null, reg_carga{…} | null,
--     depositos_no_conciliados, monto_no_conciliado,
--     conteo{listo, sin_registro, diferencia, un_registro},   ← siempre de toda la cartera
--     filas[{grupo_id, nombre_grupo, ciclo, fecha_deposito, semanas[],
--            monto_depositado, n_depositos, monto_registrado, n_registros,
--            estado: 'sin_registro'|'diferencia'|'un_registro'|'listo',
--            diferencia (depositado − registrado),
--            depositos[{fecha_deposito, monto, periodo}]}] }  ← con el filtro de grupo
-- La leyenda en palabras ("Registró $X de más", "Faltan $X por registrar") la
-- arma la pantalla con `leyendaEstado` (lib/auditor/tipos.ts).
create or replace function public.aud_conciliacion(p_grupo text default null)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dep   uuid;
  v_reg   uuid;
  v_grupo text;
begin
  if not has_auditor_access() then
    raise exception 'Sin acceso al auditor' using errcode = '42501';
  end if;

  select id into v_dep from aud_dep_cargas where estado = 'completa' order by secuencia desc limit 1;
  select id into v_reg from aud_cargas order by secuencia desc limit 1;

  v_grupo := nullif(regexp_replace(coalesce(p_grupo, ''), '\D', '', 'g'), '');
  if v_grupo is not null then v_grupo := lpad(v_grupo, 6, '0'); end if;

  return (
    with dep as (
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
    j as (
      select dep.*,
             coalesce(reg.monto_registrado, 0) as monto_registrado,
             coalesce(reg.n_registros, 0)      as n_registros,
             case
               when reg.n_registros is null                       then 'sin_registro'
               when reg.monto_registrado <> dep.monto_depositado  then 'diferencia'
               when reg.n_registros > 1                           then 'un_registro'
               else 'listo'
             end                                                 as estado,
             dep.monto_depositado - coalesce(reg.monto_registrado, 0) as diferencia
      from dep
      left join reg using (grupo_id, ciclo, fecha_deposito)
    )
    select json_build_object(
      'dep_carga', (select json_build_object('id', c.id, 'nombre_archivo', c.nombre_archivo,
                      'created_at', c.created_at, 'fecha_min', c.fecha_min, 'fecha_max', c.fecha_max)
                    from aud_dep_cargas c where c.id = v_dep),
      'reg_carga', (select json_build_object('id', c.id, 'nombre_archivo', c.nombre_archivo,
                      'created_at', c.created_at, 'fecha_min', c.fecha_min, 'fecha_max', c.fecha_max)
                    from aud_cargas c where c.id = v_reg),
      'depositos_no_conciliados', coalesce((select sum(n_depositos) from j), 0),
      'monto_no_conciliado',      coalesce((select sum(monto_depositado) from j), 0),
      'conteo', json_build_object(
        'listo',        (select count(*) from j where estado = 'listo'),
        'sin_registro', (select count(*) from j where estado = 'sin_registro'),
        'diferencia',   (select count(*) from j where estado = 'diferencia'),
        'un_registro',  (select count(*) from j where estado = 'un_registro')
      ),
      'filas', coalesce((
        select json_agg(json_build_object(
                 'grupo_id', grupo_id, 'nombre_grupo', nombre_grupo, 'ciclo', ciclo,
                 'fecha_deposito', fecha_deposito, 'semanas', coalesce(to_json(semanas), '[]'::json),
                 'monto_depositado', monto_depositado, 'n_depositos', n_depositos,
                 'monto_registrado', monto_registrado, 'n_registros', n_registros,
                 'estado', estado, 'diferencia', diferencia, 'depositos', depositos
               ) order by fecha_deposito, grupo_id, ciclo)
        from j
        where v_grupo is null or grupo_id = v_grupo
      ), '[]'::json)
    )
  );
end;
$$;

grant execute on function public.aud_conciliacion(text) to authenticated;
