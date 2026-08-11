# Guion de demo — Mesa de Ayuda

> Estado al 2026-08-11. **Los correos NO están verificados**: no los menciones
> como algo que ya funciona (ver "Lo que no se enseña").

---

## Antes de entrar a la sala

- [ ] Sesión iniciada en **dos navegadores**: normal (tú, admin/supervisor) e **incógnito** con una cuenta que NO sea de Sistemas — hace de comercial.
- [ ] Las dos pestañas ya abiertas en `mesa-tickets.vercel.app`, logueadas. **Nunca hagas login en vivo.**
- [ ] Una imagen en el escritorio para adjuntar (una captura cualquiera).
- [ ] Celular con la app abierta y logueado, para el cierre.
- [ ] Wi-Fi probado en esa sala, no en tu escritorio.

### Siembra — 45 min antes, escalonada

El SLA de Sistemas corre desde que se crea el ticket. Si siembras todo junto, o todo sale verde o todo sale rojo, y en los dos casos se ve falso.

| Cuándo | Qué levantar | Cómo se verá en la junta |
|---|---|---|
| 45 min antes | Soporte a equipo de cómputo | **Rojo, vencido** |
| 17 min antes | Usuarios y accesos (SLA 20 min) | Ámbar, por vencer |
| 10 min antes | Impresoras y escáneres | Verde |
| Ayer, ya cerrado | cualquiera | Historial |

Deja **uno sin tomar** para tomarlo en vivo.

---

## El guion — 7 minutos

### 0. Abre con el problema, no con la pantalla (30 s)

> "Hoy, cuando algo se cae, se reporta por WhatsApp. Y si les pregunto ahorita cuántas cosas están pendientes en Sistemas, desde cuándo, y de quién es cada una… nadie puede contestar. No porque no trabajen: porque el WhatsApp no guarda eso."

**No abras el laptop todavía.** Que la pregunta quede en el aire.

### 1. Levantar (60 s) — ventana del comercial

Abre `/tickets/nuevo`.

> "El que reporta no necesita saber cómo está organizada la empresa."

- Escribe **`impresora`** en el buscador → señala que filtra solo.
- Borra y señala **Frecuentes**: *"No sirve la impresora o el escáner", "No tengo acceso a Yunius"*.
  > "Está escrito como lo dice la gente, no como se llama en el catálogo."
- Elige **Cámaras y alarmas**. Señala la tarjeta: **prioridad, tiempo estimado, y quién lo atiende**.
  > "Desde antes de mandarlo ya sabe qué esperar. Eso es la mitad de las llamadas de seguimiento."
- Llena, adjunta la imagen, envía.

### 2. La cola (90 s) — **la pantalla estrella**, ventana de Sistemas

Cambia de navegador. Abre **Cola del área**.

- Señala las cuatro cifras: **Sin tomar · Vencidos · En curso · Cerrados hoy**.
  > "Esto es lo que el WhatsApp nunca va a poder darles."
- Señala el **rojo**.
  > "Este lleva 45 minutos y su compromiso era 30. No es un regaño: es que ahora se puede ver."
- Señala el orden.
  > "No está ordenado por fecha. Está ordenado por urgencia real: primero lo vencido, luego lo que menos tiempo le queda."
- Señala el ticket recién levantado, en **Sin tomar**.
  > "Este acaba de caer. No es de nadie todavía."

### 3. Tomar (30 s)

Clic en **Tomar**.

> "Un clic. Ya tiene dueño y todo el equipo lo sabe. Se acabó el 'yo pensé que lo estabas viendo tú'."

Abre el ticket y señala el **Historial**.

> "Y queda registrado quién lo tomó y cuándo."

### 4. Resolver (60 s)

- Abre **Escribir un mensaje**, responde algo corto con adjunto.
- Ciérralo y da **Resolver**.

> "Una cámara se arregla yendo. El técnico no tiene que escribir un ensayo: dos clics, tomar y resolver."

**Señala que se cerró directo**, sin pedir confirmación.

