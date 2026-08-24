# Reclutamiento v1 — Documentación funcional

> **Versión:** 1.0 · **Fecha:** 2026-08-24 · **Estado:** en lanzamiento
> Módulo de la Plataforma de Operaciones CrediFlexi. Sustituye el flujo de Excel + correo manual del proceso de contratación.
>
> Este documento describe **qué hace el módulo y cómo está construido**. Para el paso a paso de uso, ver [`manual-usuario.md`](./manual-usuario.md). Para validarlo antes de anunciarlo, ver [`prevuelo-lanzamiento.md`](./prevuelo-lanzamiento.md).

---

## 1. En una frase

Reclutamiento lleva a un candidato de **postulado a contratado** dentro de la plataforma, generando por sí solo las ligas de Google Meet, los correos a candidatos y entrevistadores, las ligas de evaluación y el correo interno de altas — sin retranscribir nada a Excel.

---

## 2. Qué problema resuelve

| Antes | Ahora |
|---|---|
| El Gerente de RH lleva el proceso en un Excel personal. | El pipeline vive en la plataforma, visible para quien tenga acceso. |
| Agendar una sesión de entrevistas = crear a mano un Meet por candidato y escribir un correo por candidato y por entrevistador. | Un formulario: se eligen candidatos, fecha y entrevistadores, y el sistema crea todos los Meets y manda todos los correos. |
| Los entrevistadores mandan su opinión por WhatsApp o correo, y alguien la concentra. | Cada entrevistador recibe **su liga personal** y captura su evaluación; queda registrada contra el candidato. |
| El aviso de alta a las áreas (correo, Yunius, HubSpot, inducción, jefe directo) se escribe a mano cada vez. | Se genera solo al contratar, con las tareas que correspondan según lo configurado. |
| Nadie sabe si un correo salió. | Bitácora `Correos enviados` con estado, fecha y el error exacto cuando falla. |

---

## 3. El pipeline

Nueve etapas. **Solo se avanza hacia adelante, un paso a la vez**; no se puede saltar ni retroceder. `Contratado` y `Descartado` son terminales.

```
Postulado → En revisión → Viable → Entrevistas agendadas → Reunión de comité
          → Final DG → Oferta → Contratado

  cualquier etapa no terminal → Descartado  (exige motivo)
```

Cada cambio de etapa se registra en `rec_candidato_historial`.

### Qué desencadena cada paso

| Transición | Qué hace el sistema | Correos que salen |
|---|---|---|
| Postulado → En revisión | Nada más que mover. | — |
| En revisión → Viable | Requiere que el CV esté marcado **Viable**. | — |
| Viable → Entrevistas agendadas | **La automatiza el agendamiento.** Crea un Meet por candidato, invita a candidato + entrevistadores, guarda la liga y genera un magic link por entrevistador. | `agendamiento_fase2` (a cada candidato), `agenda_entrevistadores` (a los entrevistadores, con los CV adjuntos), `notificacion_entrevistador` (liga personal de evaluación, uno por entrevistador) |
| Entrevistas agendadas → Reunión de comité | Bloqueado si hay **cero** evaluaciones; con evaluaciones parciales solo advierte. | — |
| Reunión de comité → Final DG | Crea el Meet con la Dirección General y el candidato. | `pase_fase3` (al candidato) |
| Final DG → Oferta | Nada más que mover. Advierte si la entrevista con la DG aún no ocurre. | — |
| Oferta → Contratado | Exige **configurar el alta** primero (equipo, sistemas, inducción, destinatarios). | `bienvenida_contratacion` (al candidato, con formatos adjuntos + CC), `altas_nuevos_ingresos` (interno, a las áreas) |

**Principio de diseño:** la fricción es proporcional al efecto. Todo paso que manda correo exige un formulario y una confirmación explícita; los pasos que no mandan nada son de un clic.

---

## 4. Pantallas

Todas cuelgan de la sección **Reclutamiento** del menú lateral.

