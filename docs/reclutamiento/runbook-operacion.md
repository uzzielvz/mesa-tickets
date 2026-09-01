# Reclutamiento — Runbook de operación

> **Para quien mantiene el módulo, no para quien lo opera.** Versión 1.0 · 2026-08-24
>
> El manual de RH está en [`manual-usuario.md`](./manual-usuario.md). Este documento es para diagnosticar y resolver.

---

## 1. Lo primero que hay que saber

### 1.1 Un correo que falla NO revierte nada

Esta es la regla que más confusión causa y no estaba escrita en ningún lado.

Los envíos de correo son **best-effort**: se intentan, se registran en `rec_correos_enviados` con estado `enviado` o `error`, y **la acción de negocio continúa de todos modos**.

| Si falla… | El estado del candidato queda… |
|---|---|
| El correo de bienvenida al contratar | **Contratado.** Hay que reenviar el correo a mano. |
| El correo interno de altas | **Contratado.** Las áreas no se enteraron. |
| El correo `pase_fase3` | **Final DG**, con el Meet ya creado. El candidato no sabe su cita. |
| Un magic link de entrevistador | La sesión existe, pero ese entrevistador **no puede calificar**. |
| La agenda consolidada a entrevistadores | Los eventos de Calendar sí llegaron; falta la tabla y los CV. |

**Lo que sí es bloqueante** (falla antes de mutar): sin cuenta de Google, sin plantilla activa, sin correo del candidato, sin correo de la DG. Estas acciones se detienen y no dejan estado a medias.

**Consecuencia operativa:** después de cualquier contratación o agendamiento, hay que mirar `/reclutamiento/correos`. Es la única forma de saber si algo se perdió.

### 1.2 Dónde vive el diagnóstico

`/reclutamiento/correos` es la bitácora. Filtra por **con error**. Cada fila guarda el mensaje literal que devolvió Gmail, más `gmail_message_id` y `gmail_thread_id` cuando el envío sí salió.

El botón **Exportar CSV** de esa misma pantalla sirve para diagnosticar sin entrar a la base: sube el tope de 200 a 5,000 registros y trae el error **sin truncar** (la tabla lo corta a dos líneas).

Tablas útiles para ir más a fondo:

| Tabla | Para qué |
|---|---|
| `rec_correos_enviados` | Qué se intentó mandar, a quién, cuándo, con qué error |
| `rec_candidato_historial` | Cada cambio de etapa, con quién lo hizo |
| `rec_magic_links` | Tokens, a quién pertenecen, cuándo expiran, si se usaron |
| `rec_entrevistas` | `gcal_event_id` y `meet_url` de cada cita |
| `rec_credenciales_google` | Qué cuenta está conectada y con qué `uso` |
| `rec_ajustes` | Configuración (`dg`, `alta_destinatarios`, `factorial`) |

---

## 2. Modos de falla conocidos

### 2.1 "La conexión con Google expiró" / "Conecta una cuenta de Google"

**Síntoma:** toda acción que manda correo o crea Meets falla. Es la falla más común.

**Causa:** el `refresh_token` fue revocado, o la contraseña de la cuenta cambió, o alguien retiró el permiso de la app desde la cuenta de Google.

**Arreglo:** reconectar desde `/reclutamiento/agendar` → botón **Reconectar**.

**Después de reconectar, verifica con qué cuenta quedó.** La pantalla de consentimiento de Google no siempre obliga a elegir cuenta: si el navegador tiene una sesión activa, la toma sin preguntar. Este error exacto ya provocó un incidente real en el módulo de Tickets, donde los avisos empezaron a salir desde una cuenta personal.

### 2.2 La cuenta emisora es la equivocada

**Síntoma:** los correos a candidatos salen desde una cuenta personal en lugar de la institucional.

**Cómo se elige la cuenta.** `rec_credenciales_google.uso` marca cada credencial (`reclutamiento` / `tickets` / `ambos`). La RPC `rec_credencial_google()` prefiere la marcada `reclutamiento`; si no hay, usa la `ambos`.

**El detalle que importa:** el botón *Conectar Google* de la pantalla de agendar guarda la credencial como **`ambos`**, no como `reclutamiento`.

**Arreglo recomendado:** conectar la cuenta institucional entrando directo a

```
/api/google/conectar?uso=reclutamiento
```

Eso la fija a este módulo. Un índice único garantiza una sola credencial por uso específico, y la anterior se degrada a `ambos` automáticamente.

**Contexto que reduce el riesgo:** hoy Reclutamiento es el único consumidor de esta tabla. Desde TKT-047/048, Tickets manda con su propio remitente por variables de entorno (`TICKETS_GOOGLE_REFRESH_TOKEN` / `TICKETS_SENDER_EMAIL`), no desde aquí. Ya no hay forma de que conectar una cuenta para Tickets le cambie el remitente a Reclutamiento.

