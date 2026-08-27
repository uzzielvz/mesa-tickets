# Pre-vuelo — Reclutamiento v1

> **Objetivo: encontrar lo que está ROTO antes de anunciar.** No es una demo ni una validación de usabilidad.
>
> Este módulo tiene todo el código escrito desde el 31 de julio y **jamás se ha ejercitado de punta a punta**: ninguno de sus 6 correos se ha visto llegar en un flujo real. Todo lo que sigue está declarado como funcional, pero **sin una sola evidencia**.
>
> Duración estimada: **45–60 min**. Contra **producción**. Requiere dos cuentas de correo.

---

## Criterio de go / no-go

Se anuncia cuando se cumplan **estas dos cosas**, no antes:

- [ ] **Los 6 correos aparecen en verde** en `/reclutamiento/correos`.
- [ ] **El magic link abrió sin sesión**, en ventana privada.

Cualquier otro hallazgo: se arregla, o se documenta como límite conocido en el runbook **antes** de mandar el anuncio. Lo que no se vale es anunciar y esperar a ver qué pasa.

---

## Antes de empezar

- [ ] **Dos correos a la mano.** Cuenta A = tú (será el "candidato" y un entrevistador). Cuenta B = una segunda cuenta que puedas abrir (el otro entrevistador). Pueden ser personales.
- [ ] **Un archivo PDF cualquiera** para usar como CV de prueba.
- [ ] **Una ventana privada / incógnito** lista — se necesita en el Bloque 3.
- [ ] Anota aquí lo que uses, para poder limpiar al final:
  - Cuenta A: `________________________`
  - Cuenta B: `________________________`
  - Vacante de prueba: `________________________`

> ⚠️ **La regla de oro de este pre-vuelo: ningún correo debe llegarle a una persona real de CrediFlexi.** Todos los destinatarios que toques durante la prueba se reemplazan por las cuentas A y B. Especialmente en el Bloque 5.

---

## Bloque 0 — Configuración y riesgos *(el más importante)*

Este bloque no prueba software: cierra los tres riesgos que convierten un lanzamiento en un incidente.

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 0.1 | Ir a `/reclutamiento/ajustes` | Carga sin errores | ☐ |
| 0.2 | Leer el bloque **Dirección General** | Correo, nombre y duración llenos. **¿Es el DG correcto hoy?** Anota si no: `__________` | ☐ |
| 0.3 | Leer los **7 destinatarios de altas** | Están sembrados con correos reales de CrediFlexi. **Confírmalos uno por uno: ¿es a quién debe llegarle hoy?** Cualquiera que ya no aplique, córrigelo ahora | ☐ |
| 0.4 | Ver el interruptor de **Factorial** | **APAGADO.** Si está encendido, apágalo antes de continuar — este pre-vuelo crearía un empleado real | ☐ |
| 0.5 | Abrir `/reclutamiento/agendar` y mirar el indicador de Google | Punto **verde**. Si está rojo, conectar antes de seguir | ☐ |
| 0.6 | **¿Con qué cuenta está conectado?** | Debe ser la institucional, no una personal. Si no lo sabes con certeza, reconecta desde `/api/google/conectar?uso=reclutamiento` y **elige la cuenta a propósito** | ☐ |
| 0.7 | Revisar el CC de la plantilla **Bienvenida** en Ajustes → Plantillas | Trae 3 empleados reales sembrados. Anótalos para no olvidarlos: `__________` | ☐ |

> **Sobre 0.7:** no hay que borrarlos si son correctos — el formulario de contratación muestra el CC y deja editarlo antes de enviar. Pero en el Bloque 5 los vas a sustituir por tus cuentas de prueba.

---

## Bloque 1 — Vacante y candidatos

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 1.1 | `Vacantes → Nueva`. Título: **"ZZZ Prueba de lanzamiento"** | Se crea, aparece en la lista | ☐ |
| 1.2 | `Candidatos → Nuevo`. Nombre "Prueba Uno", correo = **cuenta A**, vacante = la de prueba, adjunta el PDF | Se crea en etapa **Postulado**, el CV queda cargado | ☐ |
| 1.3 | Crear un segundo candidato "Prueba Dos", correo = **cuenta B** | Igual | ☐ |
| 1.4 | Abrir "Prueba Uno" y ver el CV | Se visualiza sin descargarlo | ☐ |
| 1.5 | Marcar **Resultado de la revisión = No viable** sin motivo, e intentar guardar | **Rechaza** pidiendo el motivo | ☐ |
| 1.6 | Cambiar a **Viable** y guardar | Guarda | ☐ |
| 1.7 | Ir al **Pipeline** | Ambos en su columna, con una línea que dice qué sigue | ☐ |
| 1.8 | Sin marcar viabilidad en "Prueba Dos", ver su tarjeta | Dice **"Falta definir la viabilidad del CV"** | ☐ |
| 1.9 | Marcar "Prueba Dos" como Viable y mover ambos a la etapa **Viable** | Ambos en la columna Viable | ☐ |

---

