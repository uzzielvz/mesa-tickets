-- ================================================================
-- REC-022: id del empleado en Factorial (idempotencia del alta)
-- Al contratar a un candidato se crea su empleado en Factorial HR.
-- Guardamos aquí el id devuelto para no volver a crearlo si la
-- contratación se re-ejecuta (evita empleados duplicados).
-- NULL = todavía no se ha dado de alta en Factorial.
-- ================================================================

alter table rec_candidatos
  add column if not exists factorial_employee_id text;

comment on column rec_candidatos.factorial_employee_id is
  'id del empleado creado en Factorial HR al contratar (idempotencia del alta). NULL = sin alta.';
