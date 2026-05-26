# RESEARCH CONSOLIDADO — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Single source of truth del estado real del repo.
> Última actualización: 2026-05-25.
> Para el plan de trabajo activo ver `PLAN.md`.

---

## 1. Resumen Ejecutivo

**mea-tickets** es la plataforma interna de Financiera CrediFlexi (Next.js 14 App Router + Supabase). Hoy tiene tres módulos en producción y un cuarto en construcción:

1. **Mesa de tickets** (Fase 1-5): operativo, en producción.
2. **Score Crediticio** (acreditados + modelo HM): operativo.
3. **Onboarding + presets de operador**: operativo.
4. **Cartera Individual** (en curso): UI de carga lista, microservicio Python FastAPI separado (`crediflexi-services`) procesa Excel de Yunius vía ETL e inserta en `stg_yunius_cartera_individual`. Faltan dashboards (resumen, cobranza, riesgo) y módulo de Chat IA.

**Estado general**: utilizable en producción para tickets y score. Cartera funciona end-to-end (191 registros procesados en pruebas) pero le faltan vistas de explotación de los datos.

**Riesgos principales**:
- Seguridad RLS: `attachments_insert` no valida participación en ticket; `profiles_select using (true)` expone PII interna.
- Arquitectura: mutaciones de tickets y admin se hacen **desde el cliente** (no Server Actions), la seguridad depende 100% de RLS.
- Cartera: la carga depende de un microservicio externo (`crediflexi-services`) que aún no está desplegado en producción (solo localhost).
- Tipos Supabase escritos a mano (`lib/supabase/types.ts`) — falta sincronizar con `cartera_uploads`, `stg_yunius_cartera_individual`, RPCs.
- Sin tests automatizados, sin CI configurado, sin `error.tsx` global.

**Recomendación inmediata**: cerrar Cartera (dashboards básicos + deploy del microservicio) antes de expandir a Chat IA, y endurecer RLS de adjuntos en paralelo.

---

## 2. Contexto del Proyecto

### Identidad

| Campo | Valor |
|-------|-------|
| Nombre npm | `mesa-tickets` v0.1.0 |
| Producto | Plataforma interna: Tickets + Score + Cartera + (futuro) Chat IA |
| Org | Financiera CrediFlexi |
| Auth | Google OAuth + magic link, dominio `@financieracrediflexi.com` |
| Producción | Vercel (`mesa-tickets.vercel.app`) |
| Repo | `github.com/uzzielvz/mesa-tickets` (privado) |
| Microservicio | `github.com/uzzielvz/crediflexi-services` (privado, sin deploy) |

### Stack

- **Framework**: Next.js 14.2.35 (App Router) + React 18 + TypeScript 5
- **DB/Auth/Storage**: Supabase (`@supabase/ssr ^0.10.2`, `@supabase/supabase-js ^2.104.0`)
- **UI**: Tailwind 3.4 + Radix primitives (Avatar, Dialog, Dropdown, Select, Tabs, Tooltip) + Sonner (toasts) + Lucide icons
- **Forms/Validación**: react-hook-form 7 + Zod 4 + `@hookform/resolvers`
- **Microservicio Python**: FastAPI 0.115 + pandas + openpyxl + supabase-py + httpx (repo separado)
- **Sin**: tests, CI/CD pipeline, monitoring, error-tracking, dark mode, i18n

### Estructura

```
app/
  layout.tsx, page.tsx, globals.css, not-found.tsx
  (auth)/login/, auth/callback/route.ts
  onboarding/page.tsx
  (dashboard)/
    layout.tsx           ← guard sesión + redirect onboarding
    dashboard/
    tickets/ (mios, asignados, nuevo, [numero])
    score/ (acreditados, nuevo, [numero], [numero]/editar)
    cartera/ (page, cargar, cobranza, riesgo, chat)   ← solo `cargar` implementado
    admin/ (catalogo, areas, usuarios, metricas, score/metricas, cartera)
  api/
    cartera/upload/route.ts
    cartera/procesar/route.ts        ← delega a microservicio Python
    cartera/uploads/route.ts         ← lista + auto-cleanup timeout 10min
components/
  admin/, brand/, cartera/, layout/, onboarding/, score/, tickets/, ui/
lib/
  actions/acreditados.ts             ← única archivo Server Actions
  cartera/types.ts
  hooks/
  schemas/ (acreditado.ts, ticket.ts)
  scoring/ (modelo.ts, types.ts)
  supabase/ (client.ts, server.ts, types.ts)
  utils/ (format.ts, score-permissions.ts)
supabase/migrations/    ← 22 archivos + GUIA-SQL-SUPABASE.md
scripts/                ← utilidades manuales
middleware.ts
```