### 2.3 "Falta la plantilla de …"

**Síntoma:** una acción concreta falla y las demás funcionan.

**Causa:** la plantilla está en `activa = false` o su fila no existe. Todas las consultas filtran por `.eq('activa', true)`.

**Arreglo:** revisar `rec_plantillas_correo` para ese `codigo`. Los seis códigos vivos son `agendamiento_fase2`, `agenda_entrevistadores`, `notificacion_entrevistador`, `pase_fase3`, `bienvenida_contratacion`, `altas_nuevos_ingresos`.

### 2.4 El correo interno de altas no llegó a nadie

**Síntoma:** se contrató y las áreas no recibieron nada. No hay error visible.

**Causa:** los destinatarios de la configuración de alta están vacíos. `construirCorreoAltas` devuelve `null` si no hay ni un destinatario en "para", y la función **retorna sin registrar nada** en la bitácora.

**Cómo se reconoce:** ausencia total de la fila `altas_nuevos_ingresos` para ese candidato en `rec_correos_enviados` — ni enviada ni con error. Un silencio, no un rojo.

**Arreglo:** llenar los destinatarios en `/reclutamiento/ajustes` y mandar ese aviso a mano. **Es el único caso en que una falla no deja rastro en la bitácora**; vale la pena tenerlo presente.

Relacionado: cada línea de tarea del correo aparece solo si su destinatario está lleno **y**, para Yunius/HubSpot, si ese sistema fue marcado en la configuración de alta. Un correo que llega "incompleto" casi siempre es configuración, no un defecto.

### 2.5 El magic link no funciona

| Mensaje que ve el entrevistador | Causa | Arreglo |
|---|---|---|
| "Esta liga ya expiró" | Pasaron más de 8 días desde la fecha de la sesión | **No hay regeneración en la v1.** La única salida es volver a agendar. Límite conocido. |
| "Liga no válida" | Token mal copiado, o la fila no se creó | Buscar el token en `rec_magic_links` por `entrevistador_email` |

Si el correo del magic link nunca salió, aparece como error en la bitácora con `plantilla_codigo = notificacion_entrevistador`. La liga se puede reconstruir a mano: `https://<host>/evaluar/<token>` con el token de `rec_magic_links`.

### 2.6 El correo de bienvenida llegó sin los formatos adjuntos

**Causa:** los dos adjuntos fijos se descargan del bucket `reclutamiento` en las rutas `plantillas/layout-datos-personales.xlsx` y `plantillas/lineamientos-fotografias.pdf`. Si un archivo no está, **se omite en silencio** y el correo se manda igual.

**Arreglo:** verificar que ambos archivos existan en Storage con esas rutas exactas.

### 2.7 El agendamiento se completó a medias

**Síntoma:** el reporte muestra algunos candidatos en error.

**Diseño esperado:** el agendamiento procesa candidato por candidato y reporta cada uno. Un fallo individual no aborta el resto, y la agenda consolidada y los magic links tampoco tumban la operación.

**Arreglo:** atender solo los casos fallidos. **No re-ejecutes el agendamiento completo** — los candidatos que sí avanzaron ya están en etapa `entrevistas_agendadas` y no aparecerán en la lista de viables, pero volverías a crear eventos duplicados para cualquiera que siga elegible.

---

## 3. Kill switch — cómo detener el módulo sin desplegar

Tres niveles, de más amplio a más quirúrgico. Los tres son reversibles y ninguno requiere tocar código ni redesplegar.

| Nivel | Cómo | Efecto |
|---|---|---|
| **Cerrar el módulo entero** | Quitar `acceso_reclutamiento` a todos en `/admin/usuarios` | Nadie salvo los `admin` puede entrar. El layout redirige al dashboard. Los datos quedan intactos. |
| **Cortar un correo específico** | `rec_plantillas_correo.activa = false` para ese código | La acción que depende de esa plantilla falla con mensaje claro en lugar de enviar. |
| **Cortar todo envío y agendamiento** | Borrar la fila de `rec_credenciales_google` (o revocar el permiso desde la cuenta de Google) | Ninguna acción que mande correo o cree Meets se ejecuta. Todas fallan de forma limpia, antes de mutar estado. |

**El más recomendable ante un incidente de correos** es el tercero: falla *antes* de cambiar estado, así que no deja candidatos a medio proceso.

---

## 4. Qué se cambia sin desplegar y qué no

