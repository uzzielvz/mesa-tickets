# PLAN — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Plan de trabajo activo. Se actualiza tras cada sesión.
> Para el contexto completo del repo ver `RESEARCH-CONSOLIDADO.md`.
> Última actualización: 2026-05-25.

---

## 1. Definición de Proyecto Cerrado

**Cuándo damos por cerrada la versión actual (v1.0):**

1. **Cartera Individual funcional end-to-end en producción**: carga, ETL y al menos 3 vistas (resumen, cobranza, riesgo) consumiendo `stg_yunius_cartera_individual`.
2. **Microservicio `crediflexi-services` desplegado** (no localhost) con auth HMAC entre Next.js y el servicio.
3. **RLS endurecida**: `ticket_attachments.insert` valida participación, bucket Storage `ticket-attachments` con políticas versionadas.
4. **Feedback de errores visible** en creación de tickets y adjuntos iniciales mostrados en el hilo.
5. **Tipos Supabase regenerados** (`supabase gen types`) incluyendo cartera y RPCs.
6. **Smoke E2E** mínimo (login + crear ticket + crear acreditado + cargar cartera) corriendo en local.

**Lo que NO entra en v1.0** (queda para v1.1+):
- Chat IA en cartera.
- Notificaciones email (Resend).
- Dominio custom.
- Tests E2E completos.
- Migraciones automatizadas en CI.
- Migración de mutaciones de tickets a Server Actions (se hace gradual post v1.0).

---

## 2. Fases

### Fase A — Cierre de Cartera (crítica, 1-2 semanas)

**Objetivo**: cartera consumible. Sin esto, el módulo es un cargador sin uso.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| A1 | OPS-001 | Dockerfile + deploy `crediflexi-services` (Railway/Fly/Render) | — |
| A2 | SEC-002 | HMAC entre `/api/cartera/procesar` y microservicio | A1 |
| A3 | PRO-001 | Página `/cartera` con resumen (total cartera, total mora, % PAR, top coordinaciones) | — |
| A4 | PRO-002 | Página `/cartera/cobranza` (tickets por recuperador + filtros días mora) | — |
| A5 | PRO-003 | Página `/cartera/riesgo` (distribución PAR, top deudores, concentración) | — |
| A6 | TYP-001 | Regenerar `lib/supabase/types.ts` con cartera y RPCs | — |

### Fase B — Endurecimiento de seguridad (1 semana)

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| B1 | RLS-001 | Policy `attachments_insert` con EXISTS sobre participación en ticket | — |
| B2 | RLS-005 | Migración versionada con políticas Storage para bucket `ticket-attachments` | — |
| B3 | RLS-002 | Restringir `profiles_select` (vista pública o admin only) | — |
| B4 | RLS-003 | Validar capturador en `acreditado_referencias/historial` INSERT | — |
| B5 | RLS-004 | Trigger que rechace `INSERT` en `ticket_responses` si `closed_at IS NOT NULL` | — |
| B6 | SEC-003 | Trigger DB recalcula `puntaje_total` (evita manipulación vía API) | — |

### Fase C — UX y feedback (3-5 días)

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C1 | UI-001 | ~~Toast de error + revert loading en `ticket-form`~~ ✅ 2026-05-25 | — |
| C2 | UI-002 | ~~Adjuntos iniciales visibles en `ticket-thread`~~ ✅ 2026-05-25 | — |
| C3 | UI-003 | Copy en `?error=auth` en login | — |
| C4 | UI-004 | `app/error.tsx` global + `app/(dashboard)/cartera/error.tsx` | — |
| C5 | DB-004 | Mapear todos los errores RPC en `guardarEvaluacion` | — |

### Fase Demo — Mínimo viable para mostrar (esta semana)

**Objetivo**: app navegable end-to-end para demo personal/ejecutiva.
Cartera dashboards quedan FUERA del scope demo (se enseña como “en construcción”).

| # | Ticket | Estado | Notas |
|---|--------|--------|-------|
| D-1 | UI-001 | ✅ | Toast de error en creación de ticket |
| D-2 | UI-002 | ✅ | Adjuntos iniciales se ven en hilo |
| D-3 | — | 🔲 | Smoke local: login → crear ticket con evidencia → responder → cerrar |
| D-4 | — | 🔲 | Smoke local: cargar Excel cartera (microservicio local) → ver lista |
| D-5 | UI-003 | 🔲 | Copy de error en login (`?error=auth`) — quick win |
| D-6 | UI-004 | 🔲 | `app/error.tsx` global para no mostrar pantalla blanca

### Fase D — Estabilización (post-v1.0)

| # | Ticket | Descripción |
|---|--------|-------------|
| D1 | SEC-001 | Migrar `crearTicket` y `responderTicket` a Server Actions con Zod servidor |
| D2 | DB-001 | RPC atómica `upsert_acreditado` (acreditado + referencias en una transacción) |
| D3 | DEB-001 | Setup Vitest + Playwright + smoke E2E |
| D4 | OPS-002 | Supabase CLI + `supabase db push` en GitHub Actions |
| D5 | PRO-005 | Notificaciones Resend (nuevo ticket, nueva respuesta, cierre) |
| D6 | PRO-004 | Chat IA en `/cartera/chat` (decidir LLM provider) |
| D7 | PRO-006 | Dominio custom `tickets.financieracrediflexi.com` |

---

## 3. Backlog Priorizado