| Pantalla | Ruta | Para qué |
|---|---|---|
| Vacantes | `/reclutamiento/vacantes` | Alta y edición de vacantes (título, área, descripción, abierta/cerrada). |
| Candidatos | `/reclutamiento/candidatos` | Listado, alta, edición, carga de CV, revisión de CV, descarte con motivo. |
| Pipeline | `/reclutamiento/pipeline` | Tablero kanban por etapa. Cada tarjeta dice qué es lo siguiente y qué falta si está bloqueada. |
| Agendar entrevistas | `/reclutamiento/agendar` | El agendamiento masivo en cascada. También es donde se conecta/reconecta la cuenta de Google. |
| Comité | `/reclutamiento/comite` | Evaluaciones concentradas por candidato, notas del comité, pase a DG, configuración de alta y contratación. |
| Correos enviados | `/reclutamiento/correos` | Bitácora de todo lo enviado, filtrable por enviado / con error. |
| Ajustes | `/reclutamiento/ajustes` | Dirección General, destinatarios del correo de altas, plantillas de correo editables, interruptor de Factorial. |
| Evaluación (pública) | `/evaluar/[token]` | Lo que abre el entrevistador desde su correo. **Sin sesión.** |

---

## 5. El agendamiento en cascada

Es la funcionalidad estrella y la que más tiempo ahorra.

**Entrada:** vacante · candidatos en etapa Viable (**el orden de selección define el turno**) · fecha · hora de inicio · pausa opcional después del candidato N · lista de entrevistadores (nombre + correo, N configurables).

**Cálculo:** bloques de **20 minutos** por entrevistador. Cada candidato ocupa `20 × N` minutos (con 3 entrevistadores = 60 min) y los arranques se escalonan 20 minutos entre candidatos, de modo que los entrevistadores rotan sin huecos. La pausa opcional recorre a todos los candidatos posteriores.

Ejemplo con 3 candidatos y 3 entrevistadores desde las 09:00:

| Candidato | Entrevista | Bloque 1 | Bloque 2 | Bloque 3 |
|---|---|---|---|---|
| 1º | 09:00–10:00 | 09:00 | 09:20 | 09:40 |
| 2º | 09:20–10:20 | 09:20 | 09:40 | 10:00 |
| 3º | 09:40–10:40 | 09:40 | 10:00 | 10:20 |

La pantalla muestra **vista previa de la cascada antes de ejecutar**.

**Qué hace por cada candidato:** crea el evento de Calendar con liga de Meet (`conferenceDataVersion=1`, invita al candidato y a los entrevistadores con `sendUpdates=all`), guarda `gcal_event_id` y `meet_url`, envía el correo de invitación, registra en la bitácora y transiciona la etapa.

**Al final:** un correo de agenda consolidada a los entrevistadores con la tabla de horarios y los CV adjuntos, y **un correo individual por entrevistador con su magic link**.

**Tolerancia a fallos:** el resultado se reporta candidato por candidato (evento / correo / transición). Que falle la agenda consolidada o un magic link **no aborta** el agendamiento; se ve en la bitácora y se puede reintentar.

---

## 6. Evaluaciones por magic link

- El entrevistador **no necesita cuenta ni contraseña**. Recibe una liga única.
- Un token da acceso a **todas** las evaluaciones de esa sesión para ese entrevistador — 1 correo, no uno por candidato.
- Token de 32 bytes aleatorios (`base64url`). **Expira a los 8 días** contados desde la fecha de la sesión.
- Captura: recomendación (**Viable / No viable / Filtro DG**) + comentarios + puntaje opcional.
- La ruta pública está **fuera del dashboard y excluida del middleware** de dominio, para que entren entrevistadores que no son `@financieracrediflexi.com`.
- La RPC `rec_sesion_por_token` es `security definer`: **nunca expone CVs, correos de candidatos ni las evaluaciones de otros entrevistadores**.

---

## 7. Los seis correos

Todos se envían con la cuenta de Google conectada al módulo, vía Gmail API. **Los seis son editables** desde `Ajustes → Plantillas` (asunto, cuerpo y, donde aplica, CC).

| Plantilla | Cuándo sale | A quién | CC editable |
|---|---|---|---|
| `agendamiento_fase2` | Al agendar | Cada candidato | No |
| `agenda_entrevistadores` | Al agendar | Los entrevistadores (con CV adjuntos) | No |
| `notificacion_entrevistador` | Al agendar | Cada entrevistador (liga personal) | No |
| `pase_fase3` | Al pasar de Comité a Final DG | El candidato | No |
| `bienvenida_contratacion` | Al contratar | El candidato (+ formatos adjuntos) | **Sí** |
| `altas_nuevos_ingresos` | Al contratar | Las áreas internas | **Sí** |

### Validación del editor de plantillas

El editor no deja guardar una plantilla rota:

- Una variable **inventada** (`{{foo}}`) se rechaza — se enviaría literal al candidato.
- Faltar una variable **requerida** se rechaza. Sin `{{magic_link}}` el entrevistador no puede calificar; sin `{{link_meet}}` el candidato no sabe a dónde entrar.

