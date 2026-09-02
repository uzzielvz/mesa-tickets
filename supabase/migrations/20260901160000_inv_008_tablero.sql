-- INV-008 (I4) — Los hechos del Tablero Ejecutivo de Cartera de Inversiones.
--
-- Trece hojas, de las que solo `Historial_Movimientos` es fuente: todo lo demás
-- son agregaciones que el script de Felix ya calculó. **Se guardan como vienen,
-- no se recalculan** (regla 1 de §9.2). Reimplementar la fórmula del ranking en
-- SQL crearía una segunda verdad, y el día que dé 62.3 donde el Excel dice 62.4
-- Dirección no le cree a ninguna de las dos.
--
-- ── Sobre las columnas SI/NO ────────────────────────────────────────────────
-- El archivo escribe 'SI'/'NO' como texto. Aquí se guardan como boolean. No es
-- recalcular: es la misma afirmación en el tipo correcto, y evita que cada
-- consulta tenga que acordarse de comparar contra la cadena.
--
-- ── Sobre la CLABE ──────────────────────────────────────────────────────────
-- Vuelve a existir la columna (INV-007 la había quitado de `inv_pagos`), pero
-- **solo se llena cuando el archivo la trae como texto de 18 dígitos**. Hoy no
-- pasa: el generador la escribe como número y float64 le altera los últimos
-- dígitos. Queda la columna lista para el día que se corrija aguas arriba, con
-- el filtro puesto para que mientras tanto entre NULL y no un número inventado.

-- ── Tabla de hechos: un renglón por movimiento ──────────────────────────────
create table if not exists inv_movimientos (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  fila     int not null,

  fuente_universo   text,
  situacion_temporal text,
  en_periodo_analizado boolean,
  estado_movimiento text,
  motivo_validacion text,
  afecta_saldo_al_corte boolean,
  cuenta_en_ranking_periodo boolean,
  cuenta_para_meta boolean,
  cuenta_para_meta_en_periodo boolean,

  tipo_movimiento   text,
  fecha_movimiento  date,
  clave             text,
  tipo_inversion_base text,
  codigo_cliente    text,
  codigo_inversion  text,
  codigo_ejecutivo  text,
  situacion_inversion text,
  tipo_relacion     text,

  gerente_ejecutivo text,
  gerente_inversion text,
  ejecutivo         text,
  inversionista     text,
  generacion        text,
  tipo_colaborador  text,

  banco_inversion   text,
  clabe_inversion   text,
  tiene_datos_bancarios boolean,
  medio_sugerido_por_datos_bancarios text,
  medio_movimiento  text,
  nivel_confianza_medio text,
  fuente_medio_movimiento text,
  validacion_medio_movimiento text,
  observacion_medio_movimiento text,

  monto_movimiento               numeric(16,2),
  monto_para_meta                numeric(16,2),
  monto_efectivo_movimiento      numeric(16,2),
  monto_transferencia_movimiento numeric(16,2),
  transferencia_informada_en_texto boolean,
  monto_transferencia            numeric(16,2),
  total_incrementos_efectivo_fuente      numeric(16,2),
  total_incrementos_transferencia_fuente numeric(16,2),
  diferencia_efectivo_vs_fuente      numeric(16,2),
  diferencia_transferencia_vs_fuente numeric(16,2),
  saldo_antes_movimiento    numeric(16,2),
  saldo_despues_movimiento  numeric(16,2),
  porcentaje_sobre_saldo_antes numeric,
  saldo_vigente_al_corte    numeric(16,2),
  monto_original            numeric(16,2),
  monto_total_registrado    numeric(16,2),

  apertura   date,
  fecha_fin  date,
  plazo_contractual_meses    int,
  meses_efectivos_movimiento numeric,
  factor_tiempo              numeric,
  factor_tipo                numeric,
  valor_ponderado_ranking    numeric(16,2),

  tipo_pago         text,
  tipo_rendimiento  text,
  sobretasa_actual  numeric,
  sobretasa_movimiento numeric,
  periodos_gracia   int,

  origen_movimiento text,
  tipo_parche       text,
  secuencia_movimiento int,
  detalle_movimiento text,
  archivos_origen   text,

  created_at timestamptz not null default now()
);

