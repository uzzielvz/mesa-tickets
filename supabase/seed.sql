-- Seed: datos iniciales para demo

-- Áreas
insert into areas (id, nombre) values
  ('a1000000-0000-0000-0000-000000000001', 'Operaciones'),
  ('a1000000-0000-0000-0000-000000000002', 'Crédito'),
  ('a1000000-0000-0000-0000-000000000003', 'Sistemas');

-- Catálogo de problemas (se agrega responsable_default_id después de crear usuarios)
insert into problem_catalog (area_id, nombre, leyenda, requiere_grupo, requiere_cliente, requiere_ciclo, requiere_evidencia) values
  (
    'a1000000-0000-0000-0000-000000000002',
    'Ticket no reflejado',
    'El pago del cliente fue realizado pero no aparece reflejado en el sistema. Antes de levantar este ticket, verifica que hayan pasado al menos 24 horas desde el pago y que cuentes con el comprobante de transacción.',
    true, true, true, true
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'Error en monto de crédito',
    'El monto autorizado o desembolsado no coincide con lo aprobado en el expediente. Adjunta el contrato firmado y la pantalla del sistema mostrando el monto incorrecto.',
    true, true, false, true
  ),
  (
    'a1000000-0000-0000-0000-000000000001',
    'Grupo no aparece en sistema',
    'El grupo de ahorro no está visible en el panel de operaciones. Proporciona el nombre exacto del grupo y la fecha en que fue registrado.',
    true, false, false, false
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'Acceso bloqueado al sistema',
    'El usuario no puede ingresar al sistema operativo. Indica desde cuándo ocurre el problema y si hay algún mensaje de error visible.',
    false, false, false, false
  );
