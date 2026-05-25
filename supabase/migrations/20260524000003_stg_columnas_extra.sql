-- Columnas adicionales calculadas por el ETL
ALTER TABLE stg_yunius_cartera_individual
  ADD COLUMN IF NOT EXISTS concepto_deposito  text,
  ADD COLUMN IF NOT EXISTS cuotas_sin_pagar   numeric(8,2),
  ADD COLUMN IF NOT EXISTS combinado          numeric(14,2);