## Bloque 2 — Agendamiento *(el corazón del módulo)*

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 2.1 | `Agendar entrevistas`, elegir la vacante de prueba | Aparecen los 2 candidatos viables | ☐ |
| 2.2 | Seleccionar **Prueba Uno primero, Prueba Dos después** | El contador dice "2 seleccionados" | ☐ |
| 2.3 | Fecha = **hoy o mañana**. Hora = una cercana | — | ☐ |
| 2.4 | Entrevistadores: dejar **dos** — nombre + cuenta A, nombre + cuenta B. Quitar los demás | Se pueden quitar filas | ☐ |
| 2.5 | Mirar la **vista previa de la cascada** | 2 candidatos, bloques de 20 min, el 2º arranca 20 min después del 1º. Con 2 entrevistadores cada entrevista dura 40 min | ☐ |
| 2.6 | Marcar **pausa** después del candidato 1, de 15 min | La vista previa recorre al candidato 2 quince minutos | ☐ |
| 2.7 | Quitar la pausa y **Agendar** | Aparece el reporte candidato por candidato | ☐ |
| 2.8 | Leer el reporte | **2 candidatos, los tres indicadores en positivo** (evento, correo, transición). Anota cualquier error: `__________` | ☐ |

### Verificación en el mundo real — aquí es donde se prueba lo que nunca se ha probado

| # | Dónde mirar | Qué debe haber | OK |
|---|---|---|---|
| 2.9 | **Google Calendar** de la cuenta emisora | **2 eventos**, cada uno con liga de Meet y con candidato + los 2 entrevistadores invitados | ☐ |
| 2.10 | 📧 **Bandeja de la cuenta A** | Invitación de Calendar + correo de **su entrevista** con horario y liga de Meet | ☐ |
| 2.11 | 📧 **Bandeja de la cuenta B** | Lo mismo, con **su** horario (20 min después) | ☐ |
| 2.12 | 📧 Ambas bandejas | Correo de **agenda de la sesión** con la tabla de horarios y **los 2 CV adjuntos** | ☐ |
| 2.13 | 📧 Ambas bandejas | Correo aparte con **su liga personal de evaluación** | ☐ |
| 2.14 | **¿Desde qué dirección llegaron?** | La cuenta institucional. Si salió de una personal → **detente y arregla 0.6** | ☐ |
| 2.15 | Pipeline | Ambos candidatos en **Entrevistas agendadas** | ☐ |

> 📌 **2.10 a 2.14 son el punto crítico de todo el pre-vuelo.** Si los correos no llegan, no hay lanzamiento — hay un bug que arreglar. El módulo de Tickets tiene exactamente ese problema abierto ahorita.

---

## Bloque 3 — Evaluación por magic link *(sin sesión)*

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 3.1 | Copiar la liga del correo de la cuenta A y abrirla en **ventana privada** | Carga la página de evaluación **sin pedir login**. Esta es la prueba de que un entrevistador externo puede entrar | ☐ |
| 3.2 | Mirar qué muestra | Los 2 candidatos de la sesión y el nombre del entrevistador. **NO** debe mostrar CV, correo ni teléfono de los candidatos | ☐ |
| 3.3 | Intentar enviar sin elegir recomendación | No deja | ☐ |
| 3.4 | Calificar a **Prueba Uno**: Viable + comentario + puntaje | Guarda | ☐ |
| 3.5 | Calificar a **Prueba Dos**: No viable + comentario | Guarda | ☐ |
| 3.6 | Abrir la liga de la cuenta B en otra ventana privada | Ve los mismos candidatos, **pero no ve lo que calificó A** | ☐ |
| 3.7 | Calificar a Prueba Uno desde B también | Guarda | ☐ |
| 3.8 | Alterar un carácter del token en la URL y recargar | **"Liga no válida"**, no un error crudo | ☐ |
| 3.9 | Volver a tu sesión → `Comité` | Aparecen las evaluaciones de ambos entrevistadores | ☐ |
| 3.10 | Pipeline, tarjeta de Prueba Uno | Dice **"2 de 2 evaluaciones registradas"** | ☐ |

---

## Bloque 4 — Comité y Dirección General

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 4.1 | En `Comité`, escribir **notas del comité** para Prueba Uno y guardar | Persisten al recargar | ☐ |
| 4.2 | Mover **Prueba Uno** a Reunión de comité | Avanza | ☐ |
| 4.3 | **Antes de seguir:** en Ajustes, cambiar temporalmente el correo del DG a la **cuenta B** | Guarda | ☐ |
| 4.4 | Desde comité, **Agendar con la DG**: fecha y hora cercanas | Confirma y devuelve la liga de Meet | ☐ |
| 4.5 | **Google Calendar** | Evento "Entrevista Final (DG)" con candidato + DG invitados | ☐ |
| 4.6 | 📧 Bandeja de la cuenta A | Correo con la fecha y hora de su entrevista final | ☐ |
| 4.7 | Pipeline | Prueba Uno en **Final DG** | ☐ |
| 4.8 | Mover a **Oferta** | Avanza (puede advertir que la entrevista aún no ocurre — está bien) | ☐ |
| 4.9 | **Restaurar el correo real del DG en Ajustes** | ⚠️ No se te olvide | ☐ |

