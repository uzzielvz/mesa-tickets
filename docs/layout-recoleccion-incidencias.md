# Layout de recolección — Incidencias por área

> **Qué es esto:** el molde de información que se recabará en las juntas con cada área para diseñar la mesa de tickets **a la medida**. Cada fila = un tipo de incidencia. Cada columna = un dato que necesitamos para construir su formulario, su ruteo y su criterio de cierre.
>
> **Cómo se usa:** en la junta con cada área se llena una fila por cada tipo de incidencia real (basado en casos de la semana, no en opiniones). Con eso se genera el catálogo y los campos dinámicos de cada formulario.

---

## 1. Modelo — el viaje de una incidencia

```
Disparador → Quién la levanta → Tipo/Área → A quién le llega →
Datos/evidencia que pide → Acciones para resolver →
Cómo se cierra → Qué pasa si NO se puede (rechazo / escala)
```

Todo lo que recabamos abajo describe ese viaje, paso por paso.

---

## 2. Diccionario de campos a recabar

### A. Identidad de la incidencia
| Campo | Qué capturamos | Por qué lo necesitamos |
|---|---|---|
| **Incidencia** | Nombre claro de lo que se reporta | Es el "tipo" del catálogo |
| **Área dueña** | Área a la que pertenece este tipo | Agrupa y rutea |
| **Disparador** | Qué hecho la origina | Ayuda a redactar la guía del formulario |

### B. Quién interviene
| Campo | Qué capturamos | Por qué lo necesitamos |
|---|---|---|
| **Quién la levanta** | Rol(es)/área que la reportan | Permisos de creación |
| **Quién la resuelve** | Área + responsable default | Ruteo y asignación automática |
| **Responsable de respaldo** *(opcional)* | Quién cubre si el dueño no está | Continuidad |

### C. Qué se necesita (alimenta los campos del formulario)
| Campo | Qué capturamos | Por qué lo necesitamos |
|---|---|---|
| **Datos obligatorios** | Lista de campos (ID, ciclo, fecha, monto…) | Campos dinámicos del formulario |
| **Evidencia** | ¿Requiere adjunto? ¿Cuál? | Activa/no el upload |
| **Sensibilidad / PII** | ¿Trae datos de cliente, montos, etc.? | Seguridad y seudonimización |
| **Dependencia externa** | ¿Necesita Yunius, SPEI, otra área? | Identifica obstáculos reales |

### D. Cómo se resuelve
| Campo | Qué capturamos | Por qué lo necesitamos |
|---|---|---|
| **Definición de "resuelto"** | Criterio exacto de cierre | Evita discusiones de "¿ya quedó?" |
| **Estados posibles** | En proceso / Resuelto / Rechazado / Escalado | Define el flujo del ticket |
| **Qué pasa si NO se puede** | Rechazo con motivo / a quién escala | Flujo alterno |

### E. Tiempo y prioridad
| Campo | Qué capturamos | Por qué lo necesitamos |
|---|---|---|
| **Tiempo de respuesta (SLA)** | Tiempo máximo esperado, en **horas hábiles** | Métrica de servicio (se afina después; por ahora solo registramos cuánto suele llevar) |
| **Prioridad (fija)** | Alta / Media / Baja | Orden visual en la bandeja |
| **Prioridad (calculada)** | Frecuencia (1-5) × Dolor (1-5) | Orden objetivo de qué soportar primero |

### F. Contexto y medición
| Campo | Qué capturamos | Por qué lo necesitamos |
|---|---|---|
| **# por semana** | Volumen real | ¿Urge búsqueda/paginación? Alimenta prioridad |
| **Cómo se hace HOY** | Correo / WhatsApp / llamada | Baseline "antes vs después" |
| **Estacionalidad / pico** *(opcional)* | ¿Se dispara fin de mes/semana? | Planeación de carga |
| **Impacto del dolor** *(opcional)* | Qué cuesta hoy no tenerlo (tiempo, dinero atorado, cliente molesto) | Justifica la priorización |

---

## 3. Tabla de captura (una fila por tipo de incidencia)

> Se llena en la junta de cada área. Abajo, las 3 incidencias **ya confirmadas** sirven de ejemplo del nivel de detalle esperado.

| # | Incidencia | Área dueña | Quién levanta | Quién resuelve | Datos obligatorios | Evidencia | Definición de "resuelto" | Qué pasa si NO | SLA (hrs háb.) | Prioridad | Frec.×Dolor | #/sem | Cómo se hace hoy | Dependencia | PII |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ficha no reflejada (grupal/comercial) | Tesorería | Gerente sucursal / Directora comercial | Tesorería (Heber Padilla) | ID grupo, nombre grupo, fecha ficha, monto | Captura/comprobante de pago (obligatoria) | Tesorería valida el pago y carga la ficha | Rechazo con motivo (no existe el SPEI) | _por definir_ | Alta | _×_ | _?_ | _por definir_ | SPEI / Yunius | Sí (monto, grupo) |
| 2 | Crédito faltante | Tesorería | Comercial / Crédito Individual | Tesorería (Heber Padilla) | ID cliente/grupo, ciclo, fecha desembolso | Captura del correo de dispersión (obligatoria) | Tesorería lo añade al sistema | Rechazo con motivo | _por definir_ | Media | _×_ | _?_ | _por definir_ | Yunius | Sí (cliente) |
| 3 | Error en mora | Data Science | Individual / Grupal | Data Science (Félix Gutiérrez) | ID cliente/grupo, ciclo, descripción de discrepancia | Opcional | DS explica el porqué de la mora o confirma y corrige el error | Se responde explicando por qué sí está en mora | _por definir_ | _por definir_ | _×_ | _?_ | _por definir_ | Cartera / Yunius | Sí (cliente) |
| 4 | | | | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | | | | |

---

## 4. Escalas de referencia

**Prioridad fija** — para el orden visual en la bandeja:
- **Alta**: bloquea operación o afecta dinero/cliente hoy.
- **Media**: importante pero tolera unas horas.
- **Baja**: puede esperar al siguiente ciclo.

**Prioridad calculada** — `Frecuencia (1-5) × Dolor (1-5)` para decidir qué soportar primero (lo que pasa mucho y duele mucho gana).

**SLA** — se registra en **horas hábiles**. Por ahora solo medimos cuánto lleva realmente; el compromiso formal de tiempo se afinará después.

---

## 5. Preguntas detonadoras (para las juntas con cada área)

- "Dame un ejemplo de algo que reportaron esta semana."
- "¿A quién le tocó? ¿cómo se enteró?"
- "¿Qué necesitaba para resolverlo?"
- "¿Cómo cerraron? ¿quién dijo 'ya quedó'?"
- "¿Alguna vez se perdió o llegó tarde? ¿por qué?"
- "¿De qué otro sistema o área dependió?"

---

## 6. Rigor

Cada campo recabado se marca como **Confirmado / Inferido / Supuesto**. Solo los **Confirmados** se construyen sin más validación.

*Ref: `docs/junta-procesos-tickets.md`, `RESEARCH-CONSOLIDADO.md` §5.1.2–5.1.6*
