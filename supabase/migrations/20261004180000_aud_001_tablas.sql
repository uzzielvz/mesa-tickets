-- AUD-001 — Auditor de depósitos: tablas, banderas y RLS.
--
-- Pedido de Charly (junta del 18 de septiembre; en correo se llama
-- "Auditor"). Hoy contacta a cada promotor uno por uno para explicarle sus
-- depósitos sin conciliar; le come el día. El objetivo es que cada promotor
-- entre y vea solo SUS registros sin conciliar (~6 al día en toda la cartera).
--
-- El modelo acordado: Charly escribe las consultas SQL y la plataforma pone la
-- interfaz. Esta primera versión toma el archivo que manda Felix desde Yunius
-- (`pagos_registrados_MMAAAA.xlsx`): una fila por depósito registrado, con la
-- bandera CONCILIADO (C/N) ya calculada.
--
-- Lo que falta para la versión de promotores: saber de quién es cada grupo. El
-- archivo no trae al promotor; la columna `promotor` queda lista para cuando
-- llegue (PROMOTOR en el archivo, con el correo de la plataforma).

-- ── Banderas ─────────────────────────────────────────────────────────────────
alter table profiles
  add column if not exists acceso_auditor       boolean not null default false,
  add column if not exists acceso_auditor_carga boolean not null default false;

comment on column profiles.acceso_auditor is
  'AUD-001: ve los depósitos registrados sin conciliar de toda la cartera (/auditor).';
comment on column profiles.acceso_auditor_carga is
  'AUD-001: sube el archivo de pagos registrados de Yunius (/auditor/cargar). También consulta.';

-- ── Cargas ───────────────────────────────────────────────────────────────────
-- Charly: "la tabla del promotor se reemplaza completa". Cada carga es una foto
-- completa y la vigente es la última. Las anteriores se conservan: así se puede
-- ver si un depósito que estaba sin conciliar ya se arregló.
create table if not exists aud_cargas (
  id                  uuid primary key default gen_random_uuid(),
  -- "La vigente es la última" se decide por este consecutivo, no por
  -- created_at: dos cargas en la misma transacción comparten now().
  secuencia           bigint generated always as identity unique,
  nombre_archivo      text not null,
  registros           int not null default 0,
  sin_conciliar       int not null default 0,
  monto_sin_conciliar numeric not null default 0,
  fecha_min           date,
  fecha_max           date,
  avisos              text[] not null default '{}',
  subido_por          uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

create index if not exists idx_aud_cargas_secuencia on aud_cargas(secuencia desc);

-- ── Registros ────────────────────────────────────────────────────────────────
-- Una fila por depósito que el promotor registró en Yunius. Un mismo grupo y
-- semana puede tener varios depósitos (500 + 869 el mismo día, por ejemplo),
-- así que no hay llave natural: la identidad es la carga + la fila.
create table if not exists aud_registros (
  id             bigint generated always as identity primary key,
  carga_id       uuid not null references aud_cargas(id) on delete cascade,
  fila           int not null,
  conciliado     boolean not null,          -- CONCILIADO: C = true, N = false
  ciclo          text not null,             -- CICLO (con ceros: "04")
  grupo_id       text not null,             -- CDGCLNS (con ceros: "000013")
  periodo        smallint,                  -- PERIODO: semana del ciclo
  nombre_grupo   text,                      -- NOMBRENS
  fecha_deposito date not null,             -- FREALDEP
  monto          numeric not null,          -- MONTODEP
  promotor       text                       -- PROMOTOR, cuando el archivo lo traiga
);

create index if not exists idx_aud_registros_carga on aud_registros(carga_id, conciliado);
create index if not exists idx_aud_registros_promotor on aud_registros(carga_id, promotor);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table aud_cargas    enable row level security;
alter table aud_registros enable row level security;

create or replace function public.has_auditor_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_auditor = true or acceso_auditor_carga = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.has_auditor_carga()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rol = 'admin' or acceso_auditor_carga = true
       from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke all on function public.has_auditor_access() from public, anon;
revoke all on function public.has_auditor_carga()  from public, anon;
grant execute on function public.has_auditor_access() to authenticated;
grant execute on function public.has_auditor_carga()  to authenticated;

create policy "aud_cargas_select" on aud_cargas
  for select to authenticated using (has_auditor_access());
create policy "aud_registros_select" on aud_registros
  for select to authenticated using (has_auditor_access());

-- Sin políticas de escritura: todo entra por `aud_cargar` (AUD-002).
