# PLAN — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Plan de trabajo activo organizado por módulo.
> Se actualiza tras cada sesión.
> Para el contexto completo del repo ver `RESEARCH-CONSOLIDADO.md`.
> Última actualización: 2026-05-27.

---

## 1. Definición de v1.0

**Cuándo damos por cerrada la versión actual:**

1. **Cartera Individual con paridad funcional vs el legacy**: ETL completo (todas las columnas), microservicio desplegado con auth, capa de consulta lista, y al menos 4 dashboards (resumen ejecutivo, coord × PAR, recuperador, mora operativa).
2. **RLS endurecida** en tickets: `ticket_attachments.insert` valida participación, bucket Storage `ticket-attachments` con políticas versionadas.
3. **Feedback de errores visible** en creación de tickets y adjuntos iniciales mostrados en el hilo. *(✅ hecho 2026-05-25.)*
4. **Tipos Supabase regenerados** (`supabase gen types`) incluyendo cartera y RPCs.
5. **Smoke E2E** mínimo (login + crear ticket + crear acreditado + cargar cartera) corriendo en local.

**Lo que NO entra en v1.0** (queda para v1.1+):
- Chat IA en cartera.
- Drill-down de crédito + Liquidación anticipada real (requiere `loan_amortizacion_individual` poblada).
- Hojas externas del legacy (`Cobranza`, `Asignación`, `Recuperación`).
- Notificaciones email (Resend).
- Dominio custom.
- Tests E2E completos.
- Migraciones automatizadas en CI.
- Migración total de mutaciones de tickets a Server Actions (se hace gradual post v1.0).

---

## 2. Fases por módulo

### 2.1 Módulo Cartera *(eje estratégico)*

**Objetivo**: reemplazar progresivamente la información que entrega el legacy (`automatizador-crediflexi`) con dashboards interactivos en la plataforma. El legacy NO se toca; queda como referente.

#### Fase Cartera-1 — Cerrar el pipeline ETL (1 semana)

> Sin datos completos, los dashboards quedan cojos. Esto es prioridad.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C1-1 | CART-001 | Extender `df_a_registros()` en `crediflexi-services` para mapear las ~55 columnas de `stg_yunius_cartera_individual` (hoy solo 20) | — |
| C1-2 | CART-002 | Asegurar que `fecha_inicio_ciclo` se llena (habilita segmentación cohort por mes) | C1-1 |
| C1-3 | CART-005 | Validar `fecha_corte` contra el contenido del Excel al procesar | C1-1 |
| C1-4 | OPS-001 | Dockerfile + deploy de `crediflexi-services` (Railway/Fly/Render) | — |
| C1-5 | SEC-002 | HMAC entre `/api/cartera/procesar` y microservicio | C1-4 |
| C1-6 | TYP-001 | Regenerar `lib/supabase/types.ts` (desbloquea autocompletado para dashboards) | — |

#### Fase Cartera-2 — Capa de consulta (3-5 días)

> RPCs y vistas que alimentan los dashboards. Empuja la agregación al servidor.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C2-1 | CART-010 | Vista/RPC `cartera_resumen(fecha_corte)` — totales + distribución PAR consolidada | C1-1 |
| C2-2 | CART-011 | RPC `cartera_por_coordinacion(fecha_corte)` — cartera × PAR por región | C1-1 |
| C2-3 | CART-012 | RPC `cartera_por_recuperador(fecha_corte, recuperador?)` — `mi cartera` o todos | C1-1 |
| C2-4 | CART-013 | Vista `cartera_mora_operativa` — registros con `dias_mora >= 1` + cols seguimiento (Call Center, Campo) | C1-1 |
| C2-5 | CART-014 | RPC `cartera_cohort_mensual(fecha_corte)` — agrupa por mes de `fecha_inicio_ciclo` | C1-2 |
| C2-6 | CART-015 | Endpoints GET `/api/cartera/{resumen,coordinacion,recuperador,mora,cohort}` que llamen los RPCs | C2-1..C2-5 |

