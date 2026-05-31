# PLAN — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Plan de trabajo activo organizado por módulo.
> Se actualiza tras cada sesión.
> Para el contexto completo del repo ver `RESEARCH-CONSOLIDADO.md`.
> Última actualización: 2026-05-30.

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
- `supabase db push` automatizado en CI *(ya hay flujo local, falta GitHub Action)*.
- Migración total de mutaciones de tickets a Server Actions (se hace gradual post v1.0).

---

## 2. Fases por módulo

### 2.1 Módulo Cartera *(eje estratégico)*

**Objetivo**: reemplazar progresivamente la información que entrega el legacy (`automatizador-crediflexi`) con dashboards interactivos en la plataforma. El legacy NO se toca; queda como referente.

#### Fase Cartera-0 — Especificación del contrato de datos *(gating absoluto)*

> Sin entender exactamente qué columnas trae el input y qué entrega el output, cualquier ETL es a ciegas. Esta fase cierra el contrato antes de tocar código.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C0-1 | CART-000 | ✅ **2026-05-28** — Análisis profundo del **input** (63 cols × 343 filas sample). `docs/cartera/input-analysis.md`. | — |
| C0-2 | CART-000b | ✅ **2026-05-28** — Análisis profundo del **output** (FINAL TARGET vs nuevo). `docs/cartera/output-analysis.md`. | — |
| C0-3 | CART-000c | ✅ **2026-05-28** — **Matriz de mapeo definitiva** input ↔ schema ↔ output + checklist de aceptación. `docs/cartera/mapping-matrix.md`. | C0-1, C0-2 |
| C0-4 | CART-000d | ✅ **2026-05-28** — Migración `20260528190511_cart_000d_cols_faltantes.sql`: agrega 11 cols faltantes a `stg_yunius_cartera_individual` (`situacion_credito`, `medio_comunic_2/3`, `tipo/desc/garantia_2`, `calle`, `colonia`, `nom_personal_castiga_cartera`, `frecuencia`, `parcialidad_comision`) y extiende `loan_amortizacion_individual` con `fuente_fecha_liquidacion`, `es_no_aplica_liquidacion`, `codigo_ciclo` (+ índice). `concepto_deposito` ya existía. | C0-3 |
| C0-5 | — | ✅ **2026-05-28** — `RESEARCH §5.4.9` con hallazgos + plan de cierre en 5 pasos. | C0-3 |

#### Fase Cartera-1 — Cerrar el pipeline ETL (1 semana)

> Implementar el contrato cerrado en Cartera-0.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C1-1 | CART-001 | ✅ **2026-05-30** — PR #1 squash-mergeado a `master` (commit `7d7d626`). Refactor `df_a_registros()` con `EXCEL_TO_SCHEMA` (54 cols) + `DERIVED_TO_SCHEMA` (7) verificado en smoke local (215 filas, 11 cols nuevas pobladas). Filtro `CODIGOS_RECUPERADOR_EXCLUIR` pospuesto a C1-4. Brief `docs/handoff/CART-001-refactor-etl.md` v1.1. | C0-4 |
| C1-2 | CART-002 | Asegurar que `fecha_inicio_ciclo` se llena (habilita segmentación cohort por mes). Crítico si la demo incluye cohort. | C1-1 |
| C1-3 | CART-005 | Validar `fecha_corte` contra el contenido del Excel al procesar. **No crítico para demo.** | C1-1 |
| C1-4 | CART-006 | Módulo nuevo `cartera_export.py` que regenera el `.xlsx` FINAL TARGET (12 hojas, excluye `Recuperación`/`Cobranza`/`amortizaciones_test` en v1) + endpoint `GET /cartera/export/{fecha_corte}`. Crítico solo si la demo muestra descarga Excel. | C1-1 |
| C1-5 | OPS-001 | ✅ **2026-05-30** — Microservicio LIVE en `https://crediflexi-services.onrender.com` (Render Free, region oregon, autoDeploy). PR #2 mergeado a master (5 commits, sin firma Claude). Smoke E2E productivo OK: 215 filas insertadas vía Vercel → Render → Supabase (`fecha_corte=2026-05-30`). Pendiente: cron-job.org wake-up cada 10 min para evitar cold start. Brief `docs/handoff/OPS-001-deploy-microservicio.md` v1.0. | C1-1 |
| C1-6 | SEC-002 | HMAC entre `/api/cartera/procesar` y microservicio. **Post-aprobación** (no bloqueador de demo). | C1-5 |
| C1-7 | TYP-001 | ✅ **2026-05-28** — Tipos espejo generados en `lib/supabase/database.types.ts` (1112 líneas). Script `npm run db:types` para regenerar. `types.ts` (manual, dominio/UI) intacto. | C0-4 |

#### Fase Cartera-2 — Capa de consulta (3-5 días)

