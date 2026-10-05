-- VAC-001 — Módulo de Vacaciones, fase 1: la base viva de Gente y Cultura.
--
-- Pedido en la junta del 17 de agosto; levantado con Jesús Montellano (Gente y
-- Cultura) el 21 de septiembre. Hoy el proceso es: formato en papel con tres
-- firmas (empleado, jefe directo, Vo. Bo. de RH) y una base de Excel que
-- Montellano mantiene a mano (`BASE DE VACACIONES CREDIFLEXI 210926.xlsx`).
--
-- Lo que esta fase arregla de esa base (hallazgos del 2026-10-04):
--   · `hoy` está congelado con TODAY() del día que se guardó: los saldos solo
--     son correctos ese día. Aquí la antigüedad se calcula contra la fecha real.
--   · Las hojas CICLO 1 y CICLO 2 no tienen la misma gente: a la visible le
--     faltan 10 personas, 5 de ellas ya con derecho a 12 días. Aquí hay UNA
--     lista de empleados y los periodos salen de la fecha de ingreso.
--   · El formato se llena a mano; aquí se genera prellenado desde la base.
--
-- Fase 2 (fuera de aquí): el empleado solicita, el jefe autoriza en la
-- plataforma, RH da el Vo. Bo., y recordatorios al jefe que no autoriza.
-- Requiere correo y jefe directo de cada empleado, que el Excel no trae.

-- ── Bandera ──────────────────────────────────────────────────────────────────
alter table profiles
  add column if not exists acceso_vacaciones_rh boolean not null default false;

comment on column profiles.acceso_vacaciones_rh is
  'VAC-001: Gente y Cultura. Ve a todo el personal, registra vacaciones y días flotantes, e imprime los formatos.';

-- ── Días por año de servicio (Art. 76 LFT, reforma 2023) ────────────────────
-- La base de Montellano trae la tabla hasta 11-15 años; se completa con la
-- ley vigente para no dejar un hueco cuando alguien la cruce.
create table if not exists vac_dias_ley (
  desde smallint primary key,
  hasta smallint not null,
  dias  smallint not null,
  check (hasta >= desde)
);

insert into vac_dias_ley (desde, hasta, dias) values
  (1, 1, 12), (2, 2, 14), (3, 3, 16), (4, 4, 18), (5, 5, 20),
  (6, 10, 22), (11, 15, 24), (16, 20, 26), (21, 25, 28), (26, 30, 30), (31, 35, 32)
on conflict (desde) do nothing;

-- ── Empleados ────────────────────────────────────────────────────────────────
create table if not exists vac_empleados (
  id              uuid primary key default gen_random_uuid(),
  -- Como viene en la base: "APELLIDOS NOMBRES".
  nombre          text not null,
  -- Sin acentos, mayúsculas, espacios simples. Es la llave del import: volver
  -- a importar el Excel actualiza a la misma persona en vez de duplicarla.
  nombre_clave    text not null unique,
  puesto          text,
  -- Ninguno de estos tres viene en el Excel y el formato los pide.
  area            text,
  numero_empleado text,
  fecha_ingreso   date not null,
  -- Para la fase 2: con qué cuenta entra a la plataforma y quién lo autoriza.
  email           text unique,
  jefe_id         uuid references vac_empleados(id) on delete set null,
  activo          boolean not null default true,
  notas           text,
  -- En qué hojas del Excel venía. Sirve para enseñar el hallazgo, no para
  -- calcular nada.
  en_ciclo1       boolean not null default false,
  en_ciclo2       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (jefe_id is distinct from id)
);

create index if not exists idx_vac_empleados_jefe on vac_empleados(jefe_id);

drop trigger if exists trg_vac_empleados_updated on vac_empleados;
create trigger trg_vac_empleados_updated
  before update on vac_empleados
  for each row execute function set_updated_at();

comment on table vac_empleados is
  'VAC-001: el personal, importado de la base de Gente y Cultura. Los saldos NO se guardan: salen de fecha_ingreso + vac_dias_ley − movimientos (RPC vac_saldos).';

-- ── Movimientos ──────────────────────────────────────────────────────────────
-- Cada día tomado. Nunca se borra: un registro equivocado se anula y queda.
create table if not exists vac_movimientos (
  id             uuid primary key default gen_random_uuid(),
  -- Folio del formato impreso. Corre solo y no se reutiliza.
  folio          bigint generated always as identity unique,
  empleado_id    uuid not null references vac_empleados(id) on delete cascade,
  tipo           text not null check (tipo in ('vacaciones', 'flotante')),
  -- Año de servicio al que se cargan los días (el "CICLO" del Excel). Null en
  -- flotantes: esos van por año calendario.
  periodo        smallint check (periodo between 1 and 60),
  dias           numeric(5,1) not null check (dias > 0),
  fecha_inicio   date,
  fecha_fin      date,
  fecha_regreso  date,
  -- El histórico importado trae las fechas como texto libre ("08/12/25 AL
  -- 11/12/25\n29/05/2026 y 01/06/2026"); se guarda tal cual, sin adivinar.
  fechas_texto   text,
  observaciones  text,
  origen         text not null check (origen in ('importado', 'registro_rh')),
  registrado_por uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  anulado_at     timestamptz,
  anulado_por    uuid references auth.users(id),
  check (tipo = 'flotante' or periodo is not null),
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create index if not exists idx_vac_mov_empleado on vac_movimientos(empleado_id, tipo, periodo);

comment on table vac_movimientos is
  'VAC-001: días de vacaciones y flotantes tomados. Append-only: anular en vez de borrar. origen=importado es el saldo inicial que traía el Excel.';