#### Fase Cartera-3 — Dashboards (paridad con legacy) (1-2 semanas)

> Orden por valor demo / esfuerzo. Cada dashboard consume un RPC de Fase 2.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C3-1 | DASH-001 | `/cartera` — snapshot ejecutivo: cards (total cartera, total mora, % PAR>30, % PAR>90), tabla distribución PAR, selector de corte | C2-1 |
| C3-2 | DASH-002 | `/cartera/coordinacion` — tabla por coord × PAR (equivalente a `X_Coordinación` del Excel) | C2-2 |
| C3-3 | DASH-003 | `/cartera/recuperador` — tabla por recuperador × PAR + filtro "mi cartera" | C2-3 |
| C3-4 | DASH-004 | `/cartera/mora` — tabla operativa con columnas de seguimiento Call Center / Campo, filtros por días, alertas, coord | C2-4 |
| C3-5 | DASH-005 | Selector de cohort mensual en C3-1 (equivalente a hojas `Marzo2026`/`Abril2026`/`Mayo2026`) | C2-5 |

#### Fase Cartera-4 — Superación del Excel (post-paridad)

> Lo que el Excel NO ofrece y la plataforma sí debe ofrecer.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C4-1 | CART-003 | Integrar fuente externa de amortizaciones → poblar `loan_amortizacion_individual` | — (TBD usuario) |
| C4-2 | DASH-010 | Drill-down de crédito (clic → ver calendario de cuotas, mora, fechas) | C4-1 |
| C4-3 | DASH-011 | Liquidación anticipada real (cálculo desde amortizaciones, no VLOOKUP) | C4-1 |
| C4-4 | DASH-012 | Comparativa multi-corte (mismo recuperador entre dos fechas) | C2-1 |
| C4-5 | DASH-013 | Exportación Excel/CSV bajo demanda (replica formato legacy si se requiere) | C3-* |
| C4-6 | PRO-004 | Chat IA `/cartera/chat` con contexto de cartera (LLM TBD) | C3-* |

### 2.2 Módulo Tickets

#### Fase Tickets-Demo *(esta semana)*

| # | Ticket | Estado | Notas |
|---|--------|--------|-------|
| T-D1 | UI-001 | ✅ 2026-05-25 | Toast de error en creación |
| T-D2 | UI-002 | ✅ 2026-05-25 | Adjuntos iniciales visibles |
| T-D3 | — | 🔲 | Smoke local: login → crear → responder → cerrar |
| T-D4 | UI-003 | 🔲 | Copy de error en login (`?error=auth`) |
| T-D5 | UI-004 | 🔲 | `app/error.tsx` global para no mostrar pantalla blanca |

#### Fase Tickets-Seguridad

| # | Ticket | Descripción |
|---|--------|-------------|
| T-S1 | RLS-001 | Policy `attachments_insert` con EXISTS sobre participación |
| T-S2 | RLS-005 | Migración versionada de políticas Storage `ticket-attachments` |
| T-S3 | RLS-002 | Restringir `profiles_select` (vista pública o admin only) |
| T-S4 | RLS-004 | Trigger rechaza INSERT en `ticket_responses` si `closed_at IS NOT NULL` |

#### Fase Tickets-Arquitectura *(post-v1.0)*

| # | Ticket | Descripción |
|---|--------|-------------|
| T-A1 | SEC-001 | Migrar `crearTicket` y `responderTicket` a Server Actions con Zod servidor |

### 2.3 Módulo Score

#### Fase Score-Robustez

| # | Ticket | Descripción |
|---|--------|-------------|
| S-R1 | DB-001 | RPC atómica `upsert_acreditado` (acreditado + referencias) |
| S-R2 | DB-002 | Misma RPC para `actualizarAcreditado` |
| S-R3 | RLS-003 | Validar capturador en `acreditado_referencias/historial` INSERT |
| S-R4 | SEC-003 | Trigger DB recalcula `puntaje_total` (evita manipulación API) |
| S-R5 | DB-004 | Mapear errores RPC en `guardarEvaluacion` (no_auth, calificacion_invalida) |
| S-R6 | DB-003 | Comparar refs antes de incrementar `contador_ediciones` |

