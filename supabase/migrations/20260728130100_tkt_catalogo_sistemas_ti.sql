-- ================================================================
-- TKT-024 — Catálogo del área Sistemas/TI (6 incidencias reales)
-- ================================================================
-- Reusa el área 'Sistemas' (ya creada en 20260612160000). Cada tipo
-- lleva prioridad / sla_min / modalidad (TKT-023) y campos dinámicos:
--   - 'subtipo': select con las opciones del "¿Qué engloba?" (guía al usuario)
--   - 'ubicacion': solo en tipos presencial/ambas (requerido si es presencial)
-- Responsable default: uzziel.valdez@financieracrediflexi.com (si ya tiene
-- profile; si no, queda null y se configura en /admin/catalogo).
-- Idempotente: no duplica si el tipo ya existe en el área.
-- Ref: PLAN.md §2.2 (Fase Tickets-Catálogo Sistemas/TI)

-- Asegura el área (defensivo; ya existe en producción)
insert into areas (nombre) values ('Sistemas')
on conflict (nombre) do nothing;

-- 1) Soporte a equipo de cómputo — Media — 30 min — Ambas
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, prioridad, sla_min, modalidad, campos)
select
  (select id from areas where nombre = 'Sistemas'),
  'Soporte a equipo de cómputo',
  'Problemas con tu equipo: lento, no enciende, instalación o configuración de software, o periféricos (mouse, teclado, monitor). Elige qué necesitas y describe el detalle. Se puede atender en remoto o de forma presencial.',
  false,
  'media', 30, 'ambas',
  '[
    {"key": "subtipo", "label": "¿Qué necesitas?", "type": "select", "required": true, "options": ["Equipo lento", "No enciende", "Instalación de software", "Configuración de equipo", "Mouse, teclado, monitor u otro periférico"]},
    {"key": "equipo", "label": "Equipo afectado", "type": "text", "required": false, "placeholder": "Nombre, etiqueta o número de inventario del equipo"},
    {"key": "ubicacion", "label": "Ubicación (si requiere visita)", "type": "text", "required": false, "placeholder": "Sucursal / piso / área donde está el equipo"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Soporte a equipo de cómputo'
    and area_id = (select id from areas where nombre = 'Sistemas')
);

-- 2) Problemas de red — Alta — 30 min — Ambas
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, prioridad, sla_min, modalidad, campos)
select
  (select id from areas where nombre = 'Sistemas'),
  'Problemas de red',
  'Fallas de conectividad: internet, WiFi, carpetas compartidas, servidor o recursos de red. Elige el tipo de falla y describe desde cuándo y a quién afecta. Prioridad alta.',
  false,
  'alta', 30, 'ambas',
  '[
    {"key": "subtipo", "label": "¿Qué falla?", "type": "select", "required": true, "options": ["Internet", "WiFi", "Carpetas compartidas", "Servidor", "Recursos de red"]},
    {"key": "ubicacion", "label": "Ubicación (si requiere visita)", "type": "text", "required": false, "placeholder": "Sucursal / piso / área afectada"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Problemas de red'
    and area_id = (select id from areas where nombre = 'Sistemas')
);

-- 3) Impresoras y escáneres — Media — 30 min — Ambas
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, prioridad, sla_min, modalidad, campos)
select
  (select id from areas where nombre = 'Sistemas'),
  'Impresoras y escáneres',
  'La impresora no imprime, el escáner no escanea, o necesitas una instalación o cambio de consumibles. Elige qué necesitas e indica el modelo del equipo.',
  false,
  'media', 30, 'ambas',
  '[
    {"key": "subtipo", "label": "¿Qué necesitas?", "type": "select", "required": true, "options": ["No imprime", "No escanea", "Instalación", "Cambio de consumibles"]},
    {"key": "equipo", "label": "Modelo del equipo", "type": "text", "required": false, "placeholder": "Modelo de la impresora o escáner"},
    {"key": "ubicacion", "label": "Ubicación (si requiere visita)", "type": "text", "required": false, "placeholder": "Sucursal / piso / área donde está el equipo"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Impresoras y escáneres'
    and area_id = (select id from areas where nombre = 'Sistemas')
);

