-- REC-065 — S7: actualiza la plantilla 'altas_nuevos_ingresos' al formato real
-- que usa RH ("Altas Nuevo Ingreso"). Los datos básicos salen de sus placeholders
-- y las líneas de tarea por área se arman en la app según la config de alta
-- (equipo/sistemas/inducción/destinatarios) → placeholder {{tareas}}.

update rec_plantillas_correo set
  asunto = 'Altas nuevo ingreso — {{nombre_candidato}} ({{puesto}})',
  cuerpo = $tpl$Estimados,
Buenas tardes.

Solicito su apoyo para el alta del siguiente nuevo ingreso:

* Nombre: {{nombre_candidato}}
* Zona: {{zona}}
* Número: {{telefono}}
* Puesto: {{puesto}}
* Jefe directo: {{jefe_directo}}
* Fecha de inicio: {{fecha_ingreso}}
* Equipo asignado: {{equipo}}

{{tareas}}

Muchas gracias a todos por su valioso apoyo y que podamos contar con un proceso de inducción e integración a la compañía mejorado.

Saludos cordiales
Reclutamiento Crediflexi$tpl$
where codigo = 'altas_nuevos_ingresos';
