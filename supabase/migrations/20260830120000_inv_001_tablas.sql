-- INV-001 — Módulo Inversiones: bitácora de cargas.
--
-- Custodia los dos reportes que Felix genera a diario con Python a partir de
-- exports de Yunius (el core bancario):
--   · Calendario de Pagos a Fondeadores  — mensual   → audiencia: Tesorería
--   · Tablero Ejecutivo de Cartera       — por corte → audiencia: Dirección
--
-- Análisis de los archivos en RESEARCH §14; plan en PLAN §9.
--
-- Forma: UNA tubería, DOS puertas. La carga, el almacenamiento del original, el
-- versionado y la descarga se comparten. Las vistas y los permisos no.
--
-- Este sprint (I1) NO parsea los hechos: guarda el archivo y su encabezado.
-- Las tablas de hechos llegan en I2 (Calendario) e I4 (Tablero).

-- ── Banderas de acceso ───────────────────────────────────────────────────────
-- Tres, no una, porque hay tres papeles distintos con gente real detrás. En
-- Actividades la segunda bandera se pospuso por no haber a quién dársela; aquí
-- las tres audiencias existen desde el día uno.
--
-- `todo o nada` DENTRO de cada puerta: quien entra a pagos ve el calendario
-- completo, CLABE incluida. Lo que se separa es a qué puerta entras.
alter table profiles
  add column if not exists acceso_inversiones_carga     boolean not null default false,
  add column if not exists acceso_inversiones_pagos     boolean not null default false,
  add column if not exists acceso_inversiones_desempeno boolean not null default false;

comment on column profiles.acceso_inversiones_carga is
  'INV-001: puede subir los reportes de inversiones (/inversiones/cargar). No implica poder verlos.';
comment on column profiles.acceso_inversiones_pagos is
  'INV-001: puede ver el Calendario de Pagos a Fondeadores (/inversiones/pagos).';
comment on column profiles.acceso_inversiones_desempeno is
  'INV-001: puede ver el Tablero Ejecutivo de Cartera (/inversiones/desempeno).';

-- ── Bitácora compartida ──────────────────────────────────────────────────────
create table if not exists inv_cargas (
  id             uuid primary key default gen_random_uuid(),

  -- Se detecta por CONTENIDO (nombres de hoja), nunca por nombre de archivo: el
  -- nombre lo genera el script de Felix y puede cambiar sin avisar.
  tipo_reporte   text not null check (tipo_reporte in ('calendario','tablero')),

  -- Los dos reportes declaran su periodo en el encabezado de la hoja:
  --   Calendario → "CALENDARIO DE PAGOS A FONDEADORES — 08/2026"
  --   Tablero    → "Periodo analizado: 01/08/2026 al 27/08/2026"
  -- De ahí salen estas dos fechas. El mes completo para el calendario; el rango
  -- real para el tablero.
  periodo_inicio date not null,
  periodo_fin    date not null,

  nombre_archivo text not null,
  storage_path   text not null,
  hash_archivo   text,                    -- sha256; sirve para avisar de resubidas idénticas
  tamano_bytes   bigint,

  -- 'pendiente' = el archivo está guardado pero sus hechos no se han ingerido.
  -- Es el estado normal en I1, donde todavía no existe el parseo.
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente','procesado','error')),
  error_detalle  text,

  -- Las notas metodológicas del archivo (filas 2-4 de cada hoja) NO son adorno:
  -- llevan la fórmula del ranking, la definición de meta y la convención de
  -- signos. Sin ellas nadie puede explicar un puntaje, ni una persona ni un
  -- modelo. Se guardan por carga porque pueden cambiar entre versiones del
  -- script que las genera.  {hoja: texto}
  notas_metodologicas jsonb not null default '{}'::jsonb,

  -- Una hoja puede llegar en SIN_DATOS (le pasa a los rankings cuando el periodo
  -- lleva pocos días). Eso es parte del contrato del archivo, no una anomalía:
  -- se registra para que la pantalla diga "no hubo movimientos para rankear"
  -- en vez de mostrar una tabla vacía que parece rota.
  hojas_degradadas jsonb not null default '[]'::jsonb,

  -- Avisos de ingesta que no impiden guardar pero merecen verse. El primero que
  -- existe: corte en el futuro. Ya llegó un archivo con corte 02/09 entregado el
  -- 29/08, y la respuesta sobre por qué fue "no sé, solo me pasaron así" — o sea
  -- que la fecha de corte no es un dato confiable.
  avisos         text[] not null default '{}',

  filas          int not null default 0,  -- hechos ingeridos; 0 mientras esté 'pendiente'
  subido_por     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

-- La consulta de siempre: "el más reciente de este tipo".
create index if not exists idx_inv_cargas_tipo_periodo
  on inv_cargas(tipo_reporte, periodo_inicio desc, periodo_fin desc, created_at desc);

create index if not exists idx_inv_cargas_created
  on inv_cargas(created_at desc);

comment on table inv_cargas is
  'INV-001: bitácora de cargas de los reportes de inversiones. Append-only: cada carga se conserva. "Vigente" es la más reciente por (tipo_reporte, periodo_inicio) — así el calendario de septiembre no reemplaza al de agosto, pero un corte del 28/08 sí reemplaza al del 27/08.';
