# Prueba piloto — Vacaciones, de punta a punta

> **Objetivo:** que una solicitud real recorra todo el camino, con las personas reales y sus propias cuentas: **empleado → jefe directo → Vo. Bo. de Gente y Cultura → constancia firmada**. Es para encontrar lo que esté roto antes de abrirlo a todo el personal, no para hacer una demo.
>
> Desde el 2026-10-05, **la firma en la plataforma reemplaza al papel**: lo que se apruebe aquí ya no se imprime para firmar.
>
> Duración: **40–50 minutos**, en producción (`mesa-tickets.vercel.app`). Cada persona en su propia computadora y con su propia sesión.

---

## Quién participa

| Persona | Cuenta | Papel en el piloto |
|---|---|---|
| **Uzziel Valdez** | `uzziel.valdez@` (admin) | Coordina. Da los accesos y hace de Gente y Cultura **solo** para la solicitud de Montellano |
| **Jesús Montellano** | `jesus.montellano@` | Empleado en el Piloto A y Gente y Cultura en el Piloto B |
| **Héctor Ramírez** | `hector.ramirez@` | Jefe directo de Montellano (Piloto A) |
| **Wanda Castro** | `wanda.castro@` | Empleada en el Piloto B |
| **Yesenia Rendón** | `yrendon@` | Jefa directa de Wanda (Piloto B) |

> **Por qué Uzziel da el Vo. Bo. de Montellano:** nadie puede aprobar su propia solicitud; la plataforma lo bloquea. Montellano es de Gente y Cultura y también empleado, así que su solicitud la cierra otra persona.

---

## Criterio de listo

El módulo se abre a todo el personal cuando se cumplan **las cinco**:

- [ ] La solicitud de Montellano llegó a **Aprobada** pasando por Héctor y por Gente y Cultura, y su saldo bajó en los días correctos.
- [ ] La solicitud de Wanda se **rechazó con motivo**, Wanda leyó el motivo, y una segunda solicitud llegó a **Aprobada**.
- [ ] Las dos **constancias** muestran las tres firmas con nombre, fecha y hora, y las pueden abrir la persona y su jefe.
- [ ] **Montellano no pudo darse el Vo. Bo. a sí mismo**, y Wanda **no pudo abrir** la constancia de Montellano.
- [ ] Cancelar una solicitud pendiente y anular los días de una aprobada **devuelven el saldo** y dejan la solicitud como **Cancelada**.

Cualquier otro hallazgo se anota en la tabla del final. Lo que esté **rojo** se arregla antes de abrir el módulo.

---

## Antes de empezar (Uzziel, 10 min)

| # | Acción | Qué debe pasar | OK |
|---|---|---|---|
| 0.1 | Montellano entra **una vez** a la plataforma con su correo de Google | Entra sin error. Si no tiene ningún otro acceso, lo manda a "Mis vacaciones" o al inicio con la tarjeta "Te quedan" | ☐ |
| 0.2 | En `/admin/usuarios`, encender **Vacac.** a Montellano | Montellano ve "Personal" en el menú de Vacaciones | ☐ |
| 0.3 | En `/vacaciones`, buscar **MONTELLANO** y abrir su ficha | Jefe directo: **RAMIREZ RAMOS AGILEO HECTOR**. Correo: `jesus.montellano@…`. Anota sus días por tomar: `____` | ☐ |
| 0.4 | Buscar **CASTRO DOMINGUEZ WANDA** | Jefa directa: **RENDON DIAZ YESENIA**. Menos de un año de servicio (solo días flotantes) | ☐ |
| 0.5 | Confirmar que Héctor, Wanda y Yesenia pueden entrar a la plataforma | Las tres cuentas ya existen | ☐ |

**Fechas que se van a usar** (todas en el futuro; si alguna ya pasó, mueve todo una semana):

- Piloto A: **13 al 17 de noviembre de 2026**. Es a propósito: cruza un fin de semana y el festivo del lunes 16 (Revolución). Deben contar **2 días hábiles** (viernes 13 y martes 17), con regreso el **miércoles 18**.
- Piloto B: **viernes 27 de noviembre de 2026**, un día flotante.

