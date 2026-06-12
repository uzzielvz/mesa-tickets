-- ================================================================
-- LIMPIEZA PRE-GO-LIVE: borrar tickets de prueba
-- One-off. Elimina TODOS los tickets de prueba antes de producción.
-- NO toca areas, problem_catalog ni profiles.
-- NOTA: los archivos del bucket 'ticket-attachments' se limpian aparte
--       vía Storage API (delete directo en storage.objects no permitido).
-- ================================================================

-- 1) Tickets (la cascada elimina ticket_responses y ticket_attachments)
delete from tickets;

-- 2) Reiniciar la numeración para que el primer ticket real sea #1
alter sequence tickets_numero_seq restart with 1;