### Archivos críticos

| Archivo | Rol |
|---------|-----|
| `middleware.ts` | Sesión Supabase, protege todo excepto `/login` y `/auth` |
| `app/(auth)/auth/callback/route.ts` | OAuth code exchange + filtro de dominio |
| `app/(dashboard)/layout.tsx` | Sidebar, redirect a `/onboarding` si `!area_id`, contadores de tickets |
| `app/(dashboard)/admin/layout.tsx` | Bloquea `/admin/*` si rol ≠ admin |
| `lib/actions/acreditados.ts` | CRUD acreditados + evaluación promotor |
| `lib/scoring/modelo.ts` | Algoritmo de score HM (réplica GAS) |
| `components/tickets/ticket-form.tsx` | Crear ticket (cliente Supabase) |
| `components/cartera/upload-form.tsx` | Drag-drop, upload a Storage, polling de estado |
| `app/api/cartera/procesar/route.ts` | Bridge a microservicio Python |
| `supabase/migrations/*.sql` | 22 migraciones: schema, RLS, triggers, vistas, scoring, cartera |

### Integraciones

| Integración | Estado |
|-------------|--------|
| Supabase Auth + Postgres + RLS | Sí |
| Supabase Storage bucket `ticket-attachments` | Sí (UI), políticas faltantes en repo |
| Supabase Storage bucket `cartera` | Sí (con políticas en migración `20260524000002`) |
| Microservicio Python `crediflexi-services` | Sí (solo localhost, sin deploy) |
| Vercel | Sí |
| Resend / notificaciones email | No (planificado) |
| LLM provider (Chat IA cartera) | No |

### Server Actions vs Client Mutations

- **Server Actions**: solo `lib/actions/acreditados.ts` (4 funciones: `crearAcreditado`, `actualizarAcreditado`, `guardarEvaluacion`, `eliminarAcreditado`).
- **Cliente Supabase directo**: tickets (`ticket-form.tsx`, `response-composer.tsx`), admin (`catalogo-admin.tsx`, `usuarios-admin.tsx`, `areas-admin.tsx`, `cartera-accesos.tsx`).
- **Route Handlers**: `auth/callback`, `api/cartera/{upload,procesar,uploads}`.

### Documentación previa (a archivar/eliminar — ver §10)

| Archivo | Estado |
|---------|--------|
| `context.md` | Spec original MVP + design system tokens. **Conservar** (referencia de diseño). |
| `research.md` | Reemplazado por este documento. **Eliminar**. |
| `plan-fase2.md` | Completada y desplegada. **Eliminar**. |
| `plan-fase5.md` | Mayormente completada. **Eliminar**. |
| `plan-modificaciones.md` | Onboarding/rechazo/campos dinámicos ya en producción. **Eliminar**. |
| `plan-operaciones.md` | Módulo Score ya en producción. **Eliminar**. |
| `propuesta-crediflexi.tex`, `Mesa_de_Ayuda_CrediFlexi_Propuesta.pptx` | Material comercial. **Conservar fuera del flujo dev**. |
| `supabase/migrations/GUIA-SQL-SUPABASE.md` | Guía operativa para correr SQL manual. **Conservar**. |

---

## 3. Mapa de Arquitectura

### Módulos y estado

| Módulo | Estado | Tecnología |
|--------|--------|------------|
| Auth corporativa | Completo | Supabase + middleware + filtro dominio |
| Onboarding (nombre + área) | Completo | RPC `complete_onboarding` security definer |
| Login presets (operadores Score) | Completo | `login_presets` + trigger `handle_new_user` |
| Mesa de tickets (crear/responder/rechazar/cerrar) | Completo (con bugs UX) | Cliente Supabase + RLS + triggers |
| Campos dinámicos por catálogo | Completo | `problem_catalog.campos` jsonb + `tickets.datos` jsonb |
| Rechazo responsable | Completo | enum `rechazo_responsable` + triggers + vista |
| Score Crediticio (CRUD + modelo) | Completo | Server Actions + RPC `guardar_evaluacion_promotor` |
| Admin tickets/areas/usuarios | Completo | Cliente Supabase + RLS admin |
| Métricas admin (tickets + score) | Parcial | Falta filtrar `rechazado`, sin gráficas |
| Cartera — carga Excel + ETL | Completo end-to-end | Next.js → Storage → microservicio Python → `stg_yunius_cartera_individual` |
| Cartera — dashboards (resumen/cobranza/riesgo) | Pendiente | Solo placeholders en sidebar |
| Cartera — Chat IA | Pendiente | Solo ruta `/cartera/chat` en sidebar |
| Notificaciones email | Pendiente | — |
| Tests automatizados | Pendiente | — |
| CI/CD | Pendiente | Solo deploy automático de Vercel desde main |