> RPCs y vistas que alimentan los dashboards. Empuja la agregación al servidor.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C2-1 | CART-010 | ✅ **2026-05-30** — RPC `cartera_resumen(p_fecha_corte date) returns json`. Migraciones `20260531031407_cart_010_resumen_rpc.sql` + `20260531033054_cart_010b_resumen_saldo_total.sql`. Devuelve `totales` (5 campos), `par` (8 buckets), `indicadores` (PAR>30/>90). Métrica = `saldo_total` (estándar industria). Security definer + grant a authenticated + check `rol=admin OR acceso_cartera=true`. Validado con 215 filas (fecha_corte 2026-05-30): pct_par_30=34.52, pct_par_90=15.95, pct_mora=51.20. | C1-1 |
| C2-2 | CART-011 | RPC `cartera_por_coordinacion(fecha_corte)` — cartera × PAR por región | C1-1 |
| C2-3 | CART-012 | RPC `cartera_por_recuperador(fecha_corte, recuperador?)` — `mi cartera` o todos | C1-1 |
| C2-4 | CART-013 | Vista `cartera_mora_operativa` — registros con `dias_mora >= 1` + cols seguimiento (Call Center, Campo) | C1-1 |
| C2-5 | CART-014 | RPC `cartera_cohort_mensual(fecha_corte)` — agrupa por mes de `fecha_inicio_ciclo` | C1-2 |
| C2-6 | CART-015 | Endpoints GET `/api/cartera/{resumen,coordinacion,recuperador,mora,cohort}` que llamen los RPCs | C2-1..C2-5 |

#### Fase Cartera-3 — Dashboards (paridad con legacy) (1-2 semanas)

> Orden por valor demo / esfuerzo. Cada dashboard consume un RPC de Fase 2.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| ✅ C3-1 | DASH-001 | `/cartera` — snapshot ejecutivo: cards (total cartera, total mora, % PAR>30, % PAR>90), tabla distribución PAR, selectores (fecha, coord, recuperador, ciclo) | C2-1 |
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

#### Fase Plataforma-Operación

| # | Ticket | Estado | Descripción |
|---|--------|--------|-------------|
| P-O1a | OPS-002a | ✅ **2026-05-28** | Supabase CLI local + `supabase link` + baseline 22 migraciones existentes + scripts npm (`db:push`, `db:status`, `db:new`, `db:diff`). |
| P-O1b | OPS-002b | 🔲 *(post-v1.0)* | GitHub Action que corre `supabase db push` en cada merge a `main` (requiere `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` en repo secrets). |
| P-O2 | OPS-003 | 🔲 | `.env.example` en raíz (incluyendo `SUPABASE_DB_PASSWORD`). |
| P-O3 | API-001 | 🔲 *(post-v1.0)* | `/api/cartera/procesar` fire-and-forget (no espera al microservicio). |

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

### 3.1 Ruta crítica para demo ejecutiva (~7 días desde 2026-05-28)

| Día | Acción | Owner | Notas |
|---|---|---|---|
| 1 | ✅ Smoke test CART-001 local + squash-merge PR #1 | Usuario | Hecho 2026-05-30. Commit `7d7d626`. |
| 1 | ✅ OPS-001 implementado + PR #2 mergeado | Agente | Hecho 2026-05-30. 5 commits atómicos. |
| 1 | ✅ Cuenta Render + Blueprint + secrets + primer deploy | Usuario | Hecho 2026-05-30. URL: `crediflexi-services.onrender.com`. |
| 1 | ✅ Smoke E2E Vercel → Render → Supabase | Usuario | Hecho 2026-05-30. 215 filas, fecha_corte 2026-05-30. |
| 2 | 🟡 Cron-job.org wake-up cada 10 min en /health | Usuario | Evita cold start (30-60s) durante la demo. |
| 2-5 | C2-1 CART-010 (RPC resumen) + C3-1 DASH-001 (snapshot ejecutivo) | Coordinador / agentes | Primer dashboard visible. |
| 4-6 | C1-2 CART-002 (cohort) + C3-2/C3-3 (coord, recuperador) | Agentes | Solo si la demo cubre estos cortes. |
| 6 | C1-4 CART-006 (export Excel) | Implementador | Solo si la demo muestra descarga. |
| 7 | Pulido + ensayo demo + Excel de respaldo cargado | Usuario | Plan B por si Render se cae. |

### 3.2 Backlog general (post-demo o si hay slack)

1. **T-D4/T-D5 + P-U1** — Cierre pendientes Fase Demo (login copy + error.tsx global).
2. **T-S1 + T-S2** — RLS adjuntos y Storage (riesgo de seguridad real).
3. **C2-4 + C3-4** — Mora operativa.
4. **C2-5 + C3-5** — Cohort mensual.
5. **T-S3 + T-S4** — Resto RLS tickets.
6. **C1-6 SEC-002** — HMAC microservicio (post-aprobación).
7. **C1-3 CART-005** — Validar `fecha_corte` contra Excel.
8. **S-R*** — Robustez Score.
9. **C4-* + post-v1.0**.

