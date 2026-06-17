-- ================================================================
-- LIMPIEZA PRE-PRODUCCIÓN: borrar datos de prueba de cartera
-- One-off. Vacía el staging y el ledger de cargas antes de cargar
-- el primer archivo real.
-- NO toca schema, RPCs, RLS, profiles ni acceso_cartera.
-- NOTA: los archivos del bucket 'cartera' se limpian aparte vía
--       Storage API (delete directo en storage.objects no permitido):
--       scripts/limpiar-bucket.mjs cartera
-- ================================================================

-- 1) Staging primero (FK upload_id -> cartera_uploads)
delete from stg_yunius_cartera_individual;

-- 2) Ledger de cargas
delete from cartera_uploads;
