-- AHO-001 — Visor de ahorros: tablas y banderas.
--
-- El problema: los clientes le piden a Felix (Data Science) su archivo de
-- ahorros y rendimientos; él filtra un Excel, arma el correo y lo manda.
-- ~10 min por dispersión, ~1 h diaria. Aquí el asesor busca grupo + ciclo, ve
-- la tabla y descarga el Excel solo. Felix únicamente sube lo que ya cuadró.
--
-- Reglas que no se negocian (memoria del módulo, 2026-09-29):
--   1. Valores planos. El CSV ya trae los rendimientos calculados; aquí no se
--      recalcula nada. Las columnas numéricas son `numeric` sin escala para
--      guardar exactamente el texto que llegó, sin redondear al cargar.
--   2. Carga por upsert, nunca borrar. Felix sube subconjuntos ya cuadrados
--      ("los 16 registros del grupo 96 ciclo 3"); borrar e insertar dejaría una
--      ventana en la que alguien descarga algo a medias. `pago_id` es la llave.
--   3. La tabla es temporal: algún día el origen será una consulta al sistema
--      completo. Por eso la pantalla y el Excel leen de RPCs con una forma
--      propia (cliente → semanas), no de las columnas del CSV.

-- ── Banderas de acceso ───────────────────────────────────────────────────────
-- Dos papeles con gente distinta detrás: quien consulta (asesores, gerentes) y
-- quien carga (Data Science). Mismo patrón que Inversiones.
alter table profiles
  add column if not exists acceso_ahorros       boolean not null default false,
  add column if not exists acceso_ahorros_carga boolean not null default false;

comment on column profiles.acceso_ahorros is
  'AHO-001: puede consultar ahorros y rendimientos por grupo + ciclo (/ahorros) y descargar el Excel.';
comment on column profiles.acceso_ahorros_carga is
  'AHO-001: puede subir el CSV de ahorros ya cuadrado (/ahorros/cargar). También consulta.';

-- ── Bitácora de cargas ───────────────────────────────────────────────────────
-- El upsert sobrescribe sin dejar rastro del valor anterior; esta bitácora es
-- lo que sí queda: quién subió qué archivo, cuándo, y qué grupos tocó.
create table if not exists aho_cargas (
  id             uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,

  -- Lo que el navegador leyó del archivo antes de mandar nada.
  filas_archivo  int not null default 0,      -- filas válidas que se mandan
  rechazadas     int not null default 0,      -- filas que no pasaron la validación
  grupos         text[] not null default '{}',-- KEY_Grupo que trae el archivo

  -- Lo que la base hizo con ellas. Una fila idéntica a la guardada no cuenta
  -- como actualizada: resubir el mismo archivo da 0 y 0.
  insertadas     int not null default 0,
  actualizadas   int not null default 0,

  avisos         text[] not null default '{}',

  -- La carga se manda por lotes desde el navegador. Si la pestaña se cierra a
  -- medias, la carga se queda 'en_curso' para siempre: lo que ya entró se queda
  -- (regla 2) y volver a subir el archivo es seguro, porque no duplica.
  estado         text not null default 'en_curso'
                 check (estado in ('en_curso', 'completa')),

  subido_por     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  cerrada_at     timestamptz
);

create index if not exists idx_aho_cargas_created on aho_cargas(created_at desc);

comment on table aho_cargas is
  'AHO-001: bitácora de cargas del CSV de ahorros. Append-only. El valor anterior de un pago no se conserva (regla 2: upsert); lo que se conserva es quién cargó qué y cuándo.';

-- ── Pagos ────────────────────────────────────────────────────────────────────
-- Una fila por cliente × semana, tal como viene del CSV de Felix
-- (`pagos_con_pago_semanal_cliente.csv`). Cada cliente-ciclo trae 16 filas.
--
-- Se dejan fuera columnas que el visor no usa y que el propio CSV duplica:
-- Pago_semanal_cliente (= pago_semanal), num_pago (= Semana), KEY_Semana_Grupo,
-- Fecha_captura (64% vacía y en otro formato), Promotor_edito y Gerente_edito.
create table if not exists aho_pagos (
  pago_id           text primary key,          -- 001878_000008_02_1
  key_grupo         text not null,             -- 000008_C02
  grupo_id          text not null,             -- 000008 (con ceros, nunca número)
  ciclo             text not null,             -- 02
  cliente_id        text not null,             -- 001878
  key_cliente       text not null,             -- 001878_000008_C02
  semana            smallint not null check (semana between 1 and 52),

  pago              numeric,                   -- lo que pagó esa semana (58% vacío)
  garantia          numeric,                   -- el ahorro de esa semana
  confirmada        boolean,                   -- 'Fase' y otras erratas → null
  usuario_captura   text,

  -- Datos del crédito. Se repiten en las 16 filas del cliente; vacíos cuando
  -- el CSV no los tiene (falta_pago = 1).
  pago_semanal      numeric,
  cantidad_prestada numeric,
  inicio_ciclo      date,
  garantia_min      numeric,
  base_ahorro       numeric,
  fecha_pago        date,                      -- fecha del calendario, no la real

  -- `falta_pago` NO significa "faltó el pago": vale 1 cuando el CSV no trae
  -- datos del crédito. `falta_ahorro` se dispara hasta por menos de un centavo.
  falta_pago        boolean not null default false,
  falta_ahorro      boolean not null default false,
  tasa              numeric,                   -- 0.06 / 0.14, cambia por semana

  -- Rendimiento de la garantía de esa semana hasta el pago N. Felix elige la
  -- columna según la semana de renovación, que no viene en el archivo.
  rend_10           numeric not null default 0,
  rend_11           numeric not null default 0,
  rend_12           numeric not null default 0,
  rend_13           numeric not null default 0,
  rend_14           numeric not null default 0,
  rend_15           numeric not null default 0,
  rend_16           numeric not null default 0,

  -- La última carga que CAMBIÓ esta fila (no la última que la trajo).
  carga_id          uuid not null references aho_cargas(id),
  actualizado_at    timestamptz not null default now()
);

create index if not exists idx_aho_pagos_key_grupo   on aho_pagos(key_grupo);
create index if not exists idx_aho_pagos_grupo_ciclo on aho_pagos(grupo_id, ciclo);
create index if not exists idx_aho_pagos_actualizado on aho_pagos(actualizado_at desc);

comment on table aho_pagos is
  'AHO-001: ahorros por cliente × semana, del CSV de Data Science. Temporal (regla 3): la pantalla lee por RPC, no de estas columnas.';

-- ── Uso ──────────────────────────────────────────────────────────────────────
-- Cada consulta y cada descarga. No es auditoría: es la evidencia de que el
-- módulo se usa, que es justo lo que faltó medir en los otros módulos.
create table if not exists aho_eventos (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('consulta', 'descarga')),
  key_grupo   text not null,
  usuario     uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_aho_eventos_created on aho_eventos(created_at desc);
