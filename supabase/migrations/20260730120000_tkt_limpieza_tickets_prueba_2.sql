-- ================================================================
-- LIMPIEZA: borrar tickets de prueba (2a ronda)
-- Tickets creados al probar el catálogo Sistemas/TI. Todos eran pruebas.
-- Elimina TODOS los tickets y reinicia la numeración.
-- NO toca areas, problem_catalog ni profiles.
-- NOTA: los archivos del bucket 'ticket-attachments' se limpian aparte
--       vía Storage API (delete directo en storage.objects no permitido).
-- ================================================================

-- 1) Tickets (la cascada elimina ticket_responses y ticket_attachments)
delete from tickets;

-- 2) Reiniciar la numeración para que el primer ticket real sea #1
alter sequence tickets_numero_seq restart with 1;