### Flujos principales

```
[Anónimo]
  → /login (Google | magic link @financieracrediflexi.com)
  → /auth/callback (valida dominio)
  → si !area_id → /onboarding (RPC complete_onboarding)
  → /dashboard

[Usuario estándar]
  → Mis tickets / Nuevo ticket
  → ticket-form.tsx → tickets + responses + storage (cliente)
  → Detalle ticket (hilo + composer)

[Responsable]
  → Asignados a mí, responder, terminar, rechazar (motivo obligatorio)

[Operador Score (usuario + acceso_score)]
  → Sidebar oculta tickets (`esSoloOperadorScore`)
  → Acreditados CRUD + evaluación promotor (RPC)

[Operador Cartera (usuario + acceso_cartera)]
  → /cartera/cargar
  → upload-form.tsx → POST /api/cartera/upload
    → Supabase Storage (bucket 'cartera') + insert cartera_uploads (estado=pendiente)
  → click "Procesar" → POST /api/cartera/procesar
    → fetch a PYTHON_SERVICE_URL/cartera/procesar
      → microservicio descarga Excel + corre ETL pandas
      → bulk insert en stg_yunius_cartera_individual (batches 500)
      → actualiza cartera_uploads.estado=procesado + rows_inserted
  → polling cada 3s mientras haya `procesando`
  → timeout automático a 10min → estado=error

[Admin]
  → Todo lo anterior + /admin/{catalogo,areas,usuarios,metricas,score,cartera}
```

---

## 4. Inventario de Features

| Feature | Estado | Notas |
|---------|--------|-------|
| Login Google + OTP | Completo | Filtro `@financieracrediflexi.com` en callback y cliente |
| Onboarding obligatorio | Completo | Layout dashboard fuerza si `!area_id` |
| Preset login operadores Score | Completo | `login_presets` + `handle_new_user` |
| Listar/crear tickets | Parcial | Falla silenciosa si `insert` falla (no toast) |
| Hilo de respuestas | Parcial | Trigger valida paridad; rechazo exento |
| Adjuntos en tickets | Parcial | Suben a Storage; adjuntos iniciales (response_id=null) **no se muestran** |
| Rechazo con motivo (≥10 chars) | Completo | enum + trigger + estado `rechazado` en vista |
| Catálogo dinámico (jsonb) | Completo | Mini-builder en admin + render dinámico en form |
| Score: captura + cálculo | Completo | `modelo.ts` réplica del modelo HM |
| Score: evaluación promotor (A/B/C/D) | Completo | RPC con validaciones |
| Score: editar/eliminar | Completo | Historial de cambios automático |
| Admin: usuarios/áreas/catálogo/cartera-accesos | Completo | Toggle por usuario |
| Métricas admin tickets | Parcial | Sin estado `rechazado` aparte; filtro por nombre de área |
| Métricas admin score | Completo | A/B/C/D, promedio, pendientes |
| Cartera: upload + Storage + ETL | Completo | End-to-end probado (191 filas) |
| Cartera: dashboards | Pendiente | `/cartera`, `/cartera/cobranza`, `/cartera/riesgo` placeholders |
| Cartera: Chat IA | Pendiente | `/cartera/chat` ruta no existe aún |
| Notificaciones email | Pendiente | — |
| `error.tsx` global | Pendiente | 0 archivos en el proyecto |
| Tests | Pendiente | No hay framework instalado |

---

## 5. Problemas y Bugs Detectados

### Arquitectura

- **SEC-001 (Alta)** — Tickets mutados desde el cliente. `ticket-form.tsx:118`, `response-composer.tsx`, `catalogo-admin.tsx`, `usuarios-admin.tsx`. Toda la seguridad depende de RLS; si una policy falla, no hay barrera. **Recomendación**: migrar a Server Actions con validación Zod en servidor.
- **API-001 (Media)** — `app/api/cartera/procesar/route.ts:40` hace `fetch` síncrono a microservicio Python. Si el ETL tarda más que el timeout serverless de Vercel, la respuesta se cuelga. **Recomendación**: arquitectura asíncrona — Next.js solo dispara el job y el microservicio actualiza estado en DB; el cliente sigue por polling (ya implementado).