---

## 4. Decisiones Tomadas

### Cartera (2026-05-27 / 2026-05-28)

- **El legacy (`automatizador-crediflexi`) NO se toca**. Sigue funcionando independiente mientras la plataforma desarrolla su reemplazo. Es referente, no objetivo de cambio.
- **Paridad antes que superación**: dashboards primero replican la información del Excel; luego se agregan vistas que el Excel no ofrece (multi-corte, drill-down, etc.).
- **Hojas mensuales del legacy = segmentación cohort por `Inicio ciclo`** (no por fecha de corte). Plataforma lo implementa con filtro dinámico, no con hojas fijas hardcodeadas.
- **Amortizaciones** se llenarán vía script externo del usuario (formato y disparador TBD). No bloquean MVP de dashboards; habilitan Fase Cartera-4 (drill-down + liquidación real).
- **Orden de dashboards**: snapshot ejecutivo → coord × PAR → recuperador → mora operativa → drill-down/liquidación. Justificación: mayor valor visible / menor esfuerzo / consumo más amplio primero.
- **No reemplazar Excel con Excel**: la plataforma entrega dashboards interactivos. Si se necesita Excel descargable, es exportación derivable on-demand (DASH-013, post-v1.0).
- **2026-05-28** — `CODIGOS_RECUPERADOR_EXCLUIR = ["000124"]` ya **no filtra al persistir**; persistimos todo y solo filtramos al generar la hoja `X_Recuperador` del export.
- **2026-05-28** — Pivotes (`X_Coordinación`/`X_Recuperador`) se generan como **tablas estáticas** con `pandas.pivot_table` + `xlsxwriter`, no como PivotTables nativos de Excel (mejor portabilidad).
- **2026-05-28** — `Saldo_Riesgo_total` y `Combinado` (cols duplicadas en el FINAL) se mantienen como copias literales de `Saldo riesgo total` en el export, calculadas al vuelo (no se persisten en staging).

### Arquitectura microservicio

- **2026-05-24** — Cartera se procesa en microservicio Python **separado** (`crediflexi-services`), no embebido en Next.js. Razón: pandas + openpyxl pesan demasiado para serverless.
- **2026-05-24** — FastAPI sobre Flask. Razón: auto-docs, tipos, async nativo.
- **2026-05-24** — Repos separados (no monorepo). Razón: deploys y ciclos de vida independientes.
- **2026-05-24** — El microservicio usa Supabase `service_role_key` para bulk insert (bypassa RLS). RLS aplica para lectura desde Next.js.
- **2026-05-24** — Estado de carga se persiste en `cartera_uploads.estado`. Frontend hace polling 3s. Auto-cleanup 10 min.
- **2026-05-28** — **Demo ejecutiva en ~7 días**: se prioriza deploy serio del microservicio (no ngrok) para mostrar todo el flujo desde el dominio Vercel productivo.
- **2026-05-28** — Plataforma de deploy = **Render** (Free tier inicial; upgrade a Standard $7/mes solo si cold start arruina UX post-aprobación). Build = **Docker** (no nixpacks — más control y portabilidad). Wake-up via cron externo (cron-job.org) cada 10 min para evitar cold start.
- **2026-05-28** — Brief operativo del deploy en `docs/handoff/OPS-001-deploy-microservicio.md` v1.0.

### Datos

- **2026-05-20** — `cartera_uploads` (ledger) y `stg_yunius_cartera_individual` (dato crudo) separadas. Permite re-procesar sin perder histórico.
- **2026-05-24** — Storage bucket `cartera` con políticas RLS por `acceso_cartera` o `rol=admin`.
- **2026-05-28** — Migraciones se aplican con **Supabase CLI** (`npm run db:push`). Las 22 migraciones existentes quedaron baseline-marcadas. Workflow oficial documentado en RESEARCH §11.

### Convenciones

- **Commits atómicos** por cambio lógico. No commits gigantes.
- **Sin coautoría Claude** en commits (per user preference en `memory/feedback_commits.md`).
- **Comentarios en español, código en inglés** (variables, funciones).
- **Spanish UI copy** (todo lo visible al usuario).
- **Server Components por default**, Client Components solo para interactividad.

---

## 5. Próximos Pasos (sesión inmediata)

