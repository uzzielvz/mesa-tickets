# Handoff CART-001 — Refactor `df_a_registros()` en `cartera_etl.py`

> **Para el agente que toma este ticket:** lee este documento **completo** antes de tocar código. Es el único brief autorizado para esta tarea.

---

## 0. TL;DR

El microservicio Python (`crediflexi-services`) procesa el Excel de Yunius e inserta registros en Supabase. Hoy persiste solo **~19 de las ~55 columnas** que el schema soporta, e inserta **3 columnas que ya no deberían persistirse**. Hay que cerrar ese gap según la matriz de mapeo ya definida.

**Ticket:** C1-1 / CART-001 en `PLAN.md`.
**Bloquea:** C1-2 (`fecha_inicio_ciclo`), C1-4 (`cartera_export.py`), todos los dashboards.

---

## 1. Repos involucrados

| Rol | Path local | Acción |
|---|---|---|
| **Trabajo principal** | `C:\Users\uzzie\Documents\Jale\crediflexi-services` | Cambios aquí. Crear branch + PR. |
| **Plataforma (referencia)** | `C:\Users\uzzie\Documents\mea-tickets` | Solo lectura. Schema, tipos y docs viven aquí. |

> El schema ya se actualizó en `mea-tickets` (migración `20260528190511_cart_000d_cols_faltantes.sql`, aplicada al remoto). Los tipos espejo están en `lib/supabase/database.types.ts` — úsalos como **fuente de verdad** para los nombres de columnas y tipos esperados.

---

## 2. Lectura obligatoria (en este orden)

1. **`mea-tickets/PLAN.md`** § Fase Cartera-1 — el ticket C1-1 con sus dependencias.
2. **`mea-tickets/docs/cartera/mapping-matrix.md`** — **la única fuente de verdad** input ↔ schema ↔ output. Especialmente:
   - §2 (matriz maestra de 76 filas).
   - §3.2 (cambios requeridos en `cartera_etl.py`).
   - §4 (checklist de aceptación).
3. **`mea-tickets/docs/cartera/input-analysis.md`** — qué trae el Excel de Yunius (63 cols, sample 343 filas).
4. **`mea-tickets/docs/cartera/output-analysis.md`** — qué espera el FINAL TARGET.
5. **`mea-tickets/RESEARCH-CONSOLIDADO.md`** § 5.4 (cartera completa) y §5.4.9 (hallazgos profundos).
6. **`mea-tickets/lib/supabase/database.types.ts`** — busca el tipo de `stg_yunius_cartera_individual` y `loan_amortizacion_individual` para confirmar nombres exactos.
7. **`crediflexi-services/services/cartera_etl.py`** — estado actual.

---

## 3. Cambios concretos (definición de hecho operativa)

### 3.1 En `services/cartera_etl.py`

1. **Extender `COLUMN_MAPPING`** con todas las cols del input persistibles. Hoy mapea ~10 de 63. Referencia: matriz maestra §2 (col "Input header" → col "Schema staging col"). Excluir las marcadas como `📤` (calculadas en export) o sin destino en staging.

2. **Refactor `df_a_registros()`** (líneas ~301-341 actuales):
   - **Eliminar** los inserts de `cuotas_sin_pagar` y `combinado` (esas columnas NO deben persistirse, son derivadas al exportar).
   - **Mantener** el insert de `concepto_deposito` (sí persiste, ya existe en schema).
   - **Agregar** los inserts faltantes (~38 cols) para llenar el resto del staging, incluidas las 11 nuevas de C0-4: `situacion_credito`, `medio_comunic_2`, `medio_comunic_3`, `tipo_garantia_2`, `descripcion_garantia_2`, `garantia_2`, `calle`, `colonia`, `nom_personal_castiga_cartera`, `frecuencia`, `parcialidad_comision`.

3. **`.zfill(2)` en `ciclo`** en algún paso temprano de la pipeline (similar a `codigo_acreditado.zfill(6)`).

4. **Quitar el filtro `CODIGOS_RECUPERADOR_EXCLUIR` al persistir.** Decisión 2026-05-28: persistimos todo (incluido `000124`) y solo filtramos al generar la hoja `X_Recuperador` del export. Esto desbloquea reportes futuros.

### 3.2 En `loan_amortizacion_individual` (si aplica en esta iteración)

- Las cols `fuente_fecha_liquidacion`, `es_no_aplica_liquidacion`, `codigo_ciclo` ya existen en el schema (C0-4). Si el código de ETL de amortizaciones ya las puede llenar, hazlo. Si no, **déjalo para CART-003** (no expandas scope).

### 3.3 NO hacer en este ticket

- ❌ No tocar `cartera_export.py` (es C1-4).
- ❌ No agregar Dockerfile ni deploy (es C1-5 / OPS-001).
- ❌ No agregar HMAC (es C1-6 / SEC-002).
- ❌ No crear vistas/RPCs en Supabase (es C2-*).
- ❌ No tocar `mea-tickets`. Si encuentras algo que falte en el schema o tipos, abrir issue, **no commitear ahí**.

---

## 4. Criterios de aceptación (validables)

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
- [ ] PR abierto con descripción que enlace este handoff y la matriz.

---

## 5. Convenciones del proyecto

- **Branch:** `cart-001-refactor-etl` (mismo nombre, por trazabilidad).
- **Commits atómicos**, en español, descriptivos. Sin commits gigantes.
- **Sin `Co-Authored-By: Claude`** ni firmas del agente en los commits (preferencia del owner — `mea-tickets/memory/feedback_commits.md`).
- **Comentarios en español, código (variables/funciones) en inglés.**
- Si una decisión técnica te bloquea, documéntala en el PR y deja `TODO:` en el código en vez de adivinar.

---

## 6. Entregable

- **1 PR en `crediflexi-services`** contra `main`, branch `cart-001-refactor-etl`.
- Descripción del PR incluye:
  - Link a este handoff (raw URL del archivo en GitHub).
  - Resumen de cols agregadas / removidas.
  - Output del smoke test (capture o COUNT de Supabase).
  - Checklist §4 marcada.
- Si descubres que el schema necesita más cambios, **NO los hagas tú**: documenta en el PR y deja CART-001 enfocado solo en el refactor del ETL.

---

## 7. Estado al momento del handoff

- Última commit en `mea-tickets/main`: `1568abc docs(plan): marca C1-7 hecho`.
- Schema en producción: 22 baseline + `20260528190511_cart_000d_cols_faltantes.sql`.
- `crediflexi-services` no tiene cambios pendientes relacionados (verificar `git status` al empezar).

**Fin del brief.**