### Seguridad / RLS

- **RLS-001 (Alta)** — `attachments_insert` (mig. 002:114) permite a cualquier autenticado insertar adjunto a **cualquier** `ticket_id` que conozca; no valida participación. **Fix**: `with check` con `EXISTS` sobre `tickets` donde `auth.uid()` sea `levantado_por_id` o `responsable_id`.
- **RLS-002 (Media)** — `profiles_select using (true)` (mig. 002:15) expone email/nombre/rol de todos los perfiles a todos los autenticados. **Fix**: restringir a campos públicos vía vista o a admin.
- **RLS-003 (Media)** — `acreditado_referencias` / `acreditado_historial` INSERT solo validan `has_score_access()`; un operador puede contaminar registros ajenos. **Fix**: validar también que el `acreditado_id` es del capturador o via RPC.
- **RLS-004 (Media)** — `ticket_responses_insert` no bloquea si `closed_at IS NOT NULL`. **Fix**: trigger `before insert` que rechace.
- **RLS-005 (Media)** — Bucket Storage `ticket-attachments` no tiene políticas en el repo (sí en el dashboard, según `research.md` previo). **Fix**: migración versionada análoga a `20260524000002_cartera_storage_policy.sql`.
- **SEC-002 (Media)** — Cartera: el microservicio usa `service_role_key` (bypassa RLS). Es correcto para backend-to-DB, pero el endpoint `/cartera/procesar` del microservicio **no autentica** la llamada de Next.js. En localhost no hay riesgo; en producción cualquiera con la URL podría dispararlo. **Fix**: HMAC compartido o JWT entre Next.js y microservicio.

### UX

- **UI-001 (Alta)** — `ticket-form.tsx:132-135`: si `ticketError`, solo `setLoading(false)`, sin toast. El usuario no sabe que falló.
- **UI-002 (Alta)** — Adjuntos iniciales no se muestran en el hilo. `ticket-thread.tsx` filtra por `response_id === resp.id`, ignorando los que tienen `response_id IS NULL`.
- **UI-003 (Media)** — Login `?error=auth` no tiene copy (solo `error=domain`).
- **UI-004 (Media)** — No hay `error.tsx` ni `not-found.tsx` específicos para rutas profundas.
- **UI-005 (Baja)** — Lista de acreditados sin paginación.

### Datos / Server Actions

- **DB-001 (Media)** — `crearAcreditado` (`lib/actions/acreditados.ts:27`): si el `insert` de referencias falla, el acreditado **ya quedó creado** sin referencias. No hay transacción. **Fix**: RPC `upsert_acreditado` atómica.
- **DB-002 (Media)** — `actualizarAcreditado` (línea 130): `DELETE` referencias luego `INSERT`; si insert falla tras delete, el registro queda sin referencias.
- **DB-003 (Baja)** — `actualizarAcreditado` incrementa `contador_ediciones` aunque no haya cambios reales (no compara refs/score).
- **DB-004 (Media)** — `guardarEvaluacion` (línea 180): no traduce el error RPC `calificacion_invalida` ni `no_auth`.
- **SEC-003 (Media)** — `puntaje_total` y `clasificacion_modelo` son escritos desde Server Action; no hay trigger DB que recalcule. Un usuario con `acceso_score` podría hacer update directo vía API.

### Tipos

- **TYP-001 (Baja)** — `lib/supabase/types.ts` se mantiene a mano. Falta tipar:
  - `cartera_uploads`, `stg_yunius_cartera_individual`, `loan_amortizacion_individual`
  - RPCs: `complete_onboarding`, `guardar_evaluacion_promotor`, `has_score_access`, `has_cartera_access`
  - Enum `response_type` con `rechazo_responsable`
  - **Fix**: usar `supabase gen types typescript`.

### Performance

- **PERF-001 (Baja)** — Dashboard hace 4 queries en paralelo (aceptable). Sin paginación de tickets viejos.
- **PERF-002 (Baja)** — `acreditado-form` recalcula score en `useMemo` por cada keystroke (OK funcionalmente).

### Deuda operativa

- **OPS-001 (Alta)** — Microservicio Python solo corre en localhost. Sin Dockerfile, sin deploy. Cartera en producción no funcionaría.
- **OPS-002 (Media)** — Migraciones se aplican **a mano** vía SQL editor; no hay `supabase db push` en CI.
- **OPS-003 (Baja)** — No hay `.env.example` en el repo raíz.

