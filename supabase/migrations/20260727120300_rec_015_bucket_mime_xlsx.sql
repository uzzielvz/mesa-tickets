-- REC-060 — El correo de bienvenida adjunta el Layout de Datos Personales (.xlsx),
-- pero el bucket 'reclutamiento' sólo aceptaba PDF/DOC/DOCX. Se agrega el mime
-- type de xlsx para permitir subir esa plantilla al bucket.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'reclutamiento';
