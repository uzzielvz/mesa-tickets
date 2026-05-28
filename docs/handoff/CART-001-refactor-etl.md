# Handoff CART-001 — Refactor `df_a_registros()` en `cartera_etl.py`

> **Para el agente que toma este ticket:** lee este documento **completo** antes de tocar código. Es el único brief autorizado para esta tarea.
>
> **Versión:** 1.1 (2026-05-28). Ver changelog al pie.

---

## 0. Roles

| Rol | Agente | Repo donde corre | Responsabilidad |
|---|---|---|---|
| **Coordinador** | Sesión Claude en `mea-tickets` | `mea-tickets` | Owner del plan. Genera prompts para el Implementador, valida entregables contra checklist §4, actualiza brief y PLAN.md, responde dudas. |
| **Implementador** | Sesión Claude en `crediflexi-services` | `crediflexi-services` | Ejecuta los cambios de §3 siguiendo prompts del Coordinador. Mantiene PR description como bitácora (ver §7). No improvisa scope. |
| **Postman** | El usuario (humano) | — | Único canal entre ambos agentes. Copia/pega prompts y reportes. |

> **Regla dura:** ningún agente toma decisiones de scope sin pasar por el Coordinador. Si el Implementador encuentra ambigüedad, escribe la pregunta en `docs/handoff/CART-001-questions.md` y para hasta tener respuesta.

---

## 1. TL;DR

El microservicio Python (`crediflexi-services`) procesa el Excel de Yunius e inserta registros en Supabase. Hoy persiste solo **~19 de las ~55 columnas** que el schema soporta, e inserta **3 columnas que ya no deberían persistirse**. Hay que cerrar ese gap según la matriz de mapeo ya definida.

**Ticket:** C1-1 / CART-001 en `PLAN.md`.
**Bloquea:** C1-2 (`fecha_inicio_ciclo`), C1-4 (`cartera_export.py`), todos los dashboards.

---

## 2. Repos involucrados

| Rol | Path local | Acción |
|---|---|---|
| **Trabajo principal** | `C:\Users\uzzie\Documents\Jale\crediflexi-services` | Cambios aquí. Crear branch + PR. |
| **Plataforma (referencia)** | `C:\Users\uzzie\Documents\mea-tickets` | Solo lectura. Schema, tipos y docs viven aquí. |

> El schema ya se actualizó en `mea-tickets` (migración `20260528190511_cart_000d_cols_faltantes.sql`, aplicada al remoto). Los tipos espejo están en `lib/supabase/database.types.ts` — úsalos como **fuente de verdad** para los nombres de columnas y tipos esperados.
>
> **Para que el Implementador pueda leer sin clonar `mea-tickets`:** el usuario debe pushear copia de estos archivos a `crediflexi-services/docs/from-platform/` (o equivalente):
> - `mea-tickets/PLAN.md`
> - `mea-tickets/RESEARCH-CONSOLIDADO.md`
> - `mea-tickets/docs/cartera/*.md` (input/output/mapping)
> - `mea-tickets/docs/handoff/CART-001-refactor-etl.md` (este archivo)
> - `mea-tickets/lib/supabase/database.types.ts`

---

## 3. Lectura obligatoria (en este orden)

1. **`PLAN.md`** § Fase Cartera-1 — el ticket C1-1 con sus dependencias.
2. **`docs/cartera/mapping-matrix.md`** — **única fuente de verdad** input ↔ schema ↔ output:
   - §2 (matriz maestra de 76 filas).
   - §3.2 (cambios requeridos en `cartera_etl.py`).
   - §4 (checklist de aceptación).
3. **`docs/cartera/input-analysis.md`** — qué trae el Excel de Yunius (63 cols, sample 343 filas).
4. **`docs/cartera/output-analysis.md`** — qué espera el FINAL TARGET.
5. **`RESEARCH-CONSOLIDADO.md`** § 5.4 y §5.4.9 (hallazgos profundos del análisis).
6. **`database.types.ts`** — busca el tipo de `stg_yunius_cartera_individual` y `loan_amortizacion_individual` para confirmar nombres exactos.
7. **`services/cartera_etl.py`** — estado actual.