---

## 6. Deuda Técnica

| ID | Tipo | Ubicación | Severidad | Recomendación |
|----|------|-----------|-----------|---------------|
| RLS-001 | Seguridad | `ticket_attachments.insert` | Alta | Policy con EXISTS sobre tickets |
| RLS-005 | Seguridad | Storage `ticket-attachments` | Alta | Migración con políticas versionadas |
| OPS-001 | Operación | Microservicio Python | Alta | Dockerfile + deploy (Railway/Fly/Render) + `PYTHON_SERVICE_URL` en Vercel |
| SEC-001 | Arquitectura | Mutaciones cliente en tickets/admin | Alta | Migrar a Server Actions |
| UI-001 | UX | `ticket-form` sin feedback de error | Alta | toast + revert loading |
| UI-002 | UX | Adjuntos iniciales invisibles | Alta | Bloque "Evidencia inicial" en thread |
| SEC-002 | Seguridad | Microservicio sin auth | Media | HMAC entre Next.js y microservicio |
| RLS-002 | Seguridad | `profiles_select` open | Media | Vista pública o restringir |
| RLS-003 | Seguridad | Score historial/refs INSERT | Media | RPC única + validar capturador |
| RLS-004 | Seguridad | Responses en ticket cerrado | Media | Trigger before insert |
| DB-001/002 | Datos | Acreditado sin transacción | Media | RPC `upsert_acreditado` |
| SEC-003 | Seguridad | Score editable vía API | Media | Trigger DB que recalcule |
| TYP-001 | Tipos | `lib/supabase/types.ts` desincronizado | Media | `supabase gen types` |
| OPS-002 | Operación | Migraciones a mano | Media | Supabase CLI en CI |
| API-001 | Arquitectura | `/api/cartera/procesar` síncrono | Media | Fire-and-forget al microservicio |
| DEB-001 | Tests | Sin framework | Media | Vitest + Playwright para críticos |
| UI-003/004 | UX | `error=auth`, `error.tsx` faltantes | Baja | Añadir copy y boundaries |
| DB-003/004 | Datos | Diff espurio + mensajes RPC | Baja | Comparar refs y mapear errores |

---

## 7. Gaps y Features Pendientes

### Críticos (bloquean cierre de Cartera en producción)
1. **OPS-001** — Deploy del microservicio `crediflexi-services`.
2. **PRO-001** — Dashboard `/cartera` con resumen agregado (total cartera, total mora, % PAR, evolución por corte).
3. **PRO-002** — Vista `/cartera/cobranza` (tickets de cobranza por recuperador, días de mora, alertas).
4. **PRO-003** — Vista `/cartera/riesgo` (distribución PAR, top clientes en mora, concentración por coordinación).
5. **SEC-002** — Auth entre Next.js y microservicio (HMAC).

### Importantes (mejoran prod actual)
6. **RLS-001 + RLS-005** — Endurecer adjuntos de tickets y políticas Storage.
7. **UI-001 + UI-002** — Feedback de error en creación + mostrar adjuntos iniciales.
8. **SEC-001** — Migrar mutaciones de tickets a Server Actions.
9. **TYP-001** — Regenerar tipos Supabase con `supabase gen types`.

### Roadmap
10. **PRO-004** — Chat IA en `/cartera/chat` (LLM con contexto de la cartera).
11. **PRO-005** — Notificaciones email (Resend) cuando se crea/responde/cierra ticket.
12. **PRO-006** — Dominio custom `tickets.financieracrediflexi.com`.
13. **DEB-001** — Tests E2E de flujos críticos (login, crear ticket, captura acreditado, carga cartera).
14. **OPS-002** — Supabase CLI + migraciones en CI.

---

## 8. Recomendaciones Técnicas

1. **Cerrar Cartera antes de Chat IA**: dashboards + deploy del microservicio. Sin esto, el módulo es un cargador sin consumo.
2. **Endurecer RLS de adjuntos y Storage en migración versionada** (no en dashboard manual).
3. **Migrar tickets a Server Actions** progresivamente: empezar por `crear ticket` y `responder`.
4. **HMAC entre Next.js y microservicio** antes de exponer el microservicio en internet.
5. **`supabase gen types` automatizado** post-migración (script en `scripts/`).
6. **`error.tsx` global + por sección** (tickets, score, cartera).
7. **Tests mínimos**: smoke E2E de login + crear ticket + crear acreditado + cargar cartera.
8. **Documentar variables de entorno** en `.env.example` (sin secretos).