### 2.4 Transversal (plataforma)

#### Fase Plataforma-Tipos

| # | Ticket | Descripción |
|---|--------|-------------|
| P-T1 | TYP-001 | `supabase gen types typescript` automatizado (cartera + RPCs + enum rechazo) |

#### Fase Plataforma-UX

| # | Ticket | Descripción |
|---|--------|-------------|
| P-U1 | UI-004 | `app/error.tsx` global + por sección (tickets, score, cartera) |
| P-U2 | UI-005 | Paginación en lista de acreditados |

#### Fase Plataforma-Operación *(post-v1.0)*

| # | Ticket | Descripción |
|---|--------|-------------|
| P-O1 | OPS-002 | Supabase CLI + `supabase db push` en GitHub Actions |
| P-O2 | OPS-003 | `.env.example` en raíz |
| P-O3 | API-001 | `/api/cartera/procesar` fire-and-forget (no espera al microservicio) |

#### Fase Plataforma-Tests *(post-v1.0)*

| # | Ticket | Descripción |
|---|--------|-------------|
| P-D1 | DEB-001 | Vitest + Playwright + smoke E2E (login, crear ticket, crear acreditado, cargar cartera) |

#### Fase Plataforma-Producto *(post-v1.0)*

| # | Ticket | Descripción |
|---|--------|-------------|
| P-P1 | PRO-005 | Notificaciones Resend (nuevo ticket / nueva respuesta / cierre) |
| P-P2 | PRO-006 | Dominio custom `tickets.financieracrediflexi.com` |

---

## 3. Backlog Priorizado (orden de ejecución sugerido)

1. **C1-4 OPS-001** — Deploy microservicio (sin esto Cartera no existe en prod).
2. **C1-6 TYP-001** — Regenerar tipos (rápido, desbloquea autocompletado).
3. **C1-1 CART-001** — Completar ETL (gating de toda Fase 2 y 3).
4. **C1-2 CART-002** — `fecha_inicio_ciclo` (bloquea cohort mensual).
5. **C1-5 SEC-002** — HMAC antes de exponer microservicio.
6. **T-D4/T-D5 + P-U1** — Cierre pendientes Fase Demo (login copy + error.tsx global).
7. **C2-1 CART-010** — RPC resumen (desbloquea primer dashboard).
8. **C3-1 DASH-001** — Snapshot ejecutivo (mayor valor visible).
9. **T-S1 + T-S2** — RLS adjuntos y Storage (riesgo de seguridad real).
10. **C2-2 + C3-2** — Coordinación × PAR.
11. **C2-3 + C3-3** — Recuperador.
12. **C2-4 + C3-4** — Mora operativa.
13. **C2-5 + C3-5** — Cohort mensual.
14. **T-S3 + T-S4** — Resto RLS tickets.
15. **S-R*** — Robustez Score.
16. **C4-* + post-v1.0**.

---

## 4. Decisiones Tomadas

### Cartera (2026-05-27)

- **El legacy (`automatizador-crediflexi`) NO se toca**. Sigue funcionando independiente mientras la plataforma desarrolla su reemplazo. Es referente, no objetivo de cambio.
- **Paridad antes que superación**: dashboards primero replican la información del Excel; luego se agregan vistas que el Excel no ofrece (multi-corte, drill-down, etc.).
- **Hojas mensuales del legacy = segmentación cohort por `Inicio ciclo`** (no por fecha de corte). Plataforma lo implementa con filtro dinámico, no con hojas fijas hardcodeadas.
- **Amortizaciones** se llenarán vía script externo del usuario (formato y disparador TBD). No bloquean MVP de dashboards; habilitan Fase Cartera-4 (drill-down + liquidación real).
- **Orden de dashboards**: snapshot ejecutivo → coord × PAR → recuperador → mora operativa → drill-down/liquidación. Justificación: mayor valor visible / menor esfuerzo / consumo más amplio primero.
- **No reemplazar Excel con Excel**: la plataforma entrega dashboards interactivos. Si se necesita Excel descargable, es exportación derivable on-demand (DASH-013, post-v1.0).

