-- REC-082 — Interruptor de sincronización con Factorial HR desde Ajustes.
-- El alta automática del empleado en Factorial (al contratar) es best-effort,
-- pero debe poder apagarse sin desplegar: mientras se valida contra producción
-- conviene tenerla OFF por defecto para no crear empleados reales por error.
--
-- Misma tabla key/value (rec_ajustes). Nueva clave `factorial` con { sync_activa }.
-- Arranca en false: la contratación sigue funcionando (correos incluidos) y el
-- operador la activa a propósito cuando confirme que el catálogo de Factorial
-- está listo.

insert into rec_ajustes (clave, valor) values
(
  'factorial',
  jsonb_build_object('sync_activa', false)
)
on conflict (clave) do nothing;