| Sin desplegar (desde la app) | Requiere desarrollo y despliegue |
|---|---|
| Asunto, cuerpo y CC de los 6 correos | Las 9 etapas del pipeline y sus reglas |
| Los 7 destinatarios del correo de altas | Los 20 minutos por bloque de entrevista |
| Correo, nombre y duración de la DG | Campos nuevos en candidato o vacante |
| Interruptor de Factorial | Qué plantillas existen y qué variables acepta cada una |
| Quién tiene acceso al módulo | La expiración de 8 días del magic link |
| Entrevistadores de cada sesión | Regenerar un magic link vencido |
| — | Las columnas que salen en los CSV de exportación |

---

## 5. Variables de entorno

| Variable | Para qué | Si falta |
|---|---|---|
| `GOOGLE_RECLUTAMIENTO_CLIENT_ID` / `_SECRET` | OAuth con Google | No se puede conectar ni refrescar el token |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Cifra/descifra el `refresh_token` (AES-256-GCM) | **Cambiarla invalida las credenciales ya guardadas.** Habría que reconectar Google |
| `FACTORIAL_API_KEY` | Alta de empleados | Solo relevante si se enciende Factorial (hoy apagado) |
| `FACTORIAL_COMPANY_ID` / `_LEGAL_ENTITY_ID` / `_LOCATION_ID` | Ids de la empresa en Factorial | Tienen default en código |

Las URLs de los magic links se arman con el host de la petición (`x-forwarded-host`), no con una variable. Se acomodan solas al dominio desde el que se agendó.

---

## 6. Factorial HR — está apagado a propósito

`rec_ajustes.factorial.sync_activa = false`.

**No lo enciendas solo porque el interruptor está ahí.** La integración nunca se ha ejercitado contra Factorial de producción. Encenderla sin validar significa que el primer candidato real es la prueba, y un alta a medias deja un empleado que hay que borrar a mano.

**Procedimiento para encenderla:**
1. Alta de prueba contra Factorial productivo con datos ficticios.
2. Verificar que el empleado y su contrato se crearon bien.
3. Borrarlo en Factorial.
4. Encender el interruptor desde `/reclutamiento/ajustes`.

El alta es **idempotente por `rec_candidatos.factorial_employee_id`**: si ya tiene id, no se vuelve a crear. Un reintento tras un fallo es seguro. El alta es best-effort — si falla, no tumba la contratación y no persiste id, así que se puede reintentar.

---

## 7. Riesgos abiertos

| # | Riesgo | Severidad | Estado |
|---|---|---|---|
| R-1 | **Retención de datos de candidatos.** El módulo guarda CV, teléfono y correo de personas no contratadas, sin política de purga ni anonimización, en una entidad financiera regulada (LFPDPPP / CNBV). Abierto desde 2026-06-30 en `PLAN.md §8.7`. | Media | **Sin dueño asignado.** No bloquea el lanzamiento; requiere una decisión de negocio + legal, y después una tarea de purga. |
| R-1b | **La exportación a CSV amplifica R-1.** Desde REC-024 (2026-08-31) cualquiera con acceso al módulo puede bajar un archivo con nombre, correo y teléfono de todos los candidatos de una vacante. Fuera de la plataforma no hay RLS que valga. | Media | **Mitigado parcialmente:** cada exportación se registra en `rec_exportaciones` (quién, qué, filtros, filas) y el registro se escribe antes de entregar el archivo. Es rastreabilidad, **no** una política de manejo. Hereda el dueño pendiente de R-1. |
| R-2 | **Sin regeneración de magic links.** Un entrevistador que pierde su correo o se pasa de los 8 días no puede calificar sin volver a agendar. | Baja | Límite conocido de la v1. Se resuelve si el uso real lo pide. |
| R-3 | **Fallo silencioso del correo de altas** sin destinatarios (§2.4): es la única ruta que no deja rastro en la bitácora. | Baja | Mitigado por documentación. Un arreglo real sería registrar el intento fallido. |
| R-4 | **Sin validación end-to-end previa al lanzamiento.** | — | Se cierra ejecutando [`prevuelo-lanzamiento.md`](./prevuelo-lanzamiento.md). |

---

## 8. Escalamiento

Para reportar un problema, lo mínimo útil:

1. Qué se estaba haciendo y con qué candidato.
2. El mensaje de error tal cual apareció.
3. La fila correspondiente de `/reclutamiento/correos` (estado y mensaje).
4. La hora aproximada — sirve para cruzar con los logs de Vercel.

---

**Documentos relacionados**
- [`documentacion-funcional.md`](./documentacion-funcional.md) — arquitectura, modelo de datos, alcance.
- [`manual-usuario.md`](./manual-usuario.md) — el paso a paso de quien opera.
- [`prevuelo-lanzamiento.md`](./prevuelo-lanzamiento.md) — validación previa al anuncio.
