# Reclutamiento — Manual de uso

> **Para quien opera el módulo.** Versión 1.0 · 2026-08-24
>
> Este manual te lleva de principio a fin: desde dar de alta una vacante hasta contratar. No necesitas saber nada técnico.
>
> Si algo falla, salta a [§9 Cuando algo sale mal](#9-cuando-algo-sale-mal).

---

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [Cómo funciona el proceso](#2-cómo-funciona-el-proceso)
3. [Crear una vacante](#3-crear-una-vacante)
4. [Capturar candidatos](#4-capturar-candidatos)
5. [Revisar el CV y decidir viabilidad](#5-revisar-el-cv-y-decidir-viabilidad)
6. [Agendar las entrevistas](#6-agendar-las-entrevistas) ← *la pantalla más importante*
7. [Seguir las evaluaciones y el comité](#7-seguir-las-evaluaciones-y-el-comité)
8. [Entrevista con la Dirección General, alta y contratación](#8-entrevista-con-la-dirección-general-alta-y-contratación)
9. [Cuando algo sale mal](#9-cuando-algo-sale-mal)
10. [Sacar la información a Excel](#10-sacar-la-información-a-excel)
11. [Lo que puedes cambiar tú, sin pedirle nada a nadie](#11-lo-que-puedes-cambiar-tú-sin-pedirle-nada-a-nadie)
12. [Preguntas frecuentes](#12-preguntas-frecuentes)

---

## 1. Antes de empezar

**Cómo entrar.** Ingresas a la plataforma con tu correo `@financieracrediflexi.com`. En el menú de la izquierda aparece la sección **Reclutamiento**. Si no la ves, significa que tu usuario no tiene el permiso activado: pídeselo a quien administra la plataforma.

**Lo que hay que revisar una sola vez**, en `Reclutamiento → Ajustes`:

| Qué | Por qué importa |
|---|---|
| **Dirección General** — correo, nombre y duración de la entrevista | Sin el correo, el sistema **no te deja** pasar un candidato a entrevista final. |
| **Destinatarios de altas** — 7 correos | Definen a quién le llega el aviso automático cuando contratas. Cada tarea aparece en el correo **solo si su destinatario está lleno**. |
| **Plantillas de correo** — los 6 textos que el sistema envía | Cámbialos a tu gusto. Puedes hacerlo cuando quieras, no solo al inicio. |

**Una cosa más:** el módulo manda todos los correos desde una cuenta de Google conectada. Se verifica en `Reclutamiento → Agendar entrevistas`: arriba hay un indicador. Si el punto está en **verde**, todo listo. Si está en **rojo**, hay que conectarla con el botón *Conectar Google*.

> ⚠️ **Cuidado al reconectar.** Si tienes varias cuentas de Google abiertas en el navegador, la pantalla de Google puede tomar la que ya tienes activa sin preguntarte. Después de conectar, revisa que quedó la cuenta institucional y no tu cuenta personal — si queda la equivocada, los correos a candidatos saldrán desde ahí.

---

## 2. Cómo funciona el proceso

Un candidato pasa por estas etapas, **siempre hacia adelante y de una en una**:

```
Postulado → En revisión → Viable → Entrevistas agendadas → Reunión de comité
          → Final DG → Oferta → Contratado
```

En cualquier momento (menos ya contratado) puedes **descartarlo**, indicando el motivo.

**No se puede saltar etapas ni regresar.** Es a propósito: la etapa de un candidato es un dato del que dependen los correos que salen, y poder moverla libremente haría que el sistema mandara cosas fuera de lugar.

**Dónde ves todo junto:** en `Reclutamiento → Pipeline`, un tablero con una columna por etapa. Cada tarjeta te dice **qué es lo siguiente que hay que hacer** con ese candidato, y si está bloqueado, qué falta.

**Los correos que el sistema manda solo, sin que tú escribas nada:**

| Momento | Quién lo recibe |
|---|---|
| Al agendar entrevistas | El candidato (su horario y su liga de Meet) |
| Al agendar entrevistas | Los entrevistadores (la agenda completa + los CV adjuntos) |
| Al agendar entrevistas | Cada entrevistador por separado (su liga personal para calificar) |
| Al pasar a entrevista final | El candidato (fecha y hora con la Dirección General) |
| Al contratar | El candidato (bienvenida + formatos de ingreso adjuntos) |
| Al contratar | Las áreas internas (qué le toca dar de alta a cada quien) |

---

## 3. Crear una vacante

`Reclutamiento → Vacantes → Nueva vacante`

| Campo | Obligatorio | Nota |
|---|---|---|
| **Título de la vacante** | Sí | Mínimo 3 caracteres. Aparece en todos los correos al candidato. |
| **Área** | No | Aparece como "zona" en el correo interno de altas. |
| **Descripción** | No | Perfil, responsabilidades, requisitos. Uso interno. |
| **Estado de la vacante** | — | *Abierta* o *Cerrada*. Cerrarla no borra nada; solo la marca. |

---

## 4. Capturar candidatos

`Reclutamiento → Candidatos → Nuevo candidato`

| Campo | Obligatorio | Nota |
|---|---|---|
| **Nombre completo** | Sí | |
| **Correo** | No al capturar, **sí para avanzar** | Sin correo no se le puede agendar, ni pasar con la DG, ni contratar. Captúralo cuanto antes. |
| **Teléfono** | No | Aparece en el correo interno de altas. |
| **Vacante** | Sí | Un candidato pertenece a **una** vacante. |
| **Fuente** | No | OCC · Computrabajo · LinkedIn · Factorial · Captura manual. Sirve para saber después de dónde viene la mejor gente. |
| **CV** | No | PDF, DOC o DOCX, hasta 10 MB. Se adjunta solo al correo de agenda de los entrevistadores. |
| **Notas** | No | Observaciones internas. El candidato nunca las ve. |

El candidato nace en la etapa **Postulado**.

---

## 5. Revisar el CV y decidir viabilidad

Abre el candidato (desde `Candidatos` o dando clic en su tarjeta del pipeline). Ahí:

1. Puedes **ver el CV** sin descargarlo.
2. Llena **Resultado de la revisión**: *Viable* · *Parcial* · *No viable*.
   - Si eliges **No viable**, el sistema te pedirá el **Motivo del descarte** (no cumple el perfil, expectativa salarial, ubicación, experiencia insuficiente, no contestó, declinó, otro). Es obligatorio.
3. Con el resultado en **Viable**, el candidato ya puede avanzar a la etapa *Viable* desde el pipeline.

> Mientras el CV no esté marcado como *Viable*, la tarjeta del pipeline te dirá **"Falta definir la viabilidad del CV"** y no te dejará avanzar. Es la única forma de que nadie llegue a entrevistas sin haber sido revisado.

---

## 6. Agendar las entrevistas

`Reclutamiento → Agendar entrevistas`

Esta es la pantalla que más trabajo te ahorra. Con un solo formulario, el sistema crea **todas** las citas de Google Meet y manda **todos** los correos.

### 6.1 Qué llenas

| Campo | Qué hace |
|---|---|
| **Vacante** | Filtra los candidatos disponibles. |
| **Candidatos viables** | Solo aparecen los que están en etapa *Viable*. ⚠️ **El orden en que los seleccionas define el turno de cada uno.** El primero que marques entrevista primero. |
| **Fecha** y **Hora de inicio** | Cuándo arranca la sesión completa. |
| **Pausa** (opcional) | Marcas la casilla, indicas *después del candidato #* y *cuántos minutos*. Todos los candidatos posteriores se recorren. Útil para la comida. |
| **Entrevistadores** | Nombre y correo de cada uno. Puedes agregar o quitar los que quieras — no son tres fijos. |

### 6.2 Cómo se acomodan los horarios

Cada entrevistador habla con cada candidato **20 minutos**, y van rotando. Con 3 entrevistadores, cada candidato ocupa una hora, y los arranques se escalonan cada 20 minutos para que nadie tenga huecos:

| Candidato | Su entrevista | Entrevistador 1 | Entrevistador 2 | Entrevistador 3 |
|---|---|---|---|---|
| 1º | 09:00–10:00 | 09:00 | 09:20 | 09:40 |
| 2º | 09:20–10:20 | 09:20 | 09:40 | 10:00 |
| 3º | 09:40–10:40 | 09:40 | 10:00 | 10:20 |

**La pantalla te muestra la vista previa de estos horarios antes de ejecutar nada.** Revísala. Si algo no te cuadra, cambia la hora, la pausa o el orden de los candidatos, y la vista previa se recalcula.

### 6.3 Qué pasa cuando presionas agendar

Por cada candidato, el sistema:
1. Crea el evento en Google Calendar con su liga de Meet.
2. Invita al candidato y a todos los entrevistadores (les llega la invitación de Calendar).
3. Le manda al candidato su correo con horario y liga.
4. Lo mueve a la etapa **Entrevistas agendadas**.

Y al terminar con todos:
5. Manda a los entrevistadores la **agenda completa de la sesión, con los CV adjuntos**.
6. Manda a **cada entrevistador su liga personal** para calificar.

### 6.4 Cómo leer el resultado

Al terminar aparece un **reporte candidato por candidato**, con el horario que le tocó y si su evento, su correo y su cambio de etapa salieron bien.

Si algo aparece con error, el resto **sí se completó**. No tienes que rehacer todo: revisa `Correos enviados`, corrige la causa, y atiende solo ese caso.

---

## 7. Seguir las evaluaciones y el comité

### 7.1 Qué ve el entrevistador

Abre la liga de su correo y le aparece una página sencilla — **sin necesidad de cuenta ni contraseña**. Ve la lista de los candidatos que entrevistó y por cada uno registra:

- **Viable** / **No viable** / **Filtro DG**
- Comentarios
- Puntaje (opcional)

La liga **expira 8 días después de la fecha de la sesión**. Un entrevistador nunca ve los CV, los datos de contacto del candidato, ni lo que opinaron los demás.

### 7.2 Qué ves tú

En el **pipeline**, la tarjeta del candidato te dice cuántas evaluaciones llevas: *"2 de 3 evaluaciones registradas"*.

En `Reclutamiento → Comité`, ves todas las evaluaciones concentradas por candidato, y puedes escribir las **notas del comité**.

### 7.3 Pasar a comité

Requiere **al menos una** evaluación registrada. Si falta alguna, el sistema te avisa pero **te deja avanzar** — un entrevistador que nunca contesta no debe congelarte el proceso.

---

## 8. Entrevista con la Dirección General, alta y contratación

### 8.1 Agendar con la DG

Desde el candidato en etapa *Reunión de comité*, elige **Agendar con la DG** e indica fecha y hora.

El sistema crea el Meet con el candidato y el Director General, y le manda al candidato el correo con su cita. La duración sale de lo configurado en Ajustes.

**Te bloqueará si:** el candidato no tiene correo, no hay cuenta de Google conectada, o falta el correo del Director General en Ajustes. Te dirá cuál de los tres.

### 8.2 Después de la entrevista final

Mueve el candidato de *Final DG* a **Oferta**. Si la entrevista todavía no ocurre según la fecha que registraste, el sistema te lo advierte, pero puedes continuar.

### 8.3 Configurar el alta

En etapa *Oferta*, antes de contratar tienes que llenar la **configuración de alta**:

| Bloque | Qué defines |
|---|---|
| **Equipo** | Celular, laptop, desktop (los que apliquen). |
| **Sistemas** | Yunius, HubSpot, otros (con texto libre). |
| **Inducción** | Fecha y liga de la sesión. |
| **Destinatarios** | Los 7 correos que reciben el aviso. Vienen prellenados desde Ajustes y **los puedes ajustar para este candidato en particular**. |

Esto es lo que arma el correo interno: cada área recibe **solo la tarea que le toca**, y solo si marcaste ese sistema y llenaste ese destinatario.

### 8.4 Contratar

El último paso. Llenas:

- **Fecha de ingreso**
- **Fecha límite para entregar documentos**
- **Nombre y apellidos por separado**
- **CC del correo de bienvenida** — viene prellenado; **revísalo antes de enviar**, porque son personas reales que van a recibirlo

Al confirmar, el sistema:
1. Mueve al candidato a **Contratado**.
2. Le manda el correo de bienvenida con los formatos de ingreso adjuntos.
3. Manda el correo interno de altas a las áreas.

> **Importante:** si alguno de los dos correos falla, el candidato **igual queda contratado**. El sistema no deshace la contratación por un correo. Revisa `Correos enviados` después de contratar; si algo salió en rojo, mándalo tú a mano.

---

## 9. Cuando algo sale mal

### 9.1 Dónde mirar primero

`Reclutamiento → Correos enviados`. Lista todo lo que el sistema ha intentado mandar, con su estado. Puedes filtrar por **con error**. Cada fila con error guarda el mensaje exacto de lo que pasó.

### 9.2 Los mensajes que te puede dar el sistema

| Mensaje | Qué significa | Qué haces |
|---|---|---|
| **"La conexión con Google expiró"** | El permiso de Google caducó o fue revocado. | Ve a `Agendar entrevistas` → botón **Reconectar**. Verifica que quedó la cuenta institucional. |
| **"Conecta una cuenta de Google antes de…"** | No hay ninguna cuenta conectada. | Igual que arriba, con el botón **Conectar Google**. |
| **"El candidato no tiene correo registrado"** | Falta el correo. | Edita el candidato y captúralo. |
| **"Falta el correo del Director General"** | Ajustes incompleto. | `Ajustes → Dirección General`. |
| **"Falta la plantilla de…"** | La plantilla de ese correo está desactivada o borrada. | `Ajustes → Plantillas`. Si no puedes resolverlo, escala. |
| **"No se pudo crear el evento de Google Meet"** | Google rechazó la creación. Casi siempre es la conexión. | Reconecta e intenta otra vez. |
| **"Aún no hay ninguna evaluación registrada"** | Quieres pasar a comité sin que nadie haya calificado. | Espera, o reenvía la liga al entrevistador. |
| **Esta plantilla no conoce `{{algo}}`** | Escribiste una variable que no existe en el editor de plantillas. | Usa solo las variables que la propia pantalla lista. |

### 9.3 Si nada de esto aplica

Manda a quien da soporte de la plataforma: **qué estabas haciendo, qué candidato, y la captura de la fila con error** de `Correos enviados`. Con eso se diagnostica casi todo.

---

## 10. Sacar la información a Excel

Dos pantallas tienen un botón **Exportar CSV**. El archivo se descarga y se abre directo en Excel.

### Candidatos

`Reclutamiento → Candidatos → Exportar CSV`

Baja **los candidatos que estás viendo**: si tienes seleccionada una vacante y filtraste por una etapa, eso es lo que sale. Si quieres todos los de la vacante, quita el filtro de etapa antes de exportar.

Trae una fila por candidato con nombre, correo, teléfono, fuente, etapa, revisión de CV, motivo de descarte, si tiene CV cargado, cuándo cambió de etapa por última vez y cuándo se registró.

### Correos enviados

`Reclutamiento → Correos enviados → Exportar CSV`

Baja la bitácora de correos. Dos diferencias con lo que ves en pantalla, las dos a favor:

- La tabla muestra los últimos 200; **el archivo trae hasta 5,000**.
- La tabla corta el mensaje de error a dos líneas; **el archivo trae el error completo** que devolvió Gmail. Si estás averiguando por qué un correo no llegó, exporta y busca ahí.

Si tienes puesto el filtro *Con error* o *Enviados*, el archivo respeta ese filtro.

### Dos cosas que debes saber

**Cada exportación queda registrada.** El sistema guarda quién exportó, qué, con qué filtros y cuántas filas. No es para vigilarte: el archivo de candidatos lleva **datos personales de gente que no fue contratada**, y una vez que sale de la plataforma ya no hay permisos que lo protejan. El registro existe para que, si ese archivo aparece donde no debe, se sepa de dónde salió.

**Trátalo como lo que es.** No lo mandes por WhatsApp ni lo dejes en una carpeta compartida. Si ya no lo necesitas, bórralo.

---

## 11. Lo que puedes cambiar tú, sin pedirle nada a nadie

Todo esto se edita en `Reclutamiento → Ajustes` y **surte efecto de inmediato**. No hay que avisarle a nadie ni esperar una actualización del sistema.

| Puedes cambiar | Dónde |
|---|---|
| El texto y el asunto de los 6 correos | Ajustes → Plantillas |
| A quién le llega el correo interno de altas | Ajustes → Destinatarios de altas |
| Quién es el Director General y cuánto dura su entrevista | Ajustes → Dirección General |
| Quiénes entrevistan y cuántos son | En la pantalla de agendar, cada vez |
| Los destinatarios del alta de un candidato específico | En la configuración de alta de ese candidato |

**Sobre el editor de plantillas:** los textos usan variables entre llaves dobles, como `{{nombre_candidato}}`, que el sistema reemplaza al enviar. La pantalla te lista las disponibles para cada correo. Si escribes una que no existe, o borras una imprescindible, **no te deja guardar y te dice cuál es el problema** — no puedes romper un correo por accidente.

**Lo que no puedes cambiar tú** (requiere trabajo de desarrollo): las etapas del proceso, la duración de 20 minutos de los bloques de entrevista, y qué campos se capturan.

---

## 12. Preguntas frecuentes

**¿Puedo regresar a un candidato a una etapa anterior?**
No. El proceso solo avanza. Si te equivocaste de candidato, lo que procede es descartarlo con motivo *Otro* y volverlo a capturar.

**¿Qué pasa si un entrevistador nunca registra su evaluación?**
Nada se detiene. Puedes pasar a comité con las evaluaciones que tengas; el sistema solo te advierte cuántas faltan. Solo se bloquea si no hay **ninguna**.

**¿Puedo reenviar la liga de evaluación a un entrevistador?**
No hay un botón para eso en la v1. La liga está en el correo que ya recibió — lo más rápido es pedirle que lo busque. Si su liga ya expiró (8 días después de la sesión), hoy no hay forma de generar una nueva sin volver a agendar. Es un límite conocido de esta versión.

**¿Puedo sacar un reporte de cuánto tardamos en contratar, o cuántos candidatos se cayeron en cada etapa?**
Todavía no dentro de la plataforma. El sistema **sí está guardando** cada cambio de etapa con su fecha, así que el dato existe; lo que falta es la pantalla que lo grafique. Mientras tanto, el CSV de candidatos (sección 10) te da la etapa actual de cada quien.

**¿El candidato ve mis notas o el motivo del descarte?**
No. Todo eso es interno.

**¿Se le avisa automáticamente al candidato que fue descartado?**
No. El descarte no manda ningún correo. Si quieres avisarle, lo haces tú por fuera.

**¿Puedo usar el módulo para varias vacantes al mismo tiempo?**
Sí. Cada candidato pertenece a una vacante y las pantallas se filtran por vacante.

**¿Un candidato puede postularse a dos vacantes?**
En esta versión no: hay que capturarlo dos veces, una por vacante. Se resolverá cuando el volumen lo justifique.

**¿El empleado se da de alta solo en Factorial?**
**En esta versión no.** La función existe pero está apagada a propósito, porque todavía no se valida contra Factorial de producción. El alta se sigue haciendo a mano. Se encenderá cuando esté probada.

---

**Documentos relacionados**
- [`documentacion-funcional.md`](./documentacion-funcional.md) — cómo está construido el módulo y qué hace por dentro.
- [`runbook-operacion.md`](./runbook-operacion.md) — para quien da soporte técnico al módulo.
