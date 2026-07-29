-- REC-061 — S7: nuevo código de plantilla para el correo interno de altas
-- ("Altas Nuevos Ingresos", se dispara al contratar junto con la bienvenida).
-- Va SOLO en esta migración: Postgres no permite usar un valor de enum recién
-- agregado dentro de la misma transacción (el seed va en rec_017).

alter type rec_plantilla_codigo add value if not exists 'altas_nuevos_ingresos';
