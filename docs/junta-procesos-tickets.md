# Junta — Mapeo de procesos · Mesa de Tickets

> Guía de 1 página para la reunión. Objetivo: salir con los procesos mapeados y las prioridades ordenadas.

---

## 0. Antes de empezar — define el objetivo (1 frase)

> ¿Diseñamos para **impresionar en la demo** (Dupont) o para **uso diario real** del equipo?

`[ ] Demo`  `[ x] Uso diario`  → marca uno. Define qué es no-negociable. uso diario, pero obvio qu ele guste a dupond

---

## 1. Modelo: un proceso = el viaje de una incidencia

```
Disparador → Quién la levanta → Tipo/Área → A quién le llega →
Datos/evidencia que pide → Acciones para resolver →
Cómo se cierra → Qué pasa si NO se puede (rechazo / escala)
```

---

## 2. Tabla de captura (una fila por tipo de incidencia)

Pregunta por **casos reales de esta semana**, no por opiniones.

| # | Incidencia (qué reportan)            | ¿Quién la levanta?                                                                     | ¿Quién la atiende? | Datos/evidencia que pide                                                                                             | ¿Cómo se sabe que está resuelta?                                                                                                                  | ¿Urgente a veces? | #/semana |
| - | ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------- |
|   | FICHA NO REFLEJADA GRUPAL O COMERCIAL | EL ARE DE DIRECCION COMERICAL, DIRECTORA, GERENTE Y PROMOTOR SOLO EL GERENTE Y DIRECTORA | AREA DE TESORERIA    | id grupo, nombre del grupo, fecha ficha monto de la ficha, captura de pantallo o comprobante de pago,                | el area valia que existe e pago, se la cargan en la siguiente, se cargo, en resuelto, en proceso, rechazado, le pasa el spei, te lo acrgo o no esta. | urgente            |          |
| 2 | CREDITO FALTANTE                      | EL AREAC COMERCIAL/ CREDITO INDIVIDUAL                                                   | AREA DE TESORERIA    | ID CLIENTE/GRUPO, CICLO, Y FRCHA DE DESEMBOLSO, IMAGEN DE EVIDENCIA (cAPTURA PANTALLA DE CORREO QUE YA SE DSIPARSO)) | SE RECHAZA O SE ANADE                                                                                                                                | MEDIO              |          |
| 3 | ERROR EN MORA                         | INDIVIDUAL/GRUPAL                                                                        | AREA DE DTA          | ID CLIENTE/GRUPO, CICLO, REDACTAR LA DISCREPECIA, EVIDENCIA OPCIONAL                                                 | SE RESPONDE QUE ESTA EN MORA POR ESTO Y ESO O CNFIRMA EL ERROR Y POR AHORA                                                                           |                    |          |
| 4 |                                       | aq                                                                                       |                      |                                                                                                                      |                                                                                                                                                      |                    |          |
| 5 |                                       |                                                                                          |                      |                                                                                                                      |                                                                                                                                                      |                    |          |
| 6 |                                       |                                                                                          |                      |                                                                                                                      |                                                                                                                                                      |                    |          |
| 7 |                                       |                                                                                          |                      |                                                                                                                      |                                                                                                                                                      |                    |          |
| 8 |                                       |                                                                                          |                      |                                                                                                                      |                                                                                                                                                      |                    |          |

**Preguntas detonadoras:**

- "Dame un ejemplo de algo que reportaron esta semana."
- "¿A quién le tocó? ¿cómo se enteró?"
- "¿Qué necesitaba para resolverlo?"
- "¿Cómo cerraron? ¿quién dijo 'ya quedó'?"
- "¿Alguna vez se perdió o llegó tarde? ¿por qué?"

---

## 3. Ordenar — Paso A: procesos (cuáles soportar primero)

Regla: `Frecuencia × Dolor`. Lo que pasa mucho y duele mucho va primero.

| Incidencia | Frecuencia (1-5) | Dolor (1-5) | Total | Orden |
| ---------- | ---------------- | ----------- | ----- | ----- |
|            |                  |             |       |       |
|            |                  |             |       |       |
|            |                  |             |       |       |

---

## 4. Ordenar — Paso B: capacidades (qué construir)

Coloca cada capacidad en el cuadrante. Capacidades a evaluar:
**Notificaciones · Reasignación · Conversación libre · Búsqueda/filtros · Prioridad/SLA · Seguridad de escritura**

|                        | Esfuerzo BAJO | Esfuerzo ALTO |
| ---------------------- | ------------- | ------------- |
| **Impacto ALTO** | HAZLO YA:     | Planéalo:    |
| **Impacto BAJO** | Si sobra:     | Ignóralo:    |

---

## 5. Entregables — con esto debo salir de la junta

- [ ] **Lista de tipos de incidencia** ordenada (Paso A) → catálogo inicial
- [ ] **Campos obligatorios** por tipo → campos dinámicos del formulario
- [ ] **Ruteo**: qué incidencia → qué responsable/área
- [ ] **Definición de "resuelto"** por tipo → criterio de cierre
- [ ] **Qué urge vs. qué espera** → ¿prioridad/SLA es no-negociable?
- [ ] **Volumen semanal total** → ¿búsqueda/paginación urge?
- [ ] **Objetivo confirmado** (demo vs. uso diario)

---

## 6. Recordatorio de rigor

Cada requisito debe trazar a un **dolor observado** o una **necesidad declarada**, no a "el mercado lo trae". Marca cada uno: **Confirmado / Inferido / Supuesto**. Solo los Confirmados se construyen sin más validación.

*Ref: `RESEARCH-CONSOLIDADO.md` §5.1.2–5.1.6*