**Orden de ejecución sugerido (próximos tickets):**

1. **A1 — Deploy microservicio** (sin esto cartera no existe en prod).
2. **A6 — Regenerar tipos** (rápido, desbloquea autocompletado en A3-A5).
3. **A3 — Dashboard cartera resumen** (mayor visibilidad ejecutiva).
4. **A2 — HMAC microservicio** (necesario antes de exponer URL pública).
5. **B1 + B2** — RLS adjuntos (riesgo de seguridad real).
6. **C1 + C2** — UX tickets (bugs reportables hoy).
7. **A4 + A5** — Cobranza y riesgo cartera.
8. **B3 + B4 + B5** — Resto de RLS.
9. **C3 + C4 + C5** — Pulido UX.
10. **B6** — Trigger recalcula score.

---

## 4. Decisiones Tomadas

### Arquitectura

- **2026-05-24** — Cartera se procesa en microservicio Python **separado** (`crediflexi-services`), no embebido en Next.js. Razón: pandas + openpyxl pesan demasiado para serverless; mejor separación de concerns.
- **2026-05-24** — FastAPI sobre Flask para el microservicio. Razón: auto-docs, tipos, async nativo.
- **2026-05-24** — Repos separados (no monorepo). Razón: deploys y ciclos de vida independientes.
- **2026-05-24** — El microservicio usa Supabase `service_role_key` para insertar en `stg_yunius_*` (bypassa RLS). Razón: bulk insert eficiente; RLS aplica para lectura desde Next.js.
- **2026-05-24** — Estado de carga se persiste en `cartera_uploads.estado` (pendiente/procesando/procesado/error). Frontend hace polling cada 3s. Auto-cleanup a 10 min.

### Datos

- **2026-05-20** — `cartera_uploads` y `stg_yunius_cartera_individual` separadas: uploads es el ledger, stg es el dato crudo. Permite re-procesar sin perder histórico.
- **2026-05-24** — Storage bucket `cartera` con políticas RLS por `acceso_cartera` o `rol=admin`.

### Convenciones

- **Commits atómicos** por cambio lógico. No commits gigantes.
- **Sin coautoría Claude** en commits (per user preference en `memory/feedback_commits.md`).
- **Comentarios en español, código en inglés** (variables, funciones).
- **Spanish UI copy** (todo lo visible al usuario).
- **Server Components por default**, Client Components solo para interactividad.

---

## 5. Próximos Pasos (sesión inmediata)

1. **Decisión pendiente** — ¿Dónde se despliega `crediflexi-services`? (Railway free tier es opción simple).
2. **Ejecutar A6** — `supabase gen types typescript --project-id riqrhiivtoodtzptbwls > lib/supabase/types.ts` (requiere CLI logueado).
3. **Ejecutar A3** — Página `/cartera` con queries agregadas sobre `stg_yunius_cartera_individual`:
   - Cards: total acreditados activos, saldo total, % PAR>30, % PAR>90
   - Tabla: distribución por `par_bucket`
   - Gráfica: top 10 coordinaciones por mora (texto bar mientras decidimos librería)

---

## 6. Convenciones de Trabajo

### IDs de tickets

Prefijos consistentes en `RESEARCH-CONSOLIDADO.md` §6 y aquí:

- `SEC-` Seguridad / arquitectura
- `RLS-` Row Level Security específico
- `AUTH-` Autenticación / autorización
- `UI-` Interfaz / UX
- `API-` Route handlers / endpoints
- `DB-` Datos / Server Actions / consistencia
- `TYP-` Tipos TypeScript
- `PERF-` Performance
- `OPS-` Operación / deploy / CI
- `DEB-` Tests / debugging
- `PRO-` Producto / features nuevas

### Migraciones

- Nombre: `YYYYMMDDHHMMSS_descripcion.sql`
- Idempotentes cuando sea posible (`if not exists`, `or replace`)
- Una preocupación por archivo
- Documentar en `supabase/migrations/GUIA-SQL-SUPABASE.md` si requieren orden manual

### Commits

- Atómicos, un cambio lógico por commit
- Mensaje: `tipo(scope): descripción corta`
  - Tipos: `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`, `test`
  - Scope: `tickets`, `score`, `cartera`, `admin`, `auth`, `rls`, `infra`
- Sin coautoría Claude

### Workflow

1. Antes de empezar tarea grande: revisar `RESEARCH-CONSOLIDADO.md` y `PLAN.md`.
2. Antes de tocar código: leer los archivos afectados completos.
3. Commits atómicos durante el avance.
4. Al cerrar tarea: actualizar `PLAN.md` (mover ticket de Backlog a "Completados" o eliminar) y, si aplica, actualizar `RESEARCH-CONSOLIDADO.md`.

---

## 7. Completados recientes

- **2026-05-25** — UI-001 + UI-002: feedback de error en tickets y adjuntos iniciales visibles.
- **2026-05-24** — Cartera end-to-end funcional (UI + Storage + microservicio + ETL).
- **2026-05-24** — Auto-cleanup de uploads colgados (timeout 10 min).
- **2026-05-20** — Schema cartera + RLS + acceso por perfil.
- **2026-05-14** — Catálogo dinámico, rechazo, onboarding, presets login.
- **2026-04-24** — Módulo Score Crediticio completo.
- **2026-04-21** — Base: tickets, RLS, vistas, triggers.

---

*Fin del plan.*
