-- C0-4 CART-000d: cierre del schema de cartera contra FINAL TARGET.
-- Agrega las 11 columnas del input Yunius que aun no estaban persistidas
-- y extiende loan_amortizacion_individual para soportar el formato
-- amortizaciones_individual_test (89 cols).
--
-- Fuente: docs/cartera/mapping-matrix.md seccion 3.1 y 3.3.
--
-- Notas:
-- - `concepto_deposito` ya existe (migracion 20260524000003).
-- - `cuotas_sin_pagar` y `combinado` se removeran en una migracion futura
--   junto con el refactor del ETL (CART-001). Se dejan para no romper
--   el insert actual.
-- - En loan_amortizacion_individual ya existen: estatus, categoria,
--   incremento, monto_recibido, monto_faltante, fecha_corte. Solo
--   agregamos lo realmente nuevo.

-- ============================================================
-- 1. stg_yunius_cartera_individual: 11 columnas faltantes
-- ============================================================
alter table stg_yunius_cartera_individual
  add column if not exists situacion_credito            text,
  add column if not exists medio_comunic_2              text,
  add column if not exists medio_comunic_3              text,
  add column if not exists tipo_garantia_2              text,
  add column if not exists descripcion_garantia_2       text,
  add column if not exists garantia_2                   text,
  add column if not exists calle                        text,
  add column if not exists colonia                      text,
  add column if not exists nom_personal_castiga_cartera text,
  add column if not exists frecuencia                   text,
  add column if not exists parcialidad_comision         numeric(12,2);

-- ============================================================
-- 2. loan_amortizacion_individual: campos para formato 89 cols
-- ============================================================
alter table loan_amortizacion_individual
  add column if not exists fuente_fecha_liquidacion text,
  add column if not exists es_no_aplica_liquidacion boolean default false,
  add column if not exists codigo_ciclo             text;

-- Indice auxiliar para JOINs por codigo_ciclo (clave alterna en exports).
create index if not exists idx_amort_codigo_ciclo
  on loan_amortizacion_individual(codigo_ciclo);
