-- ================================================================
-- LIMPIEZA: borra los tipos de problema de PRUEBA del seed inicial.
-- Deja solo los 3 validados en la junta de procesos
-- (Ficha no reflejada, Crédito faltante, Error en mora).
--
-- Tipos de prueba a eliminar (supabase/seed.sql):
--   1. Ticket no reflejado           (Crédito)
--   2. Error en monto de crédito     (Crédito)
--   3. Grupo no aparece en sistema   (Operaciones)
--   4. Acceso bloqueado al sistema   (Sistemas)
--
-- Guard: solo borra los que NO tengan tickets referenciándolos
-- (tickets.problem_catalog_id es FK NOT NULL con RESTRICT). Los
-- tickets de prueba ya se limpiaron pre go-live, así que deberían
-- eliminarse los 4. Si alguno tuviera tickets vivos, no se toca.
-- Idempotente: si ya no existen, no hace nada.
-- ================================================================

delete from problem_catalog pc
where pc.nombre in (
    'Ticket no reflejado',
    'Error en monto de crédito',
    'Grupo no aparece en sistema',
    'Acceso bloqueado al sistema'
  )
  and not exists (
    select 1 from tickets t where t.problem_catalog_id = pc.id
  );
