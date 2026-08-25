# Módulo Reclutamiento — documentación

**Estado: v1.0 en lanzamiento** (2026-08-24). Módulo completo de `postulado` a `contratado`, desplegado y operable.

Lleva a un candidato de la postulación a la contratación dentro de la plataforma, generando por sí solo las citas de Google Meet, los correos a candidatos y entrevistadores, las ligas de evaluación y el aviso interno de altas.

---

## El paquete de lanzamiento

Cuatro documentos, cada uno para alguien distinto. **Empieza por el que corresponda a tu papel.**

| Documento | Para quién | Qué contiene |
|---|---|---|
| **[`manual-usuario.md`](./manual-usuario.md)** | Quien **opera** el módulo (RH) | El paso a paso completo, pantalla por pantalla. Qué hacer cuando algo falla. Preguntas frecuentes. |
| **[`documentacion-funcional.md`](./documentacion-funcional.md)** | Quien necesita **entender** el sistema | Qué hace, el pipeline y qué dispara cada transición, el algoritmo de la cascada, los 6 correos, permisos, arquitectura, modelo de datos y **límites conocidos de la v1**. |
| **[`runbook-operacion.md`](./runbook-operacion.md)** | Quien lo **mantiene** | Modos de falla con síntoma → causa → arreglo. Qué es best-effort y qué es bloqueante. Kill switch. Riesgos abiertos. |
| **[`prevuelo-lanzamiento.md`](./prevuelo-lanzamiento.md)** | Quien **valida antes de anunciar** | Guion de smoke test end-to-end en 7 bloques, con criterio explícito de go/no-go. |

**Para anunciarlo:**

| Documento | Qué es |
|---|---|
| **[`presentacion-lanzamiento.html`](./presentacion-lanzamiento.html)** | Deck de 20 diapositivas. Se abre en el navegador; para PDF, imprimir desde ahí. Bloque ejecutivo (Dirección / G&C) + bloque operativo (RH) + alcance y seguridad. |
| **[`anuncio-lanzamiento.md`](./anuncio-lanzamiento.md)** | Tres textos listos para copiar: a Dirección, a las áreas que empiezan a recibir el aviso automático de altas, y mensaje corto de chat. |

### Versiones en PDF

Los cuatro documentos de la primera tabla tienen su `.pdf` al lado, para compartir con quien no abre el repo. **El `.md` es la fuente; el PDF es un artefacto** — se regenera con:

```bash
node scripts/md-a-pdf.mjs docs/reclutamiento/manual-usuario.md
node scripts/md-a-pdf.mjs docs/reclutamiento/*.md    # todos de golpe
```

Requiere Chrome instalado (o Edge; o define `CHROME_PATH`). No agrega dependencias: usa `micromark` que ya está en el árbol. Si edificas el `.md`, **regenera el PDF** — si no, la copia que circula miente.

---

## Orden de lanzamiento

```
1. Cerrar riesgos      → prevuelo-lanzamiento.md, Bloque 0
   (destinatarios reales · Factorial apagado · cuenta emisora de Google)

2. Validar             → prevuelo-lanzamiento.md, Bloques 1-7
   Criterio de GO: los 6 correos en verde + magic link sin sesión

3. Anunciar            → anuncio-lanzamiento.md
```

**El anuncio va al final, no al principio.** El módulo lleva desde el 31 de julio con todo el código escrito y nunca se ha ejercitado de punta a punta: ninguno de sus 6 correos se ha visto llegar en un flujo real.

---

## Dos cosas que hay que saber antes de tocarlo

1. **Factorial HR está apagado a propósito** (`rec_ajustes.factorial.sync_activa = false`). La integración existe pero nunca se ha probado contra producción. Encenderla sin validar significa que el primer candidato real es la prueba. Procedimiento para encenderla en el [runbook §6](./runbook-operacion.md).

2. **Un correo que falla no revierte la acción.** Si el correo de bienvenida no sale, el candidato **igual queda contratado**. Hay que revisar `/reclutamiento/correos` después de cada contratación. Detalle en el [runbook §1.1](./runbook-operacion.md).

---

## Referencias del repo

- **Plan de ejecución e historia de sprints (S1–S9.5):** `PLAN.md §8`.
- **Contexto, stakeholders, flujo as-is y decisiones de arquitectura:** `RESEARCH-CONSOLIDADO.md §13`.
- **Código:** `app/(dashboard)/reclutamiento/`, `app/evaluar/[token]/`, `lib/reclutamiento/`, `lib/actions/{reclutamiento,agendamiento,comite,evaluaciones,ajustes}.ts`, migraciones `rec_001`…`rec_023`.