---

## Bloque 5 — Contratación *(máximo cuidado)*

> 🚨 **Aquí es donde se le puede mandar correo a media empresa por accidente.** Antes de tocar nada, sustituye TODOS los destinatarios por tus cuentas de prueba.

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 5.1 | En Prueba Uno (etapa Oferta), abrir **Configurar el alta** | Abre el formulario | ☐ |
| 5.2 | Marcar equipo (laptop + celular) y sistemas (**Yunius y HubSpot**) | — | ☐ |
| 5.3 | Poner fecha de inducción y una liga cualquiera | — | ☐ |
| 5.4 | **Sustituir los 7 destinatarios**: pon cuenta A o cuenta B en todos, y **deja uno vacío a propósito** | Guarda | ☐ |
| 5.5 | Intentar **Contratar** | Abre el formulario de contratación | ☐ |
| 5.6 | Ver el campo **CC** | Viene prellenado con los 3 correos reales de 0.7. **Bórralos y pon la cuenta B** | ☐ |
| 5.7 | Llenar fecha de ingreso, fecha límite de documentos, nombre y apellidos | — | ☐ |
| 5.8 | **Contratar** | Confirma. Prueba Uno queda en **Contratado** | ☐ |
| 5.9 | 📧 Bandeja de la cuenta A | Correo de **bienvenida**, con la cuenta B en copia | ☐ |
| 5.10 | Revisar los **adjuntos** de ese correo | **2 archivos**: el layout de datos personales (.xlsx) y los lineamientos de fotografías (.pdf). Si faltan, están ausentes en Storage → anótalo | ☐ |
| 5.11 | 📧 Bandeja(s) que pusiste como destinatarios | Correo interno **"Altas nuevo ingreso"** con la tabla de datos | ☐ |
| 5.12 | Leer las **tareas** de ese correo | Aparecen las de Yunius y HubSpot (los marcaste). **NO** aparece la del rol que dejaste vacío en 5.4 | ☐ |
| 5.13 | Confirmar que Factorial **no** hizo nada | El candidato no debe tener id de Factorial. El interruptor sigue apagado | ☐ |

---

## Bloque 6 — Bitácora y permisos

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 6.1 | Ir a `/reclutamiento/correos` | Lista con todos los envíos del pre-vuelo | ☐ |
| 6.2 | **Contar los tipos de correo en verde** | Los **6**: invitación al candidato, agenda a entrevistadores, liga de evaluación, pase a DG, bienvenida, altas | ☐ |
| 6.3 | Filtrar por **con error** | Idealmente vacío. Si hay algo, anota el mensaje literal: `__________` | ☐ |
| 6.4 | Con una cuenta **sin** el permiso `acceso_reclutamiento`, entrar a `/reclutamiento/vacantes` | **Redirige al dashboard.** No ve la sección en el menú | ☐ |
| 6.5 | Con esa misma cuenta, abrir un magic link de evaluación | **Sí funciona** — no depende del permiso | ☐ |

> **6.2 es la condición de go/no-go.** Seis tipos de correo en verde = el módulo hace lo que dice que hace.

---

## Bloque 7 — Limpieza

| # | Acción | OK |
|---|---|---|
| 7.1 | Confirmar que el correo del **DG está restaurado** en Ajustes (paso 4.9) | ☐ |
| 7.2 | Confirmar que los **7 destinatarios de altas** están en sus valores reales, no en tus cuentas de prueba | ☐ |
| 7.3 | Confirmar que el **CC de la plantilla de bienvenida** quedó como debe (si lo editaste en Ajustes y no solo en el formulario) | ☐ |
| 7.4 | Confirmar que **Factorial sigue apagado** | ☐ |
| 7.5 | **Cerrar** la vacante de prueba (`Estado → Cerrada`) y descartar sus candidatos con motivo *Otro*. ⚠️ **No se pueden borrar**: la v1 no tiene borrado de vacantes ni de candidatos desde la UI. Si necesitas eliminarlos de verdad, es por SQL | ☐ |
| 7.6 | Borrar de Google Calendar los eventos de prueba | ☐ |

> 7.1 a 7.4 no son opcionales. Dejar una configuración de prueba en producción es cómo el primer candidato real recibe un correo dirigido a tu cuenta personal.

---

## Hallazgos

### 🔴 Bloqueantes — impiden anunciar

```
(vacío)
```

### 🟡 Se arreglan después — se anuncia igual

```
(vacío)
```

### 🔵 Límites conocidos — van al runbook, no se arreglan

```
(vacío)
```

---

## Al terminar

- Si las dos casillas del **go / no-go** están marcadas → adelante con [`anuncio-lanzamiento.md`](./anuncio-lanzamiento.md).
- Si hay algo en 🔴 → se arregla primero. El anuncio espera.
- Todo lo que quede en 🔵 se copia al [`runbook-operacion.md §7`](./runbook-operacion.md) como riesgo abierto, para que no se pierda.

**Fecha de ejecución:** `____________`  ·  **Ejecutado por:** `____________`  ·  **Resultado:** ☐ GO ☐ NO-GO