> "Y como es presencial, se cierra solo. El técnico estuvo ahí, el usuario ya vio que quedó — pedirle que entre a confirmar sería burocracia. En los remotos sí se le pregunta."

### 5. El contraste (45 s)

Abre un ticket de **Ficha no reflejada** (Tesorería).

> "Y no todos los problemas son iguales. Este no se arregla al momento: entra en el siguiente corte."

Señala el botón **"Entra en el siguiente corte"**.

> "Cuando el responsable lo marca, el reloj se detiene. La demora deja de contar contra él, porque ya no depende de él. Cada tipo de problema tiene el flujo que le toca, y eso se configura sin programar."

### 6. El momento de ellos (60 s) — **lo único que van a recordar**

> "¿Alguien quiere reportar algo real que le esté pasando ahorita?"

Que lo hagan **desde su propio celular**, no desde tu laptop. Tú refrescas la cola en pantalla y aparece.

Si nadie se anima, hazlo tú desde tu teléfono y proyecta la cola.

### 7. Cierre (30 s)

Vuelve a la cola y a las cuatro cifras.

> "El sistema no hace que Sistemas atienda más rápido. Hace visible quién debe qué y desde cuándo — y eso es lo que hace que se atienda."

---

## Lo que NO se enseña

| No hagas | Por qué |
|---|---|
| **No prometas correos** | Están construidos pero **no verificados**. Si preguntan: *"la notificación por correo es lo siguiente que estamos afinando; el motor ya está, lo estamos probando esta semana."* Es verdad. |
| No abras Reclutamiento | Diluye el mensaje y ese módulo tampoco está validado. |
| No entres a `/admin` | Enseña la maquinaria, no el valor. Si preguntan por configuración, dilo de palabra. |
| No improvises un reporte | Di que los datos ya se están guardando y el reporte es una vista más. |
| No enseñes móvil en `/admin/usuarios` | Los toggles no tienen etiqueta en pantalla chica. |

---

## Preguntas que van a salir

**"¿Me avisa cuando hay algo nuevo?"**
> "El aviso por correo está construido y es lo que estamos afinando esta semana. Hoy el equipo ve su cola con el contador en el menú."

**"¿Y si el responsable se va de vacaciones?"**
> Enséñalo: **Devolver a la cola** / **Pasar a…**. "El ticket no es de nadie de por vida."

**"¿Esto no es un peso más que mantener?"**
> "El catálogo, las áreas, los tiempos y los flujos se editan desde la pantalla, sin programar. No hay que llamarme para cambiar una coma."

**"¿Quién puede ver los tickets?"**
> "Cada quien ve los suyos y los de su área. Dirección puede ver todas las colas."

**"¿Cuánto tarda en estar listo?"**
> **Está listo.** Está en producción. Lo que falta es decidir cuándo arranca y con quién.

---

## Lo que quieres llevarte de la sala

No aplausos. **Cuatro acuerdos:**

1. **Un área** para arrancar — Sistemas.
2. **Una fecha** — "desde el lunes X".
3. **Un dueño** — quién revisa la cola en la mañana.
4. **La regla** — qué pasa con lo que siga llegando por WhatsApp.

> El punto 4 es el que decide si esto vive o muere. Mientras se pueda pedir soporte por WhatsApp, se va a pedir por WhatsApp — porque es más fácil. Necesitas que alguien con autoridad diga en voz alta: *"a partir del lunes, esto no se pide por WhatsApp"*.

Y pide **dos voluntarios** para una prueba de 15 minutos: un técnico de Sistemas y un comercial. Es lo que convierte la demo en adopción.

---

## Plan B

- **Vercel caído** → `npm run dev` local, con el navegador ya abierto y logueado.
- **"Tomar" no responde** → entra al ticket y tómalo desde el detalle: mismo botón, otra ruta.
- **Algo se ve raro** → *"eso lo reviso"*, y sigue. Nadie recuerda el bug; todos recuerdan los tres minutos peleando con él.
- **Se cae el internet** → cuenta el flujo con la captura de la cola que traes en el celular.