-- 4) Usuarios y accesos — Media — 20 min — Remoto
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, prioridad, sla_min, modalidad, campos)
select
  (select id from areas where nombre = 'Sistemas'),
  'Usuarios y accesos',
  'Alta/baja de usuarios, contraseñas, permisos, Google Workspace, alta en la App de Asistencias o problemas con cualquier aplicación (Yunius, Office, etc.). Elige el tipo de solicitud e indica la aplicación y el usuario afectado si aplica. Se atiende en remoto.',
  false,
  'media', 20, 'remoto',
  '[
    {"key": "subtipo", "label": "¿Qué necesitas?", "type": "select", "required": true, "options": ["Alta o baja de usuario", "Contraseña", "Permisos", "Google Workspace", "Alta en App de Asistencias", "Problema con una aplicación (Yunius, Office, etc.)"]},
    {"key": "aplicacion", "label": "Aplicación o sistema", "type": "text", "required": false, "placeholder": "Aplicación o sistema afectado (si aplica)"},
    {"key": "usuario_afectado", "label": "Usuario afectado", "type": "text", "required": false, "placeholder": "Correo o usuario afectado (si es distinto al tuyo)"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Usuarios y accesos'
    and area_id = (select id from areas where nombre = 'Sistemas')
);

-- 5) Cámaras y alarmas — Alta — 60 min — Presencial
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, prioridad, sla_min, modalidad, campos)
select
  (select id from areas where nombre = 'Sistemas'),
  'Cámaras y alarmas',
  'Fallas en el sistema de CCTV y seguridad (Hikvision), cámaras o alarmas. Indica dónde está el equipo: la atención es presencial. Prioridad alta.',
  false,
  'alta', 60, 'presencial',
  '[
    {"key": "subtipo", "label": "¿Qué falla?", "type": "select", "required": true, "options": ["Hikvision (DVR/NVR)", "Cámara", "Alarma"]},
    {"key": "ubicacion", "label": "Ubicación del equipo", "type": "text", "required": true, "placeholder": "Sucursal / punto donde está la cámara o alarma"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Cámaras y alarmas'
    and area_id = (select id from areas where nombre = 'Sistemas')
);

-- 6) Solicitud de servicio de TI — Baja — Variable — Ambas
insert into problem_catalog (area_id, nombre, leyenda, requiere_evidencia, prioridad, sla_min, modalidad, campos)
select
  (select id from areas where nombre = 'Sistemas'),
  'Solicitud de servicio de TI',
  'Cualquier otra solicitud de servicio de TI que no encaje en las categorías anteriores. Describe con detalle qué necesitas; el tiempo de atención es variable según el caso.',
  false,
  'baja', null, 'ambas',
  '[
    {"key": "descripcion", "label": "¿Qué servicio necesitas?", "type": "textarea", "required": true, "placeholder": "Describe con detalle el servicio de TI que solicitas"},
    {"key": "ubicacion", "label": "Ubicación (si aplica)", "type": "text", "required": false, "placeholder": "Sucursal / piso / área"}
  ]'::jsonb
where not exists (
  select 1 from problem_catalog
  where nombre = 'Solicitud de servicio de TI'
    and area_id = (select id from areas where nombre = 'Sistemas')
);

-- Responsable default de las 6 incidencias (solo si el profile ya existe)
update problem_catalog pc
set responsable_default_id = p.id
from profiles p
where p.email = 'uzziel.valdez@financieracrediflexi.com'
  and pc.responsable_default_id is null
  and pc.area_id = (select id from areas where nombre = 'Sistemas')
  and pc.nombre in (
    'Soporte a equipo de cómputo',
    'Problemas de red',
    'Impresoras y escáneres',
    'Usuarios y accesos',
    'Cámaras y alarmas',
    'Solicitud de servicio de TI'
  );
