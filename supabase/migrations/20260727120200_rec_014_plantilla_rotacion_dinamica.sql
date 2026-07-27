-- REC-056 — S6: entrevistadores dinámicos.
-- La plantilla agendamiento_fase2 hardcodeaba 3 entrevistadores
-- ({{entrevistador_1..3}} / {{hora_1..3}}); pasa a un placeholder único
-- {{rotacion_entrevistadores}} que el server action arma con N líneas.

update rec_plantillas_correo set cuerpo = $tpl$Estimado {{nombre_candidato}},
Buen día.

Con el gusto de saludarte, te confirmamos tu entrevista para la posición de {{vacante}} en Financiera Crediflexi.

Tu evaluación se llevará a cabo el {{fecha}}, de {{hora_inicio}} a {{hora_fin}}, por Google Meet: {{link_meet}}

Durante ese horario te entrevistarán las siguientes personas, que entrarán a la misma videollamada en este orden:
{{rotacion_entrevistadores}}

No abandones la videollamada entre entrevistas. Al finalizar la última, la persona que te esté entrevistando te indicará qué sigue en el proceso.

Te damos las siguientes sugerencias:
* Busca un lugar libre de distracciones.
* Tu lugar debe contar con luz y sonido adecuados.
* Cuenta con excelente servicio de internet (para evitar interferencias).
* Confirma tu asistencia cuando te llegue la invitación de Google Meet.
* Puntualidad.

Mucho éxito.

Saludos cordiales
Reclutamiento Crediflexi$tpl$
where codigo = 'agendamiento_fase2';
