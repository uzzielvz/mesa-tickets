# Mocktest — Mesa de Tickets

> Pre-vuelo del 2026-08-11. **Objetivo: encontrar lo que está ROTO**, no juzgar si se entiende.
> Para eso último no sirves: construiste esto y ya sabes dónde está todo. Esa validación va
> aparte, con dos personas reales (ver `PLAN.md §0`).
>
> Duración estimada: 30-40 min. Contra **producción** (`mesa-tickets.vercel.app`).

## Antes de empezar

- [ ] **Dos sesiones abiertas**: navegador normal con tu cuenta admin + ventana **incógnito** con una segunda cuenta.
      Sin esto no puedes probar la cola ni los permisos, que es donde está el riesgo real.
- [ ] Confirmar en `/admin/usuarios` qué **área** tiene cada una de las dos cuentas. Anótalo:
      - Cuenta A (admin): área = ______________
      - Cuenta B: área = ______________
- [ ] Tener a la mano una **imagen** cualquiera para probar adjuntos.

> ⏱ **Sobre el reloj**: el SLA de Sistemas es de 20-30 min y corre desde que se crea el ticket.
> Todo lo que levantes hoy se verá **verde** la primera media hora. Si quieres ver un
> "Vencido" en rojo, necesitas un ticket de hace más de 30 min — créalo al inicio del
> mocktest y revísalo al final.

---

## Bloque 1 — Levantar un ticket (cuenta B)

| # | Acción | Qué debe pasar | OK |
|---|--------|----------------|-----|
| 1.1 | Ir a `/tickets/nuevo` | **NO** pide elegir área. Primer campo: "¿Cuál es el problema?" con el cursor ya dentro | ☐ |
| 1.2 | Mirar sin escribir | Bloque **Frecuentes** con frases tipo "No sirve la impresora o el escáner", y debajo las tarjetas agrupadas por área | ☐ |
| 1.3 | Escribir `impresora` | Los Frecuentes desaparecen; queda solo el tipo de impresoras | ☐ |
| 1.4 | Escribir `camaras` (sin acento) | Encuentra "Cámaras y alarmas" | ☐ |
| 1.5 | Escribir `zzzz` | Mensaje explicando qué hacer + botón "Ver todos los tipos" que funciona | ☐ |
| 1.6 | Clic en un **Frecuente** | Selecciona el tipo directo, sin pasos intermedios | ☐ |
| 1.7 | Ver la tarjeta elegida | Muestra prioridad, tiempo, modalidad y **"Lo atiende ___"**. Botón "Cambiar" regresa a la lista | ☐ |
| 1.8 | Elegir "Problemas de red", llenar campos, comentario, adjuntar imagen, enviar | Redirige al detalle con número de ticket | ☐ |

## Bloque 2 — El ticket recién nacido (cuenta B, en el detalle)

| # | Qué mirar | Qué debe decir | OK |
|---|-----------|----------------|-----|
| 2.1 | Estado | **Abierto** | ☐ |
| 2.2 | Responsable | **sin asignar** | ☐ |
| 2.3 | Guía (recuadro naranja) | "Tu ticket está en la cola de ___" + el tiempo estimado | ☐ |
| 2.4 | SLA | En verde, "Quedan ~30 min" | ☐ |
| 2.5 | Historial (plegado) | Al abrirlo: **1 evento — "___ levantó el ticket"** | ☐ |
| 2.6 | Adjunto en el hilo | **Abre en pestaña nueva** al hacer clic (no es texto muerto) | ☐ |
| 2.7 | 📧 Bandeja de la cuenta A | ¿Llegó "Ticket #N — … (área)"? → **este es el punto crítico, nunca se ha verificado** | ☐ |

## Bloque 3 — La cola (cuenta A)

| # | Acción | Qué debe pasar | OK |
|---|--------|----------------|-----|
| 3.1 | Sidebar | "Cola del área" con contador = tickets sin tomar | ☐ |
| 3.2 | Abrir `/tickets/area` | Cuatro cifras arriba: Sin tomar / Vencidos / En curso / Cerrados hoy | ☐ |
| 3.3 | Sección "Sin tomar" | Aparece el ticket recién creado, con su SLA y prioridad | ☐ |
| 3.4 | Clic en **Tomar** | Toast de confirmación; el ticket se mueve a "En curso" | ☐ |
| 3.5 | Recargar | El contador del sidebar bajó en 1 | ☐ |
| 3.6 | Abrir el ticket | Estado = **En revisión**, responsable = tu nombre | ☐ |
| 3.7 | Historial | Ahora 2 eventos: creado + **tomado** | ☐ |
| 3.8 | 📧 Bandeja de la cuenta B | ¿Llegó "Tu ticket ya está siendo atendido"? | ☐ |

## Bloque 4 — Atender y cerrar

