# Guía: qué SQL correr en Supabase (desde cero o a medias)

Si una migración falla con **"already exists"**, significa que **esa parte ya está aplicada**. No la vuelvas a correr entera; sigue con la siguiente de la lista o usa solo el bloque que falte.

---

## Paso 0 — Verificar qué ya tienes

Corre esto en el **SQL Editor** y revisa los resultados:

```sql
-- ¿Tablas de score?
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('acreditados', 'acreditado_referencias', 'acreditado_historial');

-- ¿Columna acceso_score en profiles?
select column_name from information_schema.columns
where table_name = 'profiles' and column_name = 'acceso_score';

-- ¿Funciones nuevas?
select proname from pg_proc
where proname in (
  'has_score_access',
  'complete_onboarding',
  'guardar_evaluacion_promotor'
);

-- ¿Columnas dinámicas de tickets?
select column_name from information_schema.columns
where table_name = 'problem_catalog' and column_name = 'campos';
```

| Si ves… | Significa |
|---------|-----------|
| Las 3 tablas `acreditados*` | Scoring base **ya está** → no repitas `20260424000001` desde cero |
| `acceso_score` | Columna de acceso al módulo score **lista** |
| `complete_onboarding` | Onboarding primer login **lista** |
| `guardar_evaluacion_promotor` | Evaluación del promotor **lista** |
| `campos` en `problem_catalog` | Catálogo dinámico de tickets **listo** |

---

## Orden recomendado (copiar cada archivo y Run)

Solo corre los que **aún no** tengas según el paso 0.

### Tickets (si el proyecto ya estaba en prod, probablemente ya están)

| # | Archivo | Notas |
|---|---------|--------|
| — | `20260421000001_initial_schema.sql` | Solo instalación nueva |
| — | `20260421000002_rls_policies.sql` | Solo instalación nueva |
| — | `20260421000003_views_and_functions.sql` | Solo instalación nueva |
| — | `20260421000004_triggers.sql` | Solo instalación nueva |

### Score (módulo acreditados)

| # | Archivo | ¿Cuándo? |
|---|---------|----------|
| 1 | `20260424000001_scoring_schema.sql` | **Solo si** en paso 0 NO existen las tablas. Si falló a medias, puedes **volver a correrlo entero** (ahora es idempotente con `drop policy if exists`). |
| 2 | `20260514000005_scoring_rls_fixes.sql` | **Siempre** si no existe `guardar_evaluacion_promotor` |
| 3 | `20260514000006_acreditados_delete.sql` | **Siempre** si quieres botón Eliminar |

### Tickets + onboarding + rechazo + campos dinámicos

| # | Archivo | Notas |
|---|---------|--------|
| 4 | `20260514000001_onboarding.sql` | Primer login (nombre + área) |
| 5 | `20260514000002_rechazo_enum.sql` | **Solo esta línea, sola, un Run** |
| 6 | `20260514000003_rechazo_logic.sql` | Después del paso 5 |
| 7 | `20260514000004_dynamic_fields.sql` | Campos dinámicos en catálogo/tickets |

---

## Tu caso concreto (error `acreditados_select` already exists)

1. **No te preocupes** — el scoring base **ya está** en la base.
2. **No vuelvas a correr** solo por ese error; o re-ejecuta `20260424000001` completo (ya idempotente) o salta al paso 3.
3. Corre **en este orden** lo que falte:
   - `20260514000005_scoring_rls_fixes.sql`
   - `20260514000006_acreditados_delete.sql`
   - Si aún no corriste tickets nuevos: `01` onboarding → `02` rechazo enum **solo** → `03` rechazo logic → `04` dynamic fields
4. Verifica:

```sql
select proname from pg_proc where proname = 'guardar_evaluacion_promotor';
-- debe devolver 1 fila
```

5. En la app: **Admin → Usuarios** → activa toggle **Score** a tu usuario → entra a **Score Crediticio**.

---

## Regla del enum de rechazo (importante)

`20260514000002_rechazo_enum.sql` debe ejecutarse **sola** (un solo `alter type ... add value`). No la mezcles con otras sentencias en el mismo Run.