Hay cuatro plantillas más seedeadas en base (`confirmacion_postulacion`, `descarte`, `oferta`, `informativa`) que **ningún flujo envía hoy**. No se muestran en Ajustes a propósito: exponerlas haría creer que editarlas cambia algo.

---

## 8. Configuración (Ajustes)

| Bloque | Qué contiene | Efecto si falta |
|---|---|---|
| **Dirección General** | Correo, nombre y duración de la entrevista final. | **Bloquea** el paso de Comité a Final DG. |
| **Destinatarios de altas** | 7 roles: RH/firmas, Correos, Inducción, Alta Yunius, Alta HubSpot, Jefe directo, CC adicional. | Cada tarea del correo interno **solo aparece si su destinatario está definido**. Sin ningún destinatario, el correo no se manda. |
| **Plantillas de correo** | Los 6 correos vivos. | Sin plantilla activa, la acción correspondiente falla con mensaje claro. |
| **Factorial HR** | Interruptor del alta automática de empleados. | Ver §9. |

**Regla de diseño:** los ajustes **nunca tienen fallback silencioso**. Si falta configuración, la acción falla con un mensaje que dice qué falta y dónde arreglarlo. Un fallback mandaría correos a direcciones que el usuario creía haber cambiado.

Los destinatarios y el correo de la DG se sembraron con valores reales al construir el módulo — **revisarlos es parte del pre-vuelo**.

---

## 9. Factorial HR — apagado en v1

El módulo sabe dar de alta al empleado en Factorial automáticamente al contratar (SDK oficial, idempotente por `factorial_employee_id`).

**En v1 el interruptor va APAGADO** (`rec_ajustes.factorial.sync_activa = false`). Decisión deliberada: la integración nunca se ha ejercitado contra Factorial productivo, y el primer candidato real no debe ser la prueba. La contratación funciona completa —correos incluidos— sin tocar Factorial; el alta se sigue haciendo a mano.

**Para encenderlo después:** validar con un alta de prueba contra producción, borrarla, y luego activar el interruptor desde Ajustes. La idempotencia evita duplicados si se reintenta.

---

## 10. Permisos y datos

- **Acceso al módulo:** `rol = 'admin'` o la bandera `acceso_reclutamiento` en el perfil. Sin eso, el layout redirige al dashboard. Se otorga desde `/admin/usuarios`.
- **RLS activa en todas las tablas `rec_*`** desde la primera migración.
- **Escritura por Server Actions** con validación Zod del lado del servidor (patrón del módulo Score), no mutaciones desde el navegador.
- **El `refresh_token` de Google se guarda cifrado** con AES-256-GCM; la llave (`GOOGLE_TOKEN_ENCRYPTION_KEY`) solo vive en el servidor.
- **CVs** en el bucket `reclutamiento` de Storage, con RLS. PDF/DOC/DOCX, máximo 10 MB.
- **Ruta pública de evaluación:** el único dato que sale sin sesión es lo que devuelve `rec_sesion_por_token`, que no incluye CV ni contacto del candidato.

---

## 11. Arquitectura

- **Next.js 14 (App Router)** en Vercel · **Supabase** (Postgres + Auth + Storage) · **Google Workspace** (Calendar + Gmail vía REST directo, sin `googleapis`).
- Páginas en `app/(dashboard)/reclutamiento/`; ruta pública en `app/evaluar/[token]/`.
- Server Actions en `lib/actions/{reclutamiento,agendamiento,comite,evaluaciones,ajustes}.ts`.
- Motor de etapas en `lib/reclutamiento/etapas.ts` — **módulo puro**, sin React ni Supabase. Es la única fuente de verdad de "qué sigue"; el kanban, el perfil y las server actions consultan la misma función, para que no puedan contradecirse.
- RPCs `security definer`: `rec_transicion_etapa`, `rec_sesion_por_token`, `rec_submit_evaluacion`, `rec_credencial_google`.
- 27 migraciones versionadas (`rec_001` … `rec_023`).

### Tablas principales