---

## 4. Cambios concretos (definición de hecho operativa)

### 4.1 En `services/cartera_etl.py`

1. **Extender `COLUMN_MAPPING`** con todas las cols del input persistibles. Hoy mapea ~10 de 63. Referencia: matriz maestra §2 (col "Input header" → col "Schema staging col"). Excluir las marcadas como `📤` (calculadas en export) o sin destino en staging.

2. **Refactor `df_a_registros()`** (líneas ~301-341 actuales):
   - **Eliminar** los inserts de `cuotas_sin_pagar` y `combinado` (esas columnas NO deben persistirse, son derivadas al exportar).
   - **Mantener** el insert de `concepto_deposito` (sí persiste, ya existe en schema).
   - **Agregar** los inserts faltantes (~38 cols) para llenar el resto del staging, incluidas las 11 nuevas de C0-4: `situacion_credito`, `medio_comunic_2`, `medio_comunic_3`, `tipo_garantia_2`, `descripcion_garantia_2`, `garantia_2`, `calle`, `colonia`, `nom_personal_castiga_cartera`, `frecuencia`, `parcialidad_comision`.

3. **`.zfill(2)` en `ciclo`** en algún paso temprano de la pipeline (similar a `codigo_acreditado.zfill(6)`).

4. **Quitar el filtro `CODIGOS_RECUPERADOR_EXCLUIR` al persistir.** Decisión 2026-05-28: persistimos todo (incluido `000124`) y solo filtramos al generar la hoja `X_Recuperador` del export. Esto desbloquea reportes futuros.

### 4.2 En `loan_amortizacion_individual` (si aplica en esta iteración)

- Las cols `fuente_fecha_liquidacion`, `es_no_aplica_liquidacion`, `codigo_ciclo` ya existen en el schema (C0-4). Si el código de ETL de amortizaciones ya las puede llenar, hazlo. Si no, **déjalo para CART-003** (no expandas scope).

### 4.3 NO hacer en este ticket

- ❌ No tocar `cartera_export.py` (es C1-4).
- ❌ No agregar Dockerfile ni deploy (es C1-5 / OPS-001).
- ❌ No agregar HMAC (es C1-6 / SEC-002).
- ❌ No crear vistas/RPCs en Supabase (es C2-*).
- ❌ No tocar el repo `mea-tickets`. Si algo del schema o tipos parece incorrecto, **escribe la pregunta en `docs/handoff/CART-001-questions.md`** y para.

---

## 5. Criterios de aceptación (validables)

Adaptado de `mapping-matrix.md` §4:

- [ ] `COLUMN_MAPPING` cubre **todas** las cols persistibles del input.
- [ ] `df_a_registros()` ya **no** inserta `cuotas_sin_pagar` ni `combinado`.
- [ ] `df_a_registros()` inserta las cols del input que hoy ignora (~38 nuevas).
- [ ] Las 11 cols nuevas de C0-4 se pueblan correctamente cuando el input las trae.
- [ ] `ciclo` se zero-padea a 2 chars antes de persistir.
- [ ] `concepto_deposito` se persiste con formato `1XXXXXXYY` (9 chars).
- [ ] `CODIGOS_RECUPERADOR_EXCLUIR` ya **no** se filtra al persistir.
- [ ] Smoke test manual: cargar `ReportedeAntiguedad_nuevo_31032026.xlsx` (en repo legacy) → verificar en Supabase que `stg_yunius_cartera_individual` tiene un sample de filas con las nuevas cols pobladas (no todas nulas).
- [ ] El microservicio no lanza errores nuevos.
- [ ] PR abierto con descripción que enlace este handoff y la matriz, y con checklist marcada.

---

## 6. Convenciones del proyecto

- **Branch:** `cart-001-refactor-etl` (mismo nombre, por trazabilidad).
- **Commits atómicos**, en español, descriptivos. Sin commits gigantes.
- **Sin `Co-Authored-By: Claude`** ni firmas del agente en los commits (preferencia del owner — `memory/feedback_commits.md` en `mea-tickets`).
- **Comentarios en español, código (variables/funciones) en inglés.**
- Si una decisión técnica te bloquea, documéntala en `CART-001-questions.md` y deja `TODO:` en el código en vez de adivinar.