### Arquitectura microservicio

- **2026-05-24** — Cartera se procesa en microservicio Python **separado** (`crediflexi-services`), no embebido en Next.js. Razón: pandas + openpyxl pesan demasiado para serverless.
- **2026-05-24** — FastAPI sobre Flask. Razón: auto-docs, tipos, async nativo.
- **2026-05-24** — Repos separados (no monorepo). Razón: deploys y ciclos de vida independientes.
- **2026-05-24** — El microservicio usa Supabase `service_role_key` para bulk insert (bypassa RLS). RLS aplica para lectura desde Next.js.
- **2026-05-24** — Estado de carga se persiste en `cartera_uploads.estado`. Frontend hace polling 3s. Auto-cleanup 10 min.

### Datos

- **2026-05-20** — `cartera_uploads` (ledger) y `stg_yunius_cartera_individual` (dato crudo) separadas. Permite re-procesar sin perder histórico.
- **2026-05-24** — Storage bucket `cartera` con políticas RLS por `acceso_cartera` o `rol=admin`.

### Convenciones

- **Commits atómicos** por cambio lógico. No commits gigantes.
- **Sin coautoría Claude** en commits (per user preference en `memory/feedback_commits.md`).
- **Comentarios en español, código en inglés** (variables, funciones).
- **Spanish UI copy** (todo lo visible al usuario).
- **Server Components por default**, Client Components solo para interactividad.

---

## 5. Próximos Pasos (sesión inmediata)

1. **Decisión pendiente** — ¿Dónde se despliega `crediflexi-services`? (Railway free tier opción simple).
2. **C1-1 CART-001** — Inventariar exactamente qué columnas faltan mapear (cruzar `cartera_etl.py:301` vs schema de `stg_yunius_cartera_individual`) y extender `df_a_registros()`.
3. **C1-6 TYP-001** — Correr `supabase gen types typescript --project-id ... > lib/supabase/types.ts`.
4. **Terminar Fase Demo Tickets** — UI-003 + UI-004 son quick wins.

---

## 6. Convenciones de Trabajo

### IDs de tickets

Prefijos consistentes en `RESEARCH-CONSOLIDADO.md` §6/§7 y aquí:

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
- `CART-` Cartera — datos / ETL / API
- `DASH-` Cartera — dashboards / UI

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
4. Al cerrar tarea: actualizar `PLAN.md` (mover ticket de Backlog a "Completados" o marcar con ✅) y, si aplica, actualizar `RESEARCH-CONSOLIDADO.md`.

---

## 7. Completados recientes

- **2026-05-27** — RESEARCH-CONSOLIDADO + PLAN refactorizados a estructura modular. Investigación profunda del ecosistema cartera (legacy + microservicio + plataforma). Nuevos IDs CART-/DASH- introducidos.
- **2026-05-25** — UI-001 + UI-002: feedback de error en tickets y adjuntos iniciales visibles.
- **2026-05-24** — Cartera end-to-end funcional (UI + Storage + microservicio + ETL parcial).
- **2026-05-24** — Auto-cleanup de uploads colgados (timeout 10 min).
- **2026-05-20** — Schema cartera + RLS + acceso por perfil.
- **2026-05-14** — Catálogo dinámico, rechazo, onboarding, presets login.
- **2026-04-24** — Módulo Score Crediticio completo.
- **2026-04-21** — Base: tickets, RLS, vistas, triggers.

---

*Fin del plan.*
