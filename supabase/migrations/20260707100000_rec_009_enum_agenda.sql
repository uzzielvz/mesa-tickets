-- REC-026 — Nuevo código de plantilla para el correo de agenda a entrevistadores
-- (el correo "Agenda Entrevistas ..." que Héctor manda a Benny/Maritere/Sergio).
-- Va en su propia migración: un valor nuevo de enum no puede usarse en la misma
-- transacción en la que se crea.

alter type rec_plantilla_codigo add value if not exists 'agenda_entrevistadores';