---

## 7. Protocolo de comunicación

### 7.1 PR description como bitácora viva

El Implementador mantiene **la descripción del PR** como única fuente de status. Plantilla:

```markdown
## CART-001 — Refactor df_a_registros()

Brief: docs/from-platform/handoff/CART-001-refactor-etl.md (v1.1)

### Estado
- Iteración: 1
- Última actualización: YYYY-MM-DD HH:MM
- Bloqueado: NO / SÍ (ver §Bloqueadores)

### Checklist (§5 del brief)
- [x] COLUMN_MAPPING cubre todas las cols persistibles
- [ ] df_a_registros no inserta cuotas_sin_pagar ni combinado
- [ ] df_a_registros inserta ~38 cols nuevas
- [ ] 11 cols de C0-4 pobladas
- [ ] zfill(2) en ciclo
- [ ] concepto_deposito formato 1XXXXXXYY
- [ ] CODIGOS_RECUPERADOR_EXCLUIR removido al persistir
- [ ] Smoke test: OK / pendiente / falló
- [ ] No hay errores nuevos en el microservicio

### Bloqueadores / preguntas
(ninguno) — o lista con link a CART-001-questions.md#qN

### Smoke test
(no realizado) — o pegar COUNT(*), sample de filas, screenshot

### Cambios resumidos
- Cols agregadas al insert: ...
- Cols removidas del insert: cuotas_sin_pagar, combinado
- Otros: ...
```

### 7.2 Reporte al Coordinador

Tras cada cambio significativo, el Implementador devuelve al **Postman** un bloque corto en este formato (el Postman lo pega al Coordinador):

```
REPORT CART-001
- Branch: cart-001-refactor-etl
- Último commit: <hash> <mensaje corto>
- Checklist completada: N/9
- Bloqueado: NO/SÍ
- (si SÍ) Pregunta abierta: <link CART-001-questions.md#qN>
- Siguiente paso planeado: ...
```

### 7.3 Preguntas abiertas

Cuando el Implementador necesite decisión del Coordinador:

1. Abre / agrega a `docs/handoff/CART-001-questions.md` (en `crediflexi-services/docs/from-platform/handoff/`).
2. Formato por pregunta:
   ```markdown
   ## Q3 — 2026-05-29
   **Contexto:** ...
   **Pregunta:** ...
   **Opciones consideradas:** A) ... B) ...
   **Recomendación del Implementador:** A, porque ...

   ---
   **Respuesta del Coordinador (YYYY-MM-DD):** <pendiente>
   ```
3. Para el trabajo en el código relacionado y reporta bloqueador al Postman.

### 7.4 Versión del brief

- Versión actual visible al inicio del documento.
- Cualquier cambio del Coordinador bumpea versión menor (1.1 → 1.2) y añade entrada en §10 Changelog.
- El Implementador **siempre** verifica versión al inicio de cada iteración.

---

## 8. Entregable final

- **1 PR en `crediflexi-services`** contra `main`, branch `cart-001-refactor-etl`.
- PR description completa (§7.1) con checklist 100% marcada o explicación de cada uncheck.
- Smoke test ejecutado y reportado.
- Sin cambios fuera del scope §4 (si los hubo, deshacerlos antes de mergear).

---

## 9. Estado al momento del handoff

- Última commit en `mea-tickets/main`: `1edbea7 docs(handoff): brief CART-001`.
- Schema en producción Supabase: 22 baseline + `20260528190511_cart_000d_cols_faltantes.sql`.
- `crediflexi-services` sin cambios pendientes relacionados (verificar `git status` al empezar).

---

## 10. Changelog

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 1.0 | 2026-05-28 | Coordinador inicial | Brief original con §1-§9. |
| 1.1 | 2026-05-28 | Coordinador | Agrega §0 Roles, §7 Protocolo de comunicación (PR como bitácora, reporte estandarizado, preguntas abiertas, versionado), §10 Changelog. Mueve "Convenciones" y "Entregable" sin cambio de contenido. |

**Fin del brief.**
