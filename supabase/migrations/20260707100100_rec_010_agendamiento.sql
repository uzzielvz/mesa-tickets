-- REC-026 — Agendamiento masivo de entrevistas Fase 2 (S4).
-- 1) Parámetros de la sesión: hora de inicio, duración de bloque, pausa opcional
--    y los 3 entrevistadores (jsonb [{nombre, email}] en orden de rotación).
-- 2) meet_url en rec_entrevistas (liga única de Meet por candidato).
-- 3) Seed de plantillas de correo:
--    - agendamiento_fase2: invitación al candidato (PROPUESTA, validar con Héctor).
--    - agenda_entrevistadores: adaptación del correo literal del 11-jun-2026.
--    - pase_fase3: literal del correo del 24-abr-2026 (dispara en otro sprint).
--
-- Mecánica de la cascada (junta RH 24-jun-2026):
--   cada candidato tiene UNA liga de Meet de 60 min; los 3 entrevistadores rotan
--   en bloques de 20 min (Benny 0-20, Maritere 20-40, Sergio 40-60) y los arranques
--   entre candidatos se escalonan 20 min. Pausa opcional después del candidato N.

alter table rec_sesiones_entrevistas
  add column if not exists hora_inicio         time,
  add column if not exists duracion_bloque_min smallint not null default 20,
  add column if not exists pausa_despues_de    smallint,
  add column if not exists pausa_minutos       smallint,
  add column if not exists entrevistadores     jsonb;

alter table rec_entrevistas
  add column if not exists meet_url text;

-- ── Plantillas ──────────────────────────────────────────────────────────────

insert into rec_plantillas_correo (codigo, asunto, cuerpo) values
(
  'agendamiento_fase2',
  'Entrevista {{vacante}} / {{fecha}} {{hora_inicio}}',
  $tpl$Estimado {{nombre_candidato}},
Buen día.

Con el gusto de saludarte, te confirmamos tu entrevista para la posición de {{vacante}} en Financiera Crediflexi.

Tu evaluación se llevará a cabo el {{fecha}}, de {{hora_inicio}} a {{hora_fin}}, por Google Meet: {{link_meet}}

Durante ese horario te entrevistarán tres personas que entrarán a la misma videollamada en el siguiente orden:
* {{entrevistador_1}} — {{hora_1}}
* {{entrevistador_2}} — {{hora_2}}
* {{entrevistador_3}} — {{hora_3}}

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
),
(
  'agenda_entrevistadores',
  'Agenda Entrevistas {{fecha}}',
  $tpl$Estimados {{nombres_entrevistadores}},
Buen día.

Por este conducto, les hago el envío de la agenda del {{fecha}} para las entrevistas de la posición de "{{vacante}}".

{{descripcion_sesion}}

Tomen notas de sus candidatos por favor.

Esta es la agenda; en cada invitación de Google Meet viene la distribución de cada uno de ustedes con el horario asignado para cada candidato.

{{tabla_agenda}}

Saludos cordiales
Reclutamiento Crediflexi$tpl$
),
(
  'pase_fase3',
  'Entrevista Final / {{fecha_hora}}',
  $tpl$Estimado {{nombre_candidato}},
Buenas Tardes.

Con el gusto de saludarte, es nuestro agrado comunicarte que has pasado a la etapa final del Proceso, esta etapa comprende una entrevista con el Director General de la Compañía, Lic. Javier Vargas C.

La entrevista será virtual, te damos las siguientes sugerencias.
* Busca un lugar libre de distracciones.
* Tu lugar debe contar con luz y sonido adecuados para tu entrevista.
* Contar con excelente servicio de red de internet (para evitar interferencias).
* Confirma tu entrevista cuando te llegue la invitación por Google meet.
* Puntualidad.

Mucho éxito.

Saludos cordiales
Reclutamiento Crediflexi$tpl$
)
on conflict (codigo) do update set
  asunto = excluded.asunto,
  cuerpo = excluded.cuerpo;