| Tabla | Qué guarda |
|---|---|
| `rec_vacantes` | Vacante (título, área, descripción, estado) |
| `rec_candidatos` | Candidato, su etapa, revisión de CV, motivo de descarte, fechas de DG e ingreso |
| `rec_candidato_historial` | Cada cambio de etapa |
| `rec_sesiones_entrevistas` / `rec_entrevistas` | Sesión de entrevistas y la cita candidato × sesión (con `gcal_event_id`, `meet_url`) |
| `rec_evaluaciones` | Recomendación, comentarios y puntaje de cada entrevistador |
| `rec_magic_links` | Token de acceso del entrevistador, con expiración |
| `rec_plantillas_correo` | Asunto, cuerpo y CC de cada plantilla |
| `rec_correos_enviados` | Bitácora: destinatario, estado, error, ids de Gmail |
| `rec_credenciales_google` | `refresh_token` cifrado de la cuenta emisora |
| `rec_ajustes` | Configuración key/value (DG, destinatarios, Factorial) |
| `rec_alta_config` | Configuración de alta por candidato |

---

## 12. Límites conocidos de la v1

Son deliberados, no defectos. Se resuelven según lo pida el uso real.

1. **Un candidato pertenece a una sola vacante.** El modelo persona × postulación × vacante se difiere hasta que haya volumen de candidatos repitiendo postulación.
2. **No hay onboarding digital del candidato (S10).** Los datos de contratación se siguen capturando por el layout de Excel y el Google Form; el correo de bienvenida los adjunta. El plan para sustituirlo está escrito en `PLAN.md §8.12`.
3. **Sin recordatorios automáticos ni control de no-show.** El estado de la entrevista se actualiza a mano.
4. **No se leen las respuestas del candidato.** Se guarda el `gmail_thread_id` para poder hacerlo después, pero nadie lo consume.
5. **Sin portal de candidatos externos.** El acceso a la app está cerrado al dominio `@financieracrediflexi.com`; los entrevistadores externos entran solo por magic link.
6. **Sin scoring ni lectura automática de CVs.**
7. **Factorial apagado** (§9).
8. **Una sola cuenta emisora de Google** para todo el módulo (ver §13 para cómo se elige y cómo fijarla).

---

## 13. Operación y mantenimiento

**Lo que puede necesitar atención:**

| Situación | Señal | Qué hacer |
|---|---|---|
| La conexión con Google expira o se revoca | Las acciones fallan con "La conexión con Google expiró" | Reconectar desde `/reclutamiento/agendar` → botón *Reconectar* |
| Un correo no sale | Aparece en `Correos enviados` con estado **error** y el mensaje exacto | Corregir la causa y repetir la acción |
| Alguien reconecta Google con su cuenta personal | Los correos empiezan a salir del remitente equivocado | Reconectar con la cuenta institucional. **Ojo:** este incidente ya ocurrió en el módulo de Tickets — la pantalla de Google no siempre obliga a elegir cuenta, así que hay que verificar cuál quedó |

### Cómo se elige la cuenta emisora

`rec_credenciales_google` marca cada credencial con un `uso` (`reclutamiento` / `tickets` / `ambos`). La RPC `rec_credencial_google()` prefiere la marcada `reclutamiento` y, si no existe, cae a la `ambos`.

- El botón **Conectar Google** de `/reclutamiento/agendar` guarda la credencial como **`ambos`**.
- Para dejar una cuenta **fijada solo a Reclutamiento**, hay que conectarla desde `/api/google/conectar?uso=reclutamiento`. Un índice único garantiza una sola credencial por uso específico.

Hoy Reclutamiento es el único consumidor de esta tabla: desde TKT-047/048 el módulo de Tickets manda con su propio remitente por variables de entorno (`TICKETS_GOOGLE_REFRESH_TOKEN`), no con la credencial de base.
| Cambia quién recibe el correo de altas | — | Ajustes → Destinatarios de altas. No requiere desplegar |
| Cambia el texto de un correo | — | Ajustes → Plantillas. No requiere desplegar |

**Costo de infraestructura:** cero adicional. Corre sobre la misma cuenta de Vercel y Supabase que el resto de la plataforma, y sobre el Google Workspace que la empresa ya paga.

---

## 14. Qué sigue

En orden de valor esperado, sujeto a lo que pida el uso real:

1. **Encender Factorial**, ya validado contra producción.
2. **S10 — onboarding del candidato**: captura de datos de contratación por magic link, para eliminar el Excel y el Google Form.
3. **Recordatorios y control de no-show.**
4. **Métricas del proceso**: tiempo por etapa, tasa de conversión por fuente, dónde se cae el embudo. Los datos ya se acumulan en `rec_candidato_historial`.
5. **Multi-vacante N↔N**, cuando haya volumen que lo justifique.
