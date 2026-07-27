-- REC-053 — S6: nuevo código de plantilla para el correo de bienvenida al contratar.
-- Va SOLO en esta migración: Postgres no permite usar un valor de enum recién
-- agregado dentro de la misma transacción (el seed va en rec_013).

alter type rec_plantilla_codigo add value if not exists 'bienvenida_contratacion';