---

## Bloque 1 — Piloto A: vacaciones con saldo (Montellano → Héctor → Uzziel)

| # | Quién | Acción | Qué debe pasar | OK |
|---|---|---|---|---|
| 1.1 | Montellano | Entrar al **Inicio** | Tarjeta **Vacaciones · Te quedan N días**, el mismo número que anotaste en 0.3 | ☐ |
| 1.2 | Montellano | **Mis vacaciones** | Arriba "Te quedan N días". Abajo, sus periodos por año de servicio y los días que traía del Excel | ☐ |
| 1.3 | Montellano | En Solicitar, elegir del **1 al 31 de diciembre** | La vista previa se pone roja ("Tienes N disponibles") y el botón **Solicitar** queda desactivado | ☐ |
| 1.4 | Montellano | Cambiar a **13 al 17 de noviembre** y escribir una nota | Vista previa: **2 días hábiles · regresas el 18 de noviembre**, y "No cuentan: 16 nov (Día de la Revolución)" | ☐ |
| 1.5 | Montellano | **Solicitar** | Aviso "Solicitud enviada a RAMIREZ RAMOS AGILEO HECTOR". En Mis solicitudes: **Espera a tu jefe**. Arriba: "Te quedan N−2 · 2 en trámite" | ☐ |
| 1.6 | Montellano | Intentar pedir **otra vez el 17 de noviembre** | Error: "Ya tienes días solicitados o registrados en esas fechas" | ☐ |
| 1.7 | Héctor | Entrar | En el menú, **Vacaciones → Mi equipo** con un **1**. En el Inicio, tarjeta "Por autorizar: 1" | ☐ |
| 1.8 | Héctor | **Mi equipo** | La solicitud de Montellano: 2 días, fechas, cuántos días le quedan y su nota. Abajo, su equipo con saldos | ☐ |
| 1.9 | Héctor | **Autorizar** | Aviso "Autorizada: pasa a Gente y Cultura". Desaparece de "Por autorizar" y aparece en "Resueltas recientemente" | ☐ |
| 1.10 | Montellano | Mis solicitudes | Estado **Espera Vo. Bo. de RH** | ☐ |
| 1.11 | Montellano | En `/vacaciones` (Personal), sección **Esperan tu Vo. Bo.** → **Dar Vo. Bo.** a su propia solicitud | Error: "No puedes dar el Vo. Bo. a tu propia solicitud". **Sigue pendiente** | ☐ |
| 1.12 | Uzziel | `/vacaciones` → **Dar Vo. Bo.** | Aviso "Aprobada: los días ya cuentan". Sale de la bandeja | ☐ |
| 1.13 | Montellano | Mis vacaciones | Estado **Aprobada**. "Te quedan N−2" y ya **sin días en trámite**. En "Días tomados" aparece el registro del 13 al 17 de noviembre | ☐ |
| 1.14 | Montellano | **Ver constancia firmada** | Formato GYC-VAC012026 con el aviso verde "Firmado electrónicamente… No requiere firma autógrafa". Tres firmas: Montellano (conformidad), Héctor (autorización) y Uzziel (Vo. Bo.), cada una con fecha y hora. Días a disfrutar: **2**. Regreso: **18 de noviembre de 2026** | ☐ |
| 1.15 | Héctor | Abrir la misma constancia (Montellano le pasa el enlace) | La ve completa | ☐ |

---

## Bloque 2 — Piloto B: día flotante y rechazo (Wanda → Yesenia → Montellano)

