-- INV-004 (I2) — Los hechos del Calendario de Pagos a Fondeadores.
--
-- Una fila por pago programado, tal como viene de la hoja `BASE MM`. La hoja
-- `CALENDARIO MM` no se guarda: es un pivote exacto de BASE, verificado al
-- centavo en las cinco secciones (RESEARCH §14.1). Guardarla sería mantener dos
-- versiones del mismo dato.
--
-- ── Dos columnas que se llaman casi igual ───────────────────────────────────
--   tipo_pago      'C' = devolución de capital · 'R' = rendimiento
--   periodicidad   'Mensual' | 'Al plazo' — cada cuándo se paga el rendimiento
-- En el archivo se llaman TIPO_PAGO y TIPOPAGO. Aquí se separan a propósito:
-- confundirlas produce cifras equivocadas con cara de correctas.
--
-- ── Qué sale de caja ────────────────────────────────────────────────────────
-- `seccion` es la clasificación que el propio archivo ya hizo, y es la buena.
-- Lo que NO sale de caja es la sección 'INVERSIONES CAPITALIZADAS AL PLAZO',
-- **no** la forma de pago: en agosto hay una devolución de capital de 714,000
-- cuya FORMA_PAGO_CALENDARIO dice "AL PLAZO" pero que sí sale, porque es capital
-- que se le regresa al inversionista al vencimiento. Agrupar por forma de pago
-- subestimaría la salida del mes en tres cuartos de millón.

create table if not exists inv_pagos (
  id           uuid primary key default gen_random_uuid(),
  carga_id     uuid not null references inv_cargas(id) on delete cascade,

  fila          int not null,          -- fila en la hoja, para rastrear
  indice_origen int,                   -- índice que arrastra el pandas de Felix

  clave         text not null,
  monto         numeric(14,2) not null default 0,
  inversionista text,
  fecha_pago    date,
  dia           smallint,

  tipo_pago        text,               -- 'C' | 'R'
  universo         text,               -- 'CREDI' | 'RAMI'
  forma_pago       text,               -- FORMA_PAGO_CALENDARIO
  periodicidad     text,               -- TIPOPAGO
  tipo_rendimiento text,               -- TIPOREN
  seccion          text not null,

  nombre_cl         text,
  banco             text,              -- IBNOMBRE
  clabe             text,              -- ⚠ dato bancario, ver más abajo
  gerente_inversion text,
  gerente_ejecutivo text,
  ejecutivo         text,
  fuente_catalogo   text,              -- ACTIVO | TERMINADO

  created_at timestamptz not null default now()
);

-- Bandera derivada de la clasificación del archivo, no un recálculo: evita que
-- cada consulta repita la cadena literal y se equivoque una de ellas. Si el
-- generador llegara a renombrar la sección, el parser lo detecta al cargar y
-- avisa — por eso esto no es un riesgo silencioso.
alter table inv_pagos
  add column if not exists capitaliza boolean
  generated always as (seccion = 'INVERSIONES CAPITALIZADAS AL PLAZO') stored;

create index if not exists idx_inv_pagos_carga      on inv_pagos(carga_id);
create index if not exists idx_inv_pagos_carga_dia  on inv_pagos(carga_id, dia);
create index if not exists idx_inv_pagos_carga_sec  on inv_pagos(carga_id, seccion);

-- Hoja VALIDACIONES: los pagos que el script no pudo clasificar. No es un anexo,
-- es la lista de trabajo de Tesorería.
create table if not exists inv_pagos_validaciones (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  fila     int not null,
  universo text,
  clave    text,
  inversionista text,
  observacion   text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_pagos_val_carga on inv_pagos_validaciones(carga_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Lectura: quien tenga la puerta de pagos (Tesorería). NO se le abre a quien
-- solo tiene desempeño: el Calendario trae CLABE y nombre de cada inversionista,
-- y el Tablero Ejecutivo no necesita nada de eso.
--
-- A diferencia de inv_cargas, aquí SÍ hay DELETE. La distinción es deliberada:
-- inv_cargas es la bitácora y no se borra nunca; estas filas son dato derivado
-- que siempre se puede regenerar del .xlsx original guardado en Storage. Sin
-- DELETE no se podría reprocesar una carga después de corregir el parser.

alter table inv_pagos enable row level security;
alter table inv_pagos_validaciones enable row level security;

create policy "inv_pagos_select" on inv_pagos
  for select to authenticated
  using (public.has_inversiones_pagos());

create policy "inv_pagos_insert" on inv_pagos
  for insert to authenticated
  with check (public.has_inversiones_carga());

create policy "inv_pagos_delete" on inv_pagos
  for delete to authenticated
  using (public.has_inversiones_carga());

create policy "inv_pagos_val_select" on inv_pagos_validaciones
  for select to authenticated
  using (public.has_inversiones_pagos());

create policy "inv_pagos_val_insert" on inv_pagos_validaciones
  for insert to authenticated
  with check (public.has_inversiones_carga());

create policy "inv_pagos_val_delete" on inv_pagos_validaciones
  for delete to authenticated
  using (public.has_inversiones_carga());