1. ✅ ~~CART-001 mergeado~~ (commit `7d7d626`).
2. ✅ ~~OPS-001 implementado + Render LIVE + Vercel apuntando~~ (PR #2, URL `crediflexi-services.onrender.com`).
3. ✅ ~~Smoke E2E productivo~~ (215 filas, fecha_corte 2026-05-30).
4. **Cron-job.org wake-up** (Usuario, 5 min) — GET `https://crediflexi-services.onrender.com/health` cada 10 min.
5. **C2-1 CART-010** (RPC `cartera_resumen`) + **C3-1 DASH-001** (snapshot ejecutivo `/cartera`).
6. **Decidir scope demo**: ¿cohort (C1-2 + C3-5)? ¿coord/recuperador (C3-2/3)? ¿export Excel (C1-4)?

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

- Crear con: `npm run db:new <descripcion>` (genera archivo `YYYYMMDDHHMMSS_descripcion.sql`)
- Aplicar con: `npm run db:push` (idempotente, solo aplica las pendientes)
- Estado: `npm run db:status` (muestra local vs remote)
- Idempotentes cuando sea posible (`if not exists`, `or replace`)
- Una preocupación por archivo

### Commits

- Atómicos, un cambio lógico por commit
- Mensaje: `tipo(scope): descripción corta`
  - Tipos: `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`, `test`
  - Scope: `tickets`, `score`, `cartera`, `admin`, `auth`, `rls`, `infra`, `db`
- Sin coautoría Claude

### Workflow

1. Antes de empezar tarea grande: revisar `RESEARCH-CONSOLIDADO.md` y `PLAN.md`.
2. Antes de tocar código: leer los archivos afectados completos.
3. Commits atómicos durante el avance.
4. Al cerrar tarea: actualizar `PLAN.md` (mover ticket de Backlog a "Completados" o marcar con ✅) y, si aplica, actualizar `RESEARCH-CONSOLIDADO.md`.

---

## 7. Completados recientes

- **2026-05-30** — C3-1 DASH-001: `/cartera` snapshot ejecutivo live. Server Component que llama `cartera_filtros` + `cartera_resumen` en paralelo. 6 métricas (cartera total, en mora, %mora, PAR>30, PAR>90, saldo promedio) + tabla distribución PAR 8 buckets con barras de progreso. Filtros URL-state (fecha, coordinación, recuperador, ciclo) en client component con `useTransition`. Empty states + error banner. Build verde (1.12 kB / 97.1 kB First Load).
- **2026-05-30** — C2-1 CART-010: RPC `cartera_resumen(fecha_corte)` aplicada. Devuelve JSON con totales + distribución PAR (8 buckets) + indicadores (PAR>30, PAR>90). Security definer + check de permisos. Métrica = `saldo_total` (decisión técnica: `saldo_riesgo_total` inflaba porcentajes). Validado contra 215 filas. Desbloquea C3-1 (UI dashboard).
- **2026-05-30** — C1-5 OPS-001: microservicio LIVE en `https://crediflexi-services.onrender.com`. Render Free + Docker + autoDeploy. PR #2 mergeado (5 commits, sin firma Claude). Vercel `PYTHON_SERVICE_URL` actualizada. Smoke E2E productivo OK: 215 filas insertadas vía Vercel → Render → Supabase. Demo ya puede correr sobre infra real.
- **2026-05-30** — C1-1 CART-001: PR #1 squash-mergeado a `master` de `crediflexi-services` (commit `7d7d626`). Refactor ETL valida 11 cols nuevas pobladas en smoke local (215 filas, fecha_corte 2026-05-06). Desbloquea OPS-001.
- **2026-05-28** — Brief OPS-001 v1.0 redactado (`docs/handoff/OPS-001-deploy-microservicio.md`). Decisión: Render + Docker. Demo en ~7 días. PLAN reorganizado con ruta crítica día-por-día.
- **2026-05-28** — PR #1 (CART-001) abierto por Implementador en `crediflexi-services`: 5 commits atómicos, 9/9 criterios técnicos del brief cumplidos. Pendiente smoke test local y squash-merge.
- **2026-05-28** — C1-7 TYP-001: `lib/supabase/database.types.ts` generado (1112 líneas, espejo de la DB con todas las cols nuevas). Script `npm run db:types`. `types.ts` manual queda como tipos de dominio/UI.
- **2026-05-28** — C0-4 CART-000d: migración `20260528190511_cart_000d_cols_faltantes.sql` aplicada a Supabase remoto. Schema de cartera cerrado contra FINAL TARGET (11 cols nuevas + 3 en amortización). Desbloquea C1-1 (refactor ETL).
- **2026-05-28** — OPS-002a: Supabase CLI configurado localmente (v2.101.0). `supabase link` + baseline de 22 migraciones + scripts npm. Fin del copy-paste al SQL editor.
- **2026-05-28** — Cartera-0 completa (C0-1, C0-2, C0-3, C0-5). Tres documentos definitivos en `docs/cartera/` + `RESEARCH §5.4.9`. Bug crítico documentado: ETL inserta 3 cols inexistentes en schema.
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