| # | Quién | Acción | Qué debe pasar | OK |
|---|---|---|---|---|
| 2.1 | Wanda | **Mis vacaciones** | "Aún no cumples un año". El botón **Vacaciones** está desactivado; solo deja **Día flotante** | ☐ |
| 2.2 | Wanda | Día flotante el **27 de noviembre** → Solicitar | "Solicitud enviada a RENDON DIAZ YESENIA". Estado **Espera a tu jefe** | ☐ |
| 2.3 | Yesenia | **Mi equipo** → **Rechazar** sin escribir motivo | No deja: pide el motivo | ☐ |
| 2.4 | Yesenia | Rechazar con el motivo *"Prueba piloto: ese día hay cierre"* | Aviso "Rechazada" | ☐ |
| 2.5 | Wanda | Mis solicitudes | Estado **Rechazada** y debajo: Tu jefe: "Prueba piloto: ese día hay cierre" | ☐ |
| 2.6 | Wanda | Pedir otra vez el **27 de noviembre** | Se puede (la rechazada ya no ocupa la fecha). Estado **Espera a tu jefe** | ☐ |
| 2.7 | Yesenia | **Autorizar** | Pasa a Gente y Cultura | ☐ |
| 2.8 | Montellano | `/vacaciones` → **Dar Vo. Bo.** a la solicitud de Wanda | Aviso "Aprobada" | ☐ |
| 2.9 | Wanda | **Ver constancia firmada** | Formato **DÍAS FLOTANTES GYC-DF012026**; firmas de Wanda, Yesenia y Montellano ("Vo. Bo. Coordinador Gente y Cultura") | ☐ |
| 2.10 | Wanda | Pegar en el navegador el enlace de la constancia de **Montellano** (de 1.14) | **No la ve**: la regresa a Mis vacaciones | ☐ |

---

## Bloque 3 — Cancelar y revertir

| # | Quién | Acción | Qué debe pasar | OK |
|---|---|---|---|---|
| 3.1 | Montellano | Solicitar el **1 de diciembre** y, sin que nadie la autorice, **Cancelar solicitud → Sí, cancelar** | Estado **Cancelada**. Los días en trámite vuelven a 0 | ☐ |
| 3.2 | Héctor | Mi equipo | La cancelada ya no aparece en "Por autorizar" | ☐ |
| 3.3 | Montellano (como RH) | En la ficha de Wanda, en **Historial**, **Anular** el día flotante del 27 de noviembre | El registro queda tachado. En **Mis vacaciones** de Wanda, la solicitud pasa a **Cancelada** | ☐ |

---

## Bloque 4 — Lo que cada quien ve

| # | Quién | Acción | Qué debe pasar | OK |
|---|---|---|---|---|
| 4.1 | Wanda | Abrir `/vacaciones` | La manda a **Mis vacaciones**: no ve al personal | ☐ |
| 4.2 | Héctor | Menú lateral | Ve **Mis vacaciones** y **Mi equipo**, no **Personal** (si no tiene la bandera de RH) | ☐ |
| 4.3 | Uzziel | **Mis vacaciones** | "Tu correo no está en la base de vacaciones" (no está en la base de Montellano; ver límites) | ☐ |

---

## Después del piloto

- **Si las vacaciones de Montellano eran de prueba,** anúlalas desde su ficha (Historial → Anular). Su solicitud queda **Cancelada** y el saldo regresa. Si eran reales, se dejan.
- Lo del Bloque 2 ya quedó cancelado en el paso 3.3.
- Pasa los hallazgos a la tabla de abajo y, si todo está en verde, se avisa al personal que entre con su correo corporativo.

---

## Límites conocidos (no son fallas del piloto)

- **No llegan correos.** Ni al jefe cuando le piden algo, ni al empleado cuando lo aprueban. Cada quien lo ve al entrar a la plataforma. Los recordatorios por correo dependen de verificar el envío de la plataforma.
- **Los días flotantes no tienen saldo.** Se cuentan los usados en el año, pero falta saber cuántos corresponden por año.
- **17 personas de la base no tienen correo** y 4 personas con correo no están en la base (incluido Uzziel): hasta que Gente y Cultura complete esos datos, esas personas no pueden pedir en línea.
- **Días hábiles = lunes a viernes**, sin los festivos de ley. Un caso que no encaje (alguien que trabaja sábados) lo registra Gente y Cultura a mano desde la ficha, con los días corregidos.
- Los días que **Gente y Cultura registra a mano** no pasan por las firmas de la plataforma: ese formato sigue saliendo para firma en papel.

---

## Hallazgos

| # | Paso | Qué pasó | Gravedad (🔴 bloquea / 🟡 molesta / 🟢 detalle) | Quién lo ve |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