create index if not exists idx_inv_mov_carga        on inv_movimientos(carga_id);
create index if not exists idx_inv_mov_carga_fecha  on inv_movimientos(carga_id, fecha_movimiento);
create index if not exists idx_inv_mov_carga_ger    on inv_movimientos(carga_id, gerente_ejecutivo);
create index if not exists idx_inv_mov_carga_tipo   on inv_movimientos(carga_id, tipo_movimiento);
create index if not exists idx_inv_mov_clave        on inv_movimientos(carga_id, clave);

-- ── Cumplimiento de metas: el histórico mensual ─────────────────────────────
-- La única serie de tiempo del archivo: va desde 2024-11 hasta el corte. No hace
-- falta acumular cortes para tener tendencia — cada archivo ya la trae completa.
create table if not exists inv_cumplimiento (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  fila     int not null,
  mes      date,
  gerente_ejecutivo text,
  gerente_inversion text,
  ejecutivo         text,
  meta_mensual      numeric(16,2),
  nueva             numeric(16,2),
  renovacion        numeric(16,2),
  incremento        numeric(16,2),
  colocacion_total  numeric(16,2),
  cumplimiento_pct  numeric,
  cumplio           boolean,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_cump_carga     on inv_cumplimiento(carga_id);
create index if not exists idx_inv_cump_carga_mes on inv_cumplimiento(carga_id, mes);

-- ── Rankings ────────────────────────────────────────────────────────────────
-- Las dos hojas (`Ranking_Comercial` y `Ranking_Con_Meta`) traen la misma tabla
-- tres veces, a tres niveles: por gerente ejecutivo, por gerente de inversión y
-- por ejecutivo. Cambian solo las columnas de identidad. Se unifican con dos
-- discriminadores en lugar de seis tablas casi idénticas.
create table if not exists inv_ranking (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  con_meta boolean not null,
  nivel    text not null check (nivel in ('gerente_ejecutivo', 'gerente_inversion', 'ejecutivo')),
  posicion int,

  gerente_ejecutivo text,
  gerente_inversion text,
  ejecutivo         text,

  nuevas                    numeric(16,2),
  renovaciones              numeric(16,2),
  incrementos               numeric(16,2),
  decrementos               numeric(16,2),
  vencimiento_natural       numeric(16,2),
  valor_nuevas_ponderado    numeric(16,2),
  valor_renovaciones_ponderado numeric(16,2),
  valor_incrementos_ponderado  numeric(16,2),
  produccion_ponderada      numeric(16,2),
  clientes_nuevos           int,
  concentracion_mayor_cliente numeric,
  factor_diversificacion    numeric,
  vencimientos_elegibles    numeric(16,2),
  renovado_sobre_vencimientos numeric(16,2),
  retencion_vencimientos    numeric,
  saldo_vigente_corte       numeric(16,2),
  cartera_expuesta          numeric(16,2),
  tasa_decremento           numeric,
  puntaje_produccion        numeric,
  puntaje_clientes          numeric,
  puntaje_retencion         numeric,
  penalizacion_decrementos  numeric,
  crecimiento_neto          numeric(16,2),

  -- Solo en la hoja con meta.
  meta_periodo         numeric(16,2),
  colocacion_para_meta numeric(16,2),
  cumplimiento_meta    numeric,
  meses_cumplidos      int,
  meses_evaluados      int,
  puntaje_sin_meta     numeric,
  puntaje_meta         numeric,

  puntaje numeric,
  lectura text,

  created_at timestamptz not null default now()
);

create index if not exists idx_inv_rank_carga on inv_ranking(carga_id, con_meta, nivel, posicion);

-- ── Tablero y Tablero_Estructura ────────────────────────────────────────────
-- Dos hojas con varias tablas apiladas. `Tablero` reparte por universo
-- (CREDIFLEXI / RAMI / Totales); `Tablero_Estructura` es global y baja hasta el
-- ejecutivo. Mismas medidas en las dos, así que van juntas con discriminadores.
create table if not exists inv_tablero_resumen (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  hoja     text not null,
  -- 'CREDIFLEXI' | 'RAMI' | 'TOTALES' en la hoja Tablero; NULL en Estructura,
  -- que no separa universos.
  universo text,
  nivel    text not null check (nivel in ('total', 'gerente', 'gerente_inversion', 'ejecutivo')),
  orden    int not null,

  gerente_ejecutivo text,
  gerente_inversion text,
  ejecutivo         text,
  generacion        text,
  tipo_colaborador  text,
  origen            text,

  ejecutivos    int,
  inv_vigentes  int,
  vigente          numeric(16,2),
  abierto          numeric(16,2),
  vencido          numeric(16,2),
  crecimiento_neto numeric(16,2),

  created_at timestamptz not null default now()
);

create index if not exists idx_inv_tabres_carga on inv_tablero_resumen(carga_id, hoja, nivel, orden);

-- ── Posiciones vigentes al corte ────────────────────────────────────────────
create table if not exists inv_posiciones (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  universo text not null,
  fila     int not null,
  clave    text,
  gerente_ejecutivo text,
  gerente_inversion text,
  ejecutivo         text,      -- columna `nombre` en el archivo
  inversionista     text,
  apertura   date,
  fecha_fin  date,
  monto_original            numeric(16,2),
  saldo_vigente_corte       numeric(16,2),
  total_abierto_hasta_corte numeric(16,2),
  total_salido_hasta_corte  numeric(16,2),
  plazo             int,
  tipo_pago         text,     -- TIPOPAGO
  tipo_rendimiento  text,     -- TIPOREN
  sobretasa_actual  numeric,
  archivos_origen   text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_pos_carga on inv_posiciones(carga_id, universo);

-- ── Eventos del periodo (aperturas y vencimientos) ──────────────────────────
create table if not exists inv_eventos (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  universo text not null,
  -- 'abiertos' | 'vencidos': de qué hoja salió. `tipo_evento` es lo que el
  -- archivo afirma dentro de la fila, y puede ser más fino.
  grupo    text not null check (grupo in ('abiertos', 'vencidos')),
  fila     int not null,
  tipo_evento  text,
  fecha_evento date,
  clave        text,
  gerente_ejecutivo text,
  gerente_inversion text,
  ejecutivo         text,
  inversionista     text,
  monto_evento     numeric(16,2),
  monto_original   numeric(16,2),
  apertura   date,
  fecha_fin  date,
  saldo_antes_evento   numeric(16,2),
  saldo_despues_evento numeric(16,2),
  plazo            int,
  tipo_pago        text,
  tipo_rendimiento text,
  sobretasa_actual numeric,
  detalle_evento   text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_ev_carga on inv_eventos(carga_id, universo, grupo);

-- ── Validaciones del Tablero ────────────────────────────────────────────────
create table if not exists inv_validaciones (
  id       uuid primary key default gen_random_uuid(),
  carga_id uuid not null references inv_cargas(id) on delete cascade,
  fila     int not null,
  universo text,
  tipo_validacion text,
  clave    text,
  detalle  text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_val_carga on inv_validaciones(carga_id);

-- ── La CLABE vuelve, con guarda ─────────────────────────────────────────────
alter table inv_pagos add column if not exists clabe text;
comment on column inv_pagos.clabe is
  'Solo se llena si el archivo la trae como texto de 18 dígitos. Hoy el '
  'generador la escribe como número y float64 le altera los últimos dígitos, '
  'así que entra NULL. Ver INV-007.';
comment on column inv_movimientos.clabe_inversion is
  'Misma guarda que inv_pagos.clabe: NULL mientras el archivo la traiga como número.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Todo esto es la puerta de Desempeño (Dirección). Insert y delete, de quien
-- carga: son datos derivados que siempre se regeneran del .xlsx guardado, a
-- diferencia de inv_cargas, que no se borra nunca.
do $$
declare t text;
begin
  foreach t in array array[
    'inv_movimientos', 'inv_cumplimiento', 'inv_ranking',
    'inv_tablero_resumen', 'inv_posiciones', 'inv_eventos', 'inv_validaciones'
  ] loop
    execute format('alter table %I enable row level security', t);

    execute format(
      'create policy %I on %I for select to authenticated using (public.has_inversiones_desempeno())',
      t || '_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (public.has_inversiones_carga())',
      t || '_insert', t);
    execute format(
      'create policy %I on %I for delete to authenticated using (public.has_inversiones_carga())',
      t || '_delete', t);
  end loop;
end $$;