---

## 9. Preguntas Abiertas

1. ¿Dónde se desplegará el microservicio Python? (Railway / Fly.io / Render / VPS propio de CrediFlexi)
2. ¿Las políticas Storage del bucket `ticket-attachments` en producción están abiertas o restringidas? (no están en el repo)
3. ¿Qué LLM provider se usará para Chat IA en cartera? (OpenAI / Anthropic / local) — define costo y arquitectura.
4. ¿El dashboard de cartera consume el último corte o permite seleccionar fecha?
5. ¿Notificaciones email son requisito antes de ampliar usuarios de tickets?
6. ¿El algoritmo de score debe seguir replicando exactamente el GAS legacy o se puede iterar?
7. ¿Quién corre las migraciones SQL en producción (manualmente vs CI)?

---

## 10. Apéndice — Inventario de migraciones

| # | Archivo | Propósito |
|---|---------|-----------|
| 01 | `20260421000001_initial_schema.sql` | profiles, areas, problem_catalog, tickets, responses, attachments |
| 02 | `20260421000002_rls_policies.sql` | RLS base + `is_admin()` |
| 03 | `20260421000003_views_and_functions.sql` | Vista `tickets_with_status` |
| 04 | `20260421000004_triggers.sql` | `validate_response_order`, `handle_ticket_closure`, `handle_new_user` |
| 05 | `20260424000001_scoring_schema.sql` | acreditados, referencias, historial + RLS |
| 06 | `20260514000001_onboarding.sql` | RPC `complete_onboarding` + handle_new_user nombre vacío |
| 07 | `20260514000002_rechazo_enum.sql` | `alter type response_type add value 'rechazo_responsable'` |
| 08 | `20260514000003_rechazo_logic.sql` | Trigger paridad excepción + vista con `rechazado` |
| 09 | `20260514000004_dynamic_fields.sql` | `problem_catalog.campos` + `tickets.datos` + backfill |
| 10 | `20260514000005_scoring_rls_fixes.sql` | `referencias_delete` + RPC `guardar_evaluacion_promotor` |
| 11 | `20260514000006_acreditados_delete.sql` | Política DELETE acreditados |
| 12 | `20260514000007_fix_tickets_view_rechazo.sql` | Fix vista 42P16 |
| 13 | `20260514000008_score_operator_rls.sql` | RLS operador score |
| 14 | `20260514000009_login_presets.sql` | Tabla `login_presets` + trigger |
| 15 | `20260514000010_login_presets_rls.sql` | RLS presets |
| 16 | `20260520000001_cartera_tables.sql` | `cartera_uploads`, `stg_yunius_cartera_individual`, `loan_amortizacion_individual` |
| 17 | `20260520000002_cartera_rls.sql` | RLS cartera + `has_cartera_access()` |
| 18 | `20260520000003_cartera_profile.sql` | `profiles.acceso_cartera` |
| 19 | `20260520000004_cartera_admin_rls.sql` | RLS admin cartera |
| 20 | `20260524000001_cartera_storage_path.sql` | `cartera_uploads.storage_path` |
| 21 | `20260524000002_cartera_storage_policy.sql` | RLS Storage bucket `cartera` |
| 22 | `20260524000003_stg_columnas_extra.sql` | `concepto_deposito`, `cuotas_sin_pagar`, `combinado` |

---

## 11. Auto-chequeo final

| Pregunta | Respuesta |
|----------|-----------|
| ¿Leí package.json, middleware, layouts raíz, dashboard? | Sí |
| ¿Leí al menos 3 Server Actions / route handlers? | Sí (`acreditados.ts`, `cartera/upload`, `cartera/procesar`) |
| ¿Revisé las 22 migraciones (al menos las críticas)? | Sí (initial, RLS, scoring, dynamic_fields, cartera_*) |
| ¿Validé que la documentación previa quedó obsoleta? | Sí — `research.md`, `plan-fase*.md`, `plan-modificaciones.md`, `plan-operaciones.md` |
| ¿Documenté el estado real, no el aspirable? | Sí — Cartera marcada como parcial (UI lista, dashboards pendientes, microservicio sin deploy) |
| ¿Identifiqué riesgos críticos? | Sí — RLS adjuntos, microservicio sin deploy, sin auth entre servicios |
| ¿IDs de tickets consistentes? | Sí — SEC, RLS, DB, UI, API, PERF, TYP, OPS, DEB, PRO |

---

*Fin del research consolidado.*