| # | Cuenta | Acción | Qué debe pasar | OK |
|---|--------|--------|----------------|-----|
| 4.1 | A | Responder en el hilo con adjunto | Aparece la respuesta; el adjunto abre | ☐ |
| 4.2 | A | Responder **otra vez seguido** | **Funciona** (antes lo bloqueaba la paridad — TKT-001) | ☐ |
| 4.3 | B | 📧 ¿Llegó aviso de respuesta? | | ☐ |
| 4.4 | A | Botón **Programado** | Estado cambia; el SLA pasa a "En espera de la siguiente tanda" (pausado) | ☐ |
| 4.5 | B | 📧 ¿Llegó "quedó programado"? | | ☐ |
| 4.6 | A | **En revisión** de nuevo, luego "Marcar como resuelto" | Estado = **Resuelto** | ☐ |
| 4.7 | B | Abrir el ticket | La guía pide **confirmar o reabrir**, y aparecen los dos botones | ☐ |
| 4.8 | B | 📧 ¿Llegó "confirma el cierre"? | | ☐ |
| 4.9 | B | **Confirmar cierre** | Estado = **Cerrado**; ya no hay composer | ☐ |
| 4.10 | A | Historial del ticket | Secuencia completa y legible: creado → tomado → programado → en revisión → resuelto → cerrado | ☐ |
| 4.11 | A | `/tickets/area` | "Cerrados hoy" subió en 1 | ☐ |

## Bloque 5 — Lo que puede morder (segundo ticket)

Levanta otro ticket desde B y prueba los caminos que nadie recorre en una demo feliz.

| # | Acción | Qué debe pasar | OK |
|---|--------|----------------|-----|
| 5.1 | A lo toma, luego **Devolver a la cola** | Vuelve a "Sin tomar" y el estado regresa a **Abierto** | ☐ |
| 5.2 | 📧 Bandeja del área | ¿Llegó "volvió a la cola"? | ☐ |
| 5.3 | A lo toma y usa **Pasar a…** | El desplegable **solo** muestra gente del área | ☐ |
| 5.4 | Tomar un ticket **ya tomado** (dos pestañas) | Mensaje claro "Otra persona lo tomó primero", no un error feo | ☐ |
| 5.5 | Rechazar con motivo de 3 letras | Lo impide y explica el mínimo | ☐ |
| 5.6 | Rechazar con motivo real | Estado = **Rechazado**, el motivo se ve en el hilo | ☐ |
| 5.7 | Intentar responder en el rechazado | No hay composer | ☐ |

## Bloque 6 — Permisos (el riesgo silencioso)

> Si algo aquí falla, **es lo más grave del mocktest**: significa que alguien ve tickets que no debería.

| # | Acción | Qué debe pasar | OK |
|---|--------|----------------|-----|
| 6.1 | Con una cuenta de **otra área** (ni levantador ni responsable), abrir la URL directa `/tickets/N` | **No** debe ver el ticket | ☐ |
| 6.2 | Esa misma cuenta en `/tickets/area` | Ve **su** cola, no la de Sistemas | ☐ |
| 6.3 | En `/admin/usuarios`, listar quién tiene área **Sistemas** | ¿Todos ellos *deben* ver todos los tickets de Sistemas? Si hay alguien de más, corregir su área | ☐ |

## Bloque 7 — Celular

Abre la app en tu teléfono (es donde va a vivir para los comerciales).

| # | Pantalla | Qué revisar | OK |
|---|----------|-------------|-----|
| 7.1 | `/tickets/nuevo` | Buscador y tarjetas usables con el pulgar; nada se sale de la pantalla | ☐ |
| 7.2 | `/tickets/area` | Las cuatro cifras y el botón Tomar se ven bien | ☐ |
| 7.3 | Detalle | Guía, chips y el hilo legibles; el adjunto abre | ☐ |

---

## Registro de hallazgos

Tres cubetas. **Antes de la demo solo se arreglan las dos primeras.**

### 🔴 Rompe — no funciona o da error

| # | Dónde | Qué pasó | Qué esperabas |
|---|-------|----------|---------------|
| | | | |

### 🟡 Confunde — funciona pero no se entiende

| # | Dónde | Qué pasó | Qué esperabas |
|---|-------|----------|---------------|
| | | | |

### ⚪ Falta — no existe (esto es backlog, no urgencia)

| # | Dónde | Qué falta | Para qué serviría |
|---|-------|-----------|-------------------|
| | | | |

---

## Al terminar

- [ ] Borrar los tickets de prueba, o dejarlos si sirven de historial para la demo.
- [ ] Si **algún correo no llegó**: anotarlo como 🔴 y avisarme — es el punto 1 de `PLAN.md §0`
      y el que decide si la herramienta se adopta. Sin avisos, nadie abre la app.
