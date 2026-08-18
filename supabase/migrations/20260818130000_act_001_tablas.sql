-- ACT-001 — Módulo Actividades: esquema base.
--
-- Origen: `tablas_uziel.xlsx` (3 hojas) y el tablero de Power BI construido sobre él.
-- El modelo del .pbix tiene UNA sola tabla (`MART_DIRECTIVO`) que es la hoja de hechos
-- ya desnormalizada; los catálogos de empleados y puestos no participaban del reporte.
-- Aquí se conservan los tres, pero con roles distintos:
--   · act_registros  = los hechos, tal como vienen del archivo (fuente de los tableros)
--   · act_empleados / act_puestos = catálogos, para saber quién NO registró actividad
--     (dato que el Excel no puede dar y es justo lo que a dirección le va a faltar)

-- ── Bandera de acceso ────────────────────────────────────────────────────────
-- Paridad con acceso_score / acceso_cartera / acceso_reclutamiento. Este tablero
-- mide el tiempo de personas con nombre y apellido, así que nace cerrado: la
-- asigna un admin desde /admin/usuarios.
alter table profiles
  add column if not exists acceso_actividades boolean not null default false;

-- ── Ledger de cargas ─────────────────────────────────────────────────────────
-- Un archivo puede traer varios periodos (el de muestra trae 2026-07 y 2026-08),
-- así que el periodo NO es del archivo sino de cada registro. La carga guarda
-- qué periodos tocó, para que la pantalla pueda decir exactamente qué reemplazó.
create table if not exists act_cargas (
  id             uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  storage_path   text,
  periodos       text[] not null default '{}',
  registros      int not null default 0,
  estado         text not null default 'procesado'
                 check (estado in ('procesando','procesado','error')),
  error_detalle  text,
  subido_por     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

-- ── Hechos ───────────────────────────────────────────────────────────────────
create table if not exists act_registros (
  id                  bigserial primary key,
  carga_id            uuid references act_cargas(id) on delete cascade,

  id_registro         text not null,          -- ID_REGISTRO del archivo
  fecha               date not null,
  periodo             text not null,          -- 'YYYY-MM'

  no_empleado         text not null,
  nombre              text not null,

  -- Estructura organizacional, desnormalizada como viene del archivo. Se guarda
  -- tal cual y no por lookup contra act_puestos a propósito: si mañana alguien
  -- cambia de puesto, los registros viejos deben seguir contando en el puesto
  -- que tenía cuando hizo el trabajo.
  id_puesto           text,
  puesto              text,
  area                text,
  gerencia            text,
  direccion           text,
  nivel_jerarquico    text,

  id_actividad        text,
  actividad           text,
  id_categoria        text,
  categoria           text,

  -- El archivo trae MINUTOS y HORAS, y HORAS es siempre MINUTOS/60. Guardar las
  -- dos invita a que un día dejen de coincidir; aquí solo se guardan los minutos
  -- (entero, sin redondeo) y las horas se derivan.
  minutos             int not null check (minutos >= 0),
  horas               numeric(10,4) generated always as (minutos::numeric / 60) stored,

  -- Bloque de "algo relevante". Cuando la bandera es falsa, los cuatro campos
  -- siguientes vienen vacíos: son el detalle de por qué se marcó.
  hubo_algo_relevante boolean not null default false,
  id_motivo           text,
  motivo              text,
  tipo_motivo         text,                   -- POSITIVO | FRICCION | CONTEXTO
  comentario          text,

  -- Reprocesar el mismo archivo no debe duplicar. La llave es del negocio, no
  -- técnica: un registro es único dentro de su periodo.
  unique (periodo, id_registro)
);

-- ── Catálogos ────────────────────────────────────────────────────────────────
create table if not exists act_puestos (
  id_puesto      text primary key,
  puesto         text not null,
  area           text,
  activo         boolean not null default true,
  actualizado_at timestamptz not null default now()
);

create table if not exists act_empleados (
  no_empleado    text primary key,
  nombre         text not null,
  correo         text,
  id_puesto      text references act_puestos(id_puesto),
  activo         boolean not null default true,
  actualizado_at timestamptz not null default now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
-- Los tableros filtran y agrupan siempre por estas columnas.
create index if not exists idx_act_periodo    on act_registros(periodo);
create index if not exists idx_act_direccion  on act_registros(direccion);
create index if not exists idx_act_gerencia   on act_registros(gerencia);
create index if not exists idx_act_categoria  on act_registros(categoria);
create index if not exists idx_act_empleado   on act_registros(no_empleado);
-- La pantalla de fricción parte siempre de la bandera; índice parcial porque
-- solo interesa el lado verdadero (≈36% de las filas en la muestra).
create index if not exists idx_act_relevante  on act_registros(periodo)
  where hubo_algo_relevante;

comment on table act_registros is
  'ACT-001: hechos de actividades por empleado y periodo. Equivale a la hoja Tabla_actividad del Excel y a MART_DIRECTIVO del tablero de Power BI. Las horas se derivan de los minutos.';
comment on table act_cargas is
  'ACT-001: bitácora de cargas del Excel de actividades. `periodos` registra qué periodos reemplazó cada carga.';
