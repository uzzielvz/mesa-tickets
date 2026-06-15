-- ================================================================
-- CATÁLOGO: 3 tipos de incidencia confirmados en la junta de procesos
-- Ref: docs/junta-procesos-tickets.md §2 (casos reales capturados)
--   1. Ficha no reflejada (grupal/comercial)  -> Tesorería   (urgente)
--   2. Crédito faltante                       -> Tesorería   (media)
--   3. Error en mora                          -> Data Science
-- Responsable default: se asigna por email si el profile ya existe
-- (requiere primer login); si no, queda null y el ticket cae en el
-- levantador hasta configurarlo en /admin/catalogo.
-- Idempotente: no duplica si el tipo ya existe en el área.
-- ================================================================

-- 1) Ficha no reflejada — Tesorería
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, campos)
select
  (select id from areas where nombre = 'Tesorería'),
  'Ficha no reflejada (grupal/comercial)',
  'Pago de ficha realizado pero no reflejado en el sistema. La levantan gerentes de sucursal o la directora comercial. Adjunta captura de pantalla o comprobante del pago: Tesorería valida que el pago exista y carga la ficha, o rechaza indicando el motivo. Atención urgente.',
  true,
  '[
    {"key": "id_grupo", "label": "ID del grupo", "type": "text", "required": true, "placeholder": "Ej: GRP-1042"},
    {"key": "nombre_grupo", "label": "Nombre del grupo", "type": "text", "required": true, "placeholder": "Nombre completo del grupo"},
    {"key": "fecha_ficha", "label": "Fecha de la ficha", "type": "date", "required": true},
    {"key": "monto_ficha", "label": "Monto de la ficha (MXN)", "type": "number", "required": true, "placeholder": "Ej: 15400.00"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Ficha no reflejada (grupal/comercial)'
    and area_id = (select id from areas where nombre = 'Tesorería')
);

-- 2) Crédito faltante — Tesorería
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, campos)
select
  (select id from areas where nombre = 'Tesorería'),
  'Crédito faltante',
  'Crédito ya dispersado que no aparece en el sistema. La levanta el área Comercial o Crédito Individual. Adjunta captura del correo que confirma la dispersión: Tesorería lo añade o rechaza con motivo.',
  true,
  '[
    {"key": "id_cliente_grupo", "label": "ID de cliente o grupo", "type": "text", "required": true, "placeholder": "Ej: CLI-2210 o GRP-1042"},
    {"key": "ciclo", "label": "Ciclo", "type": "text", "required": true, "placeholder": "Ej: Ciclo 12"},
    {"key": "fecha_desembolso", "label": "Fecha de desembolso", "type": "date", "required": true}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Crédito faltante'
    and area_id = (select id from areas where nombre = 'Tesorería')
);

-- 3) Error en mora — Data Science
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, campos)
select
  (select id from areas where nombre = 'Data Science'),
  'Error en mora',
  'Discrepancia en el cálculo de mora de un cliente o grupo (individual o grupal). Describe la discrepancia con detalle; la evidencia es opcional. Data Science responde explicando por qué está en mora o confirma el error y lo corrige.',
  false,
  '[
    {"key": "id_cliente_grupo", "label": "ID de cliente o grupo", "type": "text", "required": true, "placeholder": "Ej: CLI-2210 o GRP-1042"},
    {"key": "ciclo", "label": "Ciclo", "type": "text", "required": true, "placeholder": "Ej: Ciclo 12"},
    {"key": "discrepancia", "label": "Descripción de la discrepancia", "type": "textarea", "required": true, "placeholder": "Qué cifra esperabas, qué cifra muestra el sistema y por qué crees que es un error"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Error en mora'
    and area_id = (select id from areas where nombre = 'Data Science')
);

-- 4) Responsables default (solo si la persona ya tiene profile)
update problem_catalog pc
set responsable_default_id = p.id
from profiles p
where p.email = 'heber.padilla@financieracrediflexi.com'
  and pc.responsable_default_id is null
  and pc.nombre in ('Ficha no reflejada (grupal/comercial)', 'Crédito faltante')
  and pc.area_id = (select id from areas where nombre = 'Tesorería');

update problem_catalog pc
set responsable_default_id = p.id
from profiles p
where p.email = 'felix.gutierrez@financieracrediflexi.com'
  and pc.responsable_default_id is null
  and pc.nombre = 'Error en mora'
  and pc.area_id = (select id from areas where nombre = 'Data Science');
