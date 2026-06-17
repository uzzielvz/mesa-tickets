-- Trazabilidad del procesamiento: además de "quién subió" (subido_por), ahora
-- registramos "quién procesó" el reporte y cuándo terminó el ETL.
alter table cartera_uploads
  add column procesado_por uuid references auth.users(id),
  add column procesado_at  timestamptz;

comment on column cartera_uploads.subido_por    is 'Usuario que subió el archivo a Storage.';
comment on column cartera_uploads.procesado_por is 'Usuario que ejecutó el procesamiento (ETL) de este reporte.';
comment on column cartera_uploads.procesado_at  is 'Momento en que finalizó el procesamiento.';
