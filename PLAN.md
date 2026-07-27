# PLAN — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Plan de trabajo activo organizado por módulo.
> Se actualiza tras cada sesión.
> Para el contexto completo del repo ver `RESEARCH-CONSOLIDADO.md`.
> Última actualización: 2026-07-27.

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
| C1-6 | SEC-002 | ✅ **2026-06-17** — Auth entre `/api/cartera/procesar` y microservicio vía **token compartido** (`INTERNAL_API_TOKEN`, mismo valor en Vercel y Render). Next.js manda `Authorization: Bearer <token>`; el micro valida con `secrets.compare_digest` y responde 401 si no coincide (fail-closed: sin token configurado rechaza todo). Se descartó HMAC por sobre-ingeniería para tráfico server-to-server interno sobre HTTPS. | C1-5 |
| C1-7 | TYP-001 | ✅ **2026-05-28** — Tipos espejo generados en `lib/supabase/database.types.ts` (1112 líneas). Script `npm run db:types` para regenerar. `types.ts` (manual, dominio/UI) intacto. | C0-4 |
| C1-8 | CART-016 ✅ 2026-06-17 | **2026-06-17** — Alinear `EXCEL_TO_SCHEMA` con el insumo **real** de Yunius (verificado ejecutando `transformar()`+`df_a_registros()` contra `docs/etl/bruto.xlsx`, 63 cols × 187 filas → 160 registros post-fraude): (a) la columna viene **fusionada** `"Parcialidad + Parcialidad comisión"` → mapear a `parcialidad`, dejar `parcialidad_comision` en NULL (se elimina la suma separada) — poblada 160/160; (b) el encabezado real es `"$ Último pago"` (con `Ú` mayúscula y `$`), no `"Monto último pago"` → `monto_ultimo_pago`; el lookup es exact-match así que la mayúscula importa — poblado 133/160 (27 NULL = créditos sin pago aún); (c) robustez en `cargar_excel` (detectar fila de encabezado por ancla "Código acreditado", tolera fila de título). `Suma` no existe en el insumo (scratch del output) → sin cambio. `Link de Geolocalización` y `Próximo Pago` son columnas del **output**, no del insumo → se difieren al export (CART-006); `Próximo Pago` además requiere una 2ª fuente (Reporte de Cobranza). | C1-1 |

#### Fase Cartera-2 — Capa de consulta (3-5 días)

> RPCs y vistas que alimentan los dashboards. Empuja la agregación al servidor.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C2-1 | CART-010 | ✅ **2026-05-30** — RPC `cartera_resumen(p_fecha_corte date) returns json`. Migraciones `20260531031407_cart_010_resumen_rpc.sql` + `20260531033054_cart_010b_resumen_saldo_total.sql`. Devuelve `totales` (5 campos), `par` (8 buckets), `indicadores` (PAR>30/>90). Métrica = `saldo_total` (estándar industria). Security definer + grant a authenticated + check `rol=admin OR acceso_cartera=true`. Validado con 215 filas (fecha_corte 2026-05-30): pct_par_30=34.52, pct_par_90=15.95, pct_mora=51.20. | C1-1 |
| C2-2 | CART-011 | ✅ **2026-06-02** — RPC `cartera_por_coordinacion(p_fecha_corte date) returns json`. Migración `20260602135452_cart_011_por_coordinacion_rpc.sql`. Array de coordinaciones con totales + indicadores (pct_mora, PAR>30/90) + 8 buckets PAR c/u. Ordenado por `pct_par_30 desc`. Validado: 5 coords (Valle de Bravo peor 43.76% PAR>30, Metepec mejor 27.39%), suma 215 créditos / 5.1M cartera. | C1-1 |
| C2-3 | CART-012 | ✅ **2026-06-02** — RPC `cartera_por_recuperador(p_fecha_corte date, p_coordinacion text default null)`. Migración `20260602142131_cart_012_por_recuperador_rpc.sql`. Array de recuperadores (codigo+nombre+coordinacion) con totales + PAR>30/90 + 8 buckets. Filtro opcional por coordinación. Ordenado por `pct_par_30 desc`. Validado: 7 recuperadores (000020 Campos Sánchez 100% PAR>90 crítico; CALL CENTER 104 créditos / 8.97% PAR>30), suma 215 / 5.1M. Nota: "mi cartera" role-based pendiente (profiles sin codigo_recuperador). | C1-1 |
| C2-4 | CART-013 | ✅ **2026-06-02** — RPC `cartera_mora_operativa(p_fecha_corte date, p_coordinacion text default null, p_dias_min int default 1)`. Migración `20260602144732_cart_013_mora_operativa_rpc.sql`. Devuelve filas individuales de morosos (acreditado, recuperador, días, bucket, saldos vencidos, alerta, contacto). Filtros por coordinación y días mín. Ordenado por días desc. Validado: 120 morosos (top GARCIA REYES GUADALUPE, 529 días). Cols de seguimiento Call Center/Campo NO en BD aún (mock en UI). | C1-1 |
| C2-5 | CART-014 | ✅ **2026-06-02** — RPC `cartera_cohort(p_fecha_corte date, p_frontera date default '2026-04-01')`. Migración `20260602152000_cart_014_cohort_rpc.sql`. Parte la cartera en 2 cohortes por `fecha_inicio_ciclo` (`antes`/`desde` la frontera), cada una con totales + PAR (8 buckets) + PAR>30/90 (mismo contrato que `cartera_resumen`). Reporta `sin_fecha` para que cuadre el total. Validado: 215 créditos, `sin_fecha=0` (fecha_inicio_ciclo 100% poblado, rango 2023-08 a 2025-11). Nota: esta muestra no tiene ciclos 2026, por eso la frontera default deja una cohorte vacía → frontera configurable en UI. | C1-1 |
| C2-6 | CART-015 | Endpoints GET `/api/cartera/{resumen,coordinacion,recuperador,mora,cohort}` que llamen los RPCs | C2-1..C2-5 |

#### Fase Cartera-3 — Dashboards (paridad con legacy) (1-2 semanas)

> Orden por valor demo / esfuerzo. Cada dashboard consume un RPC de Fase 2.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| ✅ C3-1 | DASH-001 | `/cartera` — snapshot ejecutivo: cards (total cartera, total mora, % PAR>30, % PAR>90), tabla distribución PAR, selectores (fecha, coord, recuperador, ciclo) | C2-1 |
| ✅ C3-2 | DASH-002 | **2026-06-02** — `/cartera/coordinacion`: tabla de riesgo por coordinación (créditos, cartera, %mora, PAR>30/90 con semáforo) + tabla distribución coord × 8 buckets con heatmap por % de fila. Selector de fecha reutilizable. Item "Coordinación" agregado al sidebar. | C2-2 |
| ✅ C3-3 | DASH-003 | **2026-06-02** — `/cartera/recuperador`: tabla riesgo por recuperador (codigo+nombre+coordinación, %mora, PAR>30/90 semáforo) + distribución recuperador × 8 buckets heatmap. Filtro opcional por coordinación (`recuperador-filters.tsx`). Item "Recuperador" en sidebar. "Mi cartera" role-based diferido (falta mapeo profile→recuperador). | C2-3 |
| ✅ C3-4 | DASH-004 | **2026-06-02** — `/cartera/mora`: bandeja operativa de cobranza. Tabla client interactiva (búsqueda por acreditado/código/recuperador, orden por días/saldo/nombre) con datos reales de los 120 morosos. Filtros fecha+coordinación+días mín (`mora-filters.tsx`). **Columnas de gestión (Estatus llamada, Acuerdo, Monto, Nota) MOCKEADAS**: editables con estado local, sin persistir, con banner "modo demostración". Item "Bandeja de mora" en sidebar. Pendiente: tabla `cartera_seguimiento` + persistencia (siguiente feature, supera al Excel). | C2-4 |
| ✅ C3-5 | DASH-005 | **2026-06-02** — `/cartera/cohort`: comparativo de 2 cohortes lado a lado (etiquetas "Antes del 1-abr" / "Desde el 1-abr", solo nombres — el corte real es la fecha frontera, equivalente a hojas `Marzo`/`Abril` del legacy). Cada panel: indicadores (%mora, PAR>30/90) + distribución PAR 8 buckets con barras. Selector de fecha de corte + **selector de fecha frontera** (`frontera-selector.tsx`, default 1-abr-2026, editable con botón "Default"). Item "Cohortes" en sidebar. | C2-5 |

#### Fase Cartera-4 — Superación del Excel (post-paridad)

> Lo que el Excel NO ofrece y la plataforma sí debe ofrecer.

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| C4-1 | CART-003 | Integrar fuente externa de amortizaciones → poblar `loan_amortizacion_individual` | — (TBD usuario) |
| C4-2 | DASH-010 | Drill-down de crédito (clic → ver calendario de cuotas, mora, fechas) | C4-1 |
| C4-3 | DASH-011 | Liquidación anticipada real (cálculo desde amortizaciones, no VLOOKUP) | C4-1 |
| C4-4 | DASH-012 | Comparativa multi-corte (mismo recuperador entre dos fechas) | C2-1 |
| C4-5 | DASH-013 | Exportación Excel/CSV bajo demanda (replica formato legacy si se requiere) | C3-* |
| C4-6 | PRO-004 | ✅ **2026-06-04** — Demo determinística de `/cartera/chat` entregada (KB embebida, sin LLM). Evolución a agente real → §2.5 (AI-*). | C3-* |

### 2.2 Módulo Tickets

> **2026-06-06 — Decisión de alcance**: la "demo" es en realidad un **go-live a producción** con 3 tipos de ticket reales (PII de clientes). Después se agregan más tipos/funciones incrementalmente. Volumen inicial ~17/semana (12 FICHA + 2 CRÉDITO + 3 MORA), crece con el tiempo. Búsqueda/paginación/SLA NO urgen aún.

#### Fase Tickets-Producción *(go-live · 3 tipos reales)* — BLOQUEANTE

> Los 3 flujos comparten patrón: **Comercial reporta → Tesorería/Data Science valida → resuelto o rechazado**, con un caso "se carga en el segundo corte". Dos cambios estructurales + endurecer seguridad antes de meter PII real.

| # | Ticket | Descripción | Tipo | Bloqueado por |
|---|--------|-------------|------|---------------|
| T-P1 | TKT-020 | **Modelo de cola por área** (estructural). Hoy el ticket se asigna a una **persona fija** (`responsable_id`). Cambiar a: el ticket pertenece a un **área** (`area_id`, cola) y `responsable_id` es **nullable** hasta que alguien del área lo "toma" (self-assign). FICHA/CRÉDITO → cola **Tesorería**; MORA → cola **Data Science**. Reasignación manual del gerente = botón posterior, no día 1. | Estructural | — |
| T-P2 | TKT-021 | **Estados explícitos** (estructural). Reemplazar el estado derivado por paridad por estados que controla el responsable: **Abierto** (auto al crear) → **En revisión** (alguien lo tomó) → **Programado** (validado, se carga en el siguiente corte/tanda) → **Resuelto** / **Rechazado** (motivo obligatorio). "Programado" cubre el "se carga en la siguiente"; **sin fecha/hora por ahora** (cortes sin horario fijo). Esto también resuelve TKT-001 (la paridad bloqueaba dos mensajes consecutivos del mismo lado). | Estructural | — |
| T-P3 | TKT-022 | **Seed de los 3 tipos**: áreas (Tesorería, Data Science) + catálogo (FICHA NO REFLEJADA, CRÉDITO FALTANTE, ERROR EN MORA) con sus **campos dinámicos** y ruteo a cola de área. Campos pendientes de confirmar listado fino con el usuario. | Datos | T-P1, listados usuario |
| T-P4 | RLS-001/002/004/005 + SEC-001 | **Seguridad full antes de PII real** (ver Fase Tickets-Seguridad/Arquitectura abajo). Con datos reales de clientes pasa de "nice to have" a **bloqueante de go-live**: cerrar `profiles_select` (RLS-002), validar participación en adjuntos lectura+escritura/Storage (RLS-001/005), bloquear respuestas en tickets cerrados (RLS-004), migrar mutaciones a Server Actions con Zod servidor (SEC-001). | Seguridad | — |

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

#### Fase Tickets-Arquitectura

| # | Ticket | Descripción |
|---|--------|-------------|
| T-A1 | SEC-001 | Migrar `crearTicket` y `responderTicket` a Server Actions con Zod servidor. **Elevado a bloqueante de go-live (2026-06-06)** por PII real — ver T-P4. |

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

#### Fase Plataforma-Auth

| # | Ticket | Estado | Descripción |
|---|--------|--------|-------------|
| P-A1 | TKT-AUTH-001 | ✅ **2026-07-02** | **Tickets deja de ser universal + stand-by corporativo.** Nueva bandera `acceso_tickets` (default `false`), guard de módulo en `/tickets`. Usuarios sin ningún acceso → `/stand-by` con mensaje ("tu área y accesos los asigna administración"). Se elimina onboarding self-service (`complete_onboarding`); admin asigna área y accesos desde `/admin/usuarios`. Allowlist de correos externos vía `NEXT_PUBLIC_AUTH_EMAILS_EXTRA`. |

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

### 2.5 Módulo Asistente IA *(agente — track paralelo)*

> La demo determinística de `/cartera/chat` (PRO-004, KB embebida sin LLM) se entregó el 2026-06-04. Esta sección la evoluciona a **agente real con tools sobre datos vivos**. Decisiones de stack/PII del 2026-06-09 en §4. Sin infra nueva: todo vive en el route handler de Next.js en Vercel.

#### Fase IA-A — Agente con tools sobre RPCs existentes *(en curso)*

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| IA-A1 | AI-001 | Migrar `/api/ai/assistant` de respuesta determinística a **LLM real (Gemini API de pago)** vía Vercel AI SDK: `streamText` + `useChat`, system prompt dinámico (rol + accesos del usuario + los 13 chunks de la KB embebidos completos — sin RAG vectorial, caben en contexto). | — |
| IA-A2 | AI-002 | **Tools sobre los 5 RPCs existentes**: `getResumen`, `getPorCoordinacion`, `getPorRecuperador`, `getMora`, `getCohort`. Server-side con el cliente Supabase de la sesión del usuario (los checks `rol=admin OR acceso_cartera` de los RPCs aplican solos). `getMora` **seudonimizada**: código de acreditado + saldos + días, sin nombres ni teléfonos. | AI-001 |
| IA-A3 | AI-003 | Guardrails + pulido: nunca inventar cifras (números solo vía tools, citados con su `fecha_corte`), actualizar copy del banner (deja de ser "demo embebida"), `GOOGLE_GENERATIVE_AI_API_KEY` documentada en `.env.example` y cargada en Vercel. | AI-001 |
| IA-A4 | AI-004 | ✅ **2026-06-15** — **Asistente como widget flotante** en layout de cartera: FAB + panel que reusa `AssistantChat`; `/cartera/chat` redirige a `/cartera`; item del sidebar retirado. **Pantalla completa**: botón expandir/contraer en header del panel (`Maximize2`/`Minimize2`), `Esc` sale de fullscreen (segundo `Esc` cierra), `body` sin scroll al expandir. | AI-001 |

#### Fase IA-B — Memoria + RAG ligero

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| IA-B1 | AI-010 | Tabla `assistant_conversations` (historial persistente + logging de preguntas reales para mejorar la KB). | AI-001 |
| IA-B2 | AI-011 | pgvector en Supabase + tool `buscarDocumentacion` sobre los `.md` de `docs/` (solo cuando la KB ya no quepa en contexto). | AI-001 |

#### Fase IA-C — Acciones y escalado

| # | Ticket | Descripción | Bloqueado por |
|---|--------|-------------|---------------|
| IA-C1 | AI-020 | Tool `crearBorradorTicket` integrada al catálogo de tickets. | Fase Tickets-Producción |
| IA-C2 | AI-021 | "Preguntar sobre este dashboard" (contexto por página) + comparativas multi-corte. | IA-B* |
| IA-C3 | AI-022 | Detalle completo de mora en la tool (nombres/teléfonos) tras visto bueno de cumplimiento; evaluar migración a **Vertex AI** con ZDR/region pinning (swap de provider de una línea con AI SDK). | OK cumplimiento |

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

### Asistente IA (2026-06-09)

- **Provider = Gemini, tier de pago** (la empresa opera con Google Workspace). Billing activo desde el día 1: el tier gratuito de AI Studio usa prompts/respuestas para entrenar modelos (con revisores humanos) — **prohibido** con datos de la empresa. El tier de pago procesa bajo el Data Processing Addendum, sin entrenamiento, logs breves solo anti-abuso.
- **Orquestación = Vercel AI SDK** (`ai` + `@ai-sdk/google`; `@ai-sdk/react` ya estaba instalado). Migración futura a Vertex AI (`@ai-sdk/google-vertex`) con zero data retention y region pinning si cumplimiento o data residency lo exigen — es swap de provider de una línea.
- **Alcance Fase A** = LLM + streaming + tools que envuelven los 5 RPCs de cartera existentes. Sin RAG vectorial ni persistencia (la KB de 13 chunks cabe completa en el system prompt).
- **PII (decisión 2026-06-09)**: la tool de mora va **seudonimizada** (código de acreditado, saldos, días de mora; sin nombres ni teléfonos) hasta tener visto bueno de cumplimiento (LFPDPPP, aviso de privacidad, secreto financiero). Los RPCs agregados (resumen/coordinación/recuperador/cohort) no exponen PII.
- **Guardrail central**: el agente nunca inventa cifras — todo número sale de una tool y se cita con su `fecha_corte`.
- **Infra**: cero servicios nuevos. Vive en `/api/ai/assistant` (Next.js en Vercel, `maxDuration: 60`). El microservicio Render no participa.

### Tickets — go-live a producción (2026-06-06)

- **La "demo" es un go-live real**: se lanzan 3 tipos de ticket a producción con PII de clientes (FICHA NO REFLEJADA, CRÉDITO FALTANTE, ERROR EN MORA), luego se agregan más incrementalmente. Audiencia: Dupont (dir. crédito) + gerente de sistemas. Objetivo declarado: **uso diario real**, que además luzca en la demo.
- **Asignación = cola por área, NO asignación manual del gerente** (al inicio). El ticket cae en la cola del área (Tesorería / Data Science) y cualquiera del área lo "toma". Razón: con ~17/semana la cola se autorregula; la asignación manual agrega un cuello de botella humano. Reasignación del gerente = botón posterior, no día 1.
- **Estados explícitos** controlados por el responsable (Abierto → En revisión → Programado → Resuelto / Rechazado), reemplazan el estado derivado por paridad. "Programado" = "se carga en el siguiente corte/tanda".
- **"Se carga en la siguiente" SIN fecha/hora** por ahora (los cortes no tienen horario fijo). Se agrega fecha estimada cuando los cortes se calendaricen.
- **Seguridad full = bloqueante de go-live** (no post-v1.0) por PII real: RLS-001/002/004/005 + SEC-001.
- **Limpieza solo del módulo de Tickets** para producción. Score ya está perfecto (no se toca).

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
- **2026-06-17** — Auth del endpoint `/cartera/procesar` con **token compartido** (`INTERNAL_API_TOKEN`), no HMAC. Razón: tráfico interno server-to-server sobre HTTPS; HMAC (firma de body + timestamp) era sobre-ingeniería para este caso. Comparación en tiempo constante y fail-closed en el micro (SEC-002).

### Datos

- **2026-05-20** — `cartera_uploads` (ledger) y `stg_yunius_cartera_individual` (dato crudo) separadas. Permite re-procesar sin perder histórico.
- **2026-06-17** — **Fecha de corte automática**: ya no la elige el usuario. El sistema la fija al **día anterior** (en horario `America/Mexico_City`), porque el reporte de Yunius refleja el cierre del día previo. Migración `20260617120000_cart_015_trazabilidad_procesado.sql`.
- **2026-06-17** — **Trazabilidad de procesamiento**: `cartera_uploads` gana `procesado_por` + `procesado_at`. La UI de carga muestra "Subido por" y "Procesado por" (nombres resueltos desde `profiles`).
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
7. **Fase IA-A (AI-001..003)**: agente Gemini + tools sobre RPCs (§2.5). Usuario: crear API key de Gemini **con billing activo** y cargarla en Vercel/`.env.local`.

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
- `AI-` Asistente IA / agente
- `TKT-` Tickets — funcionalidad / ciclo de vida
- `REC-` Reclutamiento — datos / agendamiento / integraciones Google

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

- **2026-06-16** — Admin: toggle de **acceso a Cartera** en el panel global `/admin/usuarios` (paridad con el de Score, en navy), conservando el panel individual `/admin/cartera`. Nota: el panel admin sigue repartido por módulo (catálogo/áreas en Tickets, métricas de score en Score, accesos cartera en Cartera) + transversales (usuarios/métricas) en el global.
- **2026-06-16** — AI-004 (pulido): **pantalla completa** del widget del asistente (botón expandir/contraer, `Esc` sale de fullscreen y un 2º `Esc` cierra, sin scroll de fondo).
- **2026-06-15** — AI-004: asistente IA como **widget flotante** (FAB + panel que reusa `AssistantChat`) en todas las páginas de cartera; `/cartera/chat` redirige a `/cartera`; item retirado del sidebar. Además: logging de tokens y costo estimado por pregunta del agente.
- **2026-06-15** — Catálogo de tickets a producción: seed de áreas + **presets de login de 73 empleados** (`20260612160000`, `handle_new_user` aplica rol/área/nombre al primer login), catálogo de las **3 incidencias confirmadas en junta** (`20260612160500`: Ficha no reflejada / Crédito faltante → Tesorería, Error en mora → Data Science, con campos dinámicos y responsables default) y **borrado de los 4 tipos de prueba** del seed inicial (`20260615120000`, con guard anti-FK). Todas aplicadas en remoto.
- **2026-06-12** — Limpieza pre go-live: borrados todos los tickets de prueba y reiniciada la numeración (`tickets_numero_seq` → 1) vía migración `20260612154500_tkt_limpieza_tickets_prueba.sql` (aplicada en remoto). El primer ticket real será #1. Pendiente: vaciar el bucket `ticket-attachments` (delete directo de `storage.objects` no permitido por SQL → vía Storage API). No toca `areas`/`problem_catalog`/`profiles`.
- **2026-06-02** — C2-5 CART-014 + C3-5 DASH-005: cohortes por fecha de inicio de ciclo. RPC `cartera_cohort(fecha_corte, frontera)` parte la cartera en dos grupos (`antes`/`desde` la frontera) con el mismo contrato que `cartera_resumen`. Página `/cartera/cohort` con dos paneles comparativos + selector de fecha frontera (default 1-abr-2026, configurable). Hallazgo: la muestra actual no tiene ciclos 2026 (rango 2023-08 a 2025-11), por eso se adelantó la frontera configurable para que la demo muestre ambas cohortes pobladas. `sin_fecha=0` confirma `fecha_inicio_ciclo` 100% poblado.
- **2026-06-02** — C2-4 CART-013 + C3-4 DASH-004: bandeja de mora operativa. RPC `cartera_mora_operativa` (lista de 120 morosos con datos de gestión) + página `/cartera/mora` con tabla interactiva (búsqueda, orden) y columnas de gestión Call Center/Campo **mockeadas** (editables sin persistir, banner modo demo). Decisión: la captura real (tabla `cartera_seguimiento` + escritura) queda como siguiente feature — es la que supera al Excel (histórico de gestión entre cortes).
- **2026-06-02** — C2-3 CART-012 + C3-3 DASH-003: cartera por recuperador. RPC `cartera_por_recuperador(fecha, coordinacion?)` + página `/cartera/recuperador` (tabla indicadores semáforo + distribución heatmap). Filtro opcional por coordinación. Validado: 7 recuperadores, identifica al cobrador crítico (Campos Sánchez 100% PAR>90) vs sano (CALL CENTER 8.97%). "Mi cartera" diferido (profiles sin codigo_recuperador).
- **2026-06-02** — C2-2 CART-011 + C3-2 DASH-002: cartera por coordinación. RPC `cartera_por_coordinacion` (coords ordenadas por riesgo, 8 buckets c/u) + página `/cartera/coordinacion` con tabla de indicadores (semáforo PAR) + tabla distribución heatmap coord × buckets. Selector de fecha reutilizable (`fecha-selector.tsx`). Validado: Valle de Bravo región más riesgosa (44% PAR>30), Metepec la más sana pese a mayor cartera.
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

## 8. Módulo Reclutamiento *(S1–S3 entregados — en desarrollo)*

> Detalle de contexto, stakeholders, flujo as-is y pain points en `RESEARCH-CONSOLIDADO.md §13`. Esta sección es el plan de ejecución (modelo de datos, arquitectura, sprints).

### 8.1 Objetivo del MVP

Digitalizar el flujo de entrevistas que hoy lleva el Gerente de RH en Excel/correo manual para vacantes de **Gerente de Inversiones**: desde la postulación del candidato hasta la oferta, con el **agendamiento masivo de entrevistas** (la fase que más duele hoy) como feature estrella. Mismo repo, 4º módulo, gated por flag `acceso_reclutamiento`.

### 8.2 Modelo de datos refinado

**Enums** (prefijo `rec_`):
- `rec_etapa`: `postulado` → `en_revision` → `viable` → `entrevistas_agendadas` → `comite` → `final_dg` → `oferta` → `contratado`; `descartado` (terminal desde cualquier etapa).
- `rec_fuente`: `occ` · `computrabajo` · `linkedin` · `factorial` · `manual`.
- `rec_revision_cv`: `viable` · `parcial` · `no_viable`.
- `rec_motivo_descarte`: `no_perfil` · `expectativa_salarial` · `ubicacion` · `experiencia_insuficiente` · `no_contesto` · `declino` · `otro`.
- `rec_viabilidad`: `si` · `no` · `filtro_dg`.
- `rec_entrevista_estado`: `programada` · `realizada` · `no_show` · `cancelada`.
- `rec_plantilla_codigo`: `confirmacion_postulacion` · `agendamiento_fase2` · `notificacion_entrevistador` · `pase_fase3` · `descarte` · `oferta` · `informativa`. El placeholder `{{magic_link}}` es **exclusivo** de `notificacion_entrevistador` (correo con la liga del entrevistador a su evaluación).

**Tablas** (prefijo `rec_`, todas con RLS desde la 1ª migración):

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `rec_vacantes` | Vacante a cubrir | `id`, `titulo`, `area`, `descripcion`, `estado` (abierta/cerrada), `creada_por_id`, `created_at` |
| `rec_candidatos` | Postulante | `id`, `vacante_id`, `nombre`, `email`, `telefono`, `fuente` (`rec_fuente`), `etapa` (`rec_etapa`), `revision_cv` (`rec_revision_cv`), `viabilidad` (`rec_viabilidad`), `motivo_descarte` (`rec_motivo_descarte`), `cv_storage_path`, `notas`, `created_at` |
| `rec_sesiones_entrevistas` | Bloque de entrevistas de una fase (ej. Fase 2 del día X) | `id`, `vacante_id`, `fase` (smallint), `fecha`, `descripcion`, `creada_por_id` |
| `rec_entrevistas` | Cita candidato × sesión | `id`, `sesion_id`, `candidato_id`, `fecha_hora`, `estado` (`rec_entrevista_estado`), `gcal_event_id` (nullable) |
| `rec_evaluaciones` | Resultado de un entrevistador sobre una entrevista | `id`, `entrevista_id`, `entrevistador_id` (→ `profiles.id`), `puntaje`, `comentarios`, `recomendacion`, `enviada_at` |
| `rec_magic_links` | Token de acceso público del entrevistador a sus evaluaciones de una sesión | `id`, `sesion_id`, `entrevistador_id`, `token` (único), `expira_at`, `usado_at` |
| `rec_plantillas_correo` | Plantillas editables | `id`, `codigo` (`rec_plantilla_codigo`), `asunto`, `cuerpo` (con placeholders), `activa` |
| `rec_correos_enviados` | Bitácora de correos | `id`, `candidato_id`, `plantilla_codigo`, `to_email`, `enviado_at`, `estado`, `error`, `gmail_message_id` (nullable, id que devuelve Gmail API), `gmail_thread_id` (nullable, para enlazar respuestas del candidato en v2) |
| `rec_credenciales_google` | Tokens OAuth Google del reclutador (Calendar + Gmail) | `id`, `profile_id`, `refresh_token` (cifrado), `scope`, `actualizado_at` |

**Decisiones de modelado:**
1. **No se crea `rec_entrevistadores` en el MVP.** Los entrevistadores son colaboradores con `profiles`; `rec_evaluaciones.entrevistador_id` y el orden de entrevistadores referencian `profiles.id` directo. Vista opcional `rec_entrevistadores_v` para listarlos. v2: tabla propia cuando aparezcan entrevistadores externos (sin `auth.users`).
2. **Magic link consolidado por (sesión × entrevistador).** Un token da acceso a todas las evaluaciones de ese entrevistador en la sesión → **1 correo, no 13**. Se descarta un `magic_link_token` redundante por evaluación.

### 8.3 Arquitectura del módulo

- **Páginas internas:** `app/(dashboard)/reclutamiento/` (vacantes, candidatos, pipeline kanban por `rec_etapa`, sesiones/agendamiento, plantillas).
- **Ruta pública del entrevistador:** `app/reclutamiento/evaluar/[token]/` — **fuera de `(dashboard)`** y **excluida del matcher de `middleware.ts`** (el filtro de dominio bloquearía a entrevistadores que entran por magic link). Valida el token contra `rec_magic_links`.
- **Escritura:** Server Actions en `lib/actions/reclutamiento.ts` (patrón Score: `{ ok, error }` + `safeParse` + `revalidatePath`).
- **Validación:** `lib/schemas/reclutamiento.ts` (zod).
- **Componentes:** `components/reclutamiento/`.
- **Google Workspace (Opción A — full):** helper `lib/google/client.ts` (OAuth de usuario + refresh + Calendar + Gmail). **Nueva integración** — hoy no existe Google Workspace en el repo.
  - **Cuenta:** `reclutamiento@financieracrediflexi.com` hace login OAuth **una sola vez** en `/reclutamiento/admin/conectar-google`; el `refresh_token` se guarda cifrado en `rec_credenciales_google`.
  - **Scopes:** `gmail.send`, `gmail.readonly`, `calendar.events`.
  - **Gmail API:** envío de correos (plantillas + magic links). **Calendar API:** crea eventos con **Meet links** al agendar.
- **RPCs `security definer`:** `rec_transicion_etapa`, `rec_generar_entrevistas` (agendamiento masivo), `rec_submit_evaluacion` (vía token público, resuelve `entrevistador_id` desde el token).
- **Sidebar:** sección "Reclutamiento" gated por `rol==='admin' || acceso_reclutamiento`.
- **Storage:** bucket `reclutamiento` (CVs), RLS por vacante/rol.
- **Política RLS (MVP — definitiva):**
  - **Admin (Héctor):** SELECT/INSERT/UPDATE/DELETE en **todas** las tablas `rec_*` y todas las vacantes (sin filtro por dueño).
  - **Nadie más** entra a la app autenticada. El flag `acceso_reclutamiento` existe en el schema (para v2) pero en MVP solo Héctor lo tiene en `true`.
  - **Magic link:** la ruta pública `/reclutamiento/evaluar/[token]` se valida por RPC `security definer` que resuelve `entrevistador_id` desde el token; el entrevistador solo lee/escribe evaluaciones de **la sesión asociada a SU token**.

### 8.4 Roadmap de sprints

> **Orden:** Sprint G (Google) va **antes** del agendamiento masivo (S4) porque el feature estrella no entrega valor sin Google conectado: es el que genera los Meet links y manda los correos. Se consolidó el antiguo S6 (Correos) + S7 (Calendar) en **Sprint G** (comparten OAuth y el mismo `lib/google/client.ts`).

| Sprint | Foco | Tickets |
|---|---|---|
| **S1** ✅ 2026-06-30 | Fundaciones: flag `acceso_reclutamiento`, enums + tablas + RLS, tipos, sidebar | REC-001..REC-008 ✅ |
| **S2** ✅ 2026-07-01 | Vacantes + candidatos (CRUD, carga de CV a Storage, fuente, revisión CV) | REC-009..REC-017 ✅ |
| **S3** ✅ 2026-07-01 | Pipeline: kanban por etapa, transiciones (`rec_transicion_etapa`), descarte con motivo | REC-018..REC-025 ✅ |
| **Sprint G** ✅ 2026-07-07 | **Google Workspace: OAuth (`/api/google/conectar` + `/callback`), Calendar API + Gmail API vía REST, cifrado AES-256-GCM del `refresh_token`, plantillas + bitácora** | REC-026..REC-029 ✅ |
| **S4** ✅ 2026-07-07 | **Agendamiento masivo** (cascada de Meets + correos reales + transición) — server action `agendarSesion` + UI `/reclutamiento/agendar` | REC-030..REC-032 ✅ |
| **S5** ✅ 2026-07-15 | Evaluaciones: magic link por email (token propio, no Auth), ruta pública `/evaluar/[token]`, RPCs `rec_sesion_por_token` + `rec_submit_evaluacion` — ver §8.8 | REC-046..REC-052 ✅ |
| **S6** ✅ 2026-07-27 | Comité + entrevistadores dinámicos + contratación (correo de bienvenida) — ver §8.9 | REC-053..REC-060 ✅ |

**S6 — alcance ampliado (2026-07-27):** además de la vista de comité original, S6 incluye entrevistadores dinámicos (N, no 3 fijos), transición automática a `en_revision` al abrir el perfil, campo de comentarios del comité, registro de la decisión de la DG (Javier) y la automatización del correo de bienvenida al contratar (con adjuntos fijos y CC configurable). Detalle completo en §8.9.

**S3 — DAG de transiciones (entregado 2026-07-01):** la RPC `rec_transicion_etapa` (security definer, valida rol/acceso adentro) mueve un candidato **un paso hacia adelante** y registra cada cambio en `rec_candidato_historial`:

```
postulado → en_revision → viable → entrevistas_agendadas → comite → final_dg → oferta → contratado
<cualquier etapa no terminal> → descartado   (motivo_descarte obligatorio)
```

No se permite saltar etapas, retroceder, ni salir de un estado terminal (`contratado` / `descartado`). El tablero (`/reclutamiento/pipeline`) es filtrable por vacante; cada card ofrece el avance forward y el descarte con motivo inline. **S4 (entregado 2026-07-07):** la transición a `entrevistas_agendadas` ya no es manual — `agendarSesion` la dispara automáticamente al agendar la sesión de Fase 2 (vía la RPC `rec_transicion_etapa`), junto con la creación de los eventos de Calendar con liga de Meet y el envío de los correos por Gmail.

**Sprint G + S4 — Agendamiento en cascada (entregado 2026-07-07):** desde `/reclutamiento/agendar` el usuario elige vacante, candidatos en etapa `viable`, fecha/hora de inicio, pausa opcional y los 3 entrevistadores (editables, default Benny/Maritere/Sergio). El server action `agendarSesion` (`lib/actions/agendamiento.ts`) calcula la cascada (una liga de Meet de 60 min por candidato; los 3 entrevistadores rotan en bloques de 20 min; los arranques se escalonan 20 min), y por cada candidato: crea el evento de Calendar con Meet (`conferenceDataVersion=1`, invita candidato + 3 entrevistadores con `sendUpdates=all`), guarda `gcal_event_id`/`meet_url` en `rec_entrevistas`, envía el correo `agendamiento_fase2` por Gmail, registra en `rec_correos_enviados` y transiciona la etapa. Al final manda un correo `agenda_entrevistadores` con la tabla HTML de la sesión. La integración con Google es **REST directo sin `googleapis`** (`lib/google/client.ts`), y el `refresh_token` se cifra con AES-256-GCM (`lib/google/crypto.ts`, llave en `GOOGLE_TOKEN_ENCRYPTION_KEY`). La cuenta emisora es **reconectable** sin cambiar código (hoy `uzziel.valdez@`; mañana `reclutamiento@`). **REC-033 (2026-07-08):** el correo `agenda_entrevistadores` ahora adjunta el CV de cada candidato agendado (descargado del bucket `reclutamiento`); `enviarCorreo` soporta adjuntos vía MIME `multipart/mixed`.

### 8.5 Fuera del MVP

- Entrevistadores externos (sin `profiles`) → tabla `rec_entrevistadores` v2.
- **Modelo N↔N** (persona × postulación × vacante) → v2 cuando haya volumen real de candidatos repitiendo postulaciones. En MVP `rec_candidatos.vacante_id` es FK directa (1 candidato ↔ 1 vacante).
- Portal de candidatos externos (el middleware/callback cierran todo a `@financieracrediflexi.com`).
- Scoring/IA de CVs, parsing automático de currículums.
- Multi-vacante genérico avanzado (el MVP se centra en Gerente de Inversiones).
- Recordatorios automáticos / cron de no-show.
- Parsing de respuestas entrantes del candidato vía `gmail_thread_id` (ej. confirmaciones de asistencia).

### 8.6 Decisiones tomadas (2026-06-30)

- Derivar entrevistadores de `profiles` (sin tabla propia en MVP).
- Magic link consolidado por (sesión × entrevistador).
- Ruta pública del evaluador fuera de `(dashboard)` y excluida del middleware.
- Patrón de escritura = Server Actions (Score), no client-direct (Tickets).
- **Alcance MVP = Opción A (full Google Workspace):** Gmail + Calendar API con OAuth de `reclutamiento@financieracrediflexi.com`.
- **Sprint G antes de S4** (Google conectado es prerequisito del agendamiento masivo); S6+S7 consolidados en Sprint G.
- **Pipeline 1↔1** candidato ↔ vacante; N↔N a v2.
- **RLS MVP:** admin (Héctor) ve y escribe todo; nadie más entra; entrevistadores solo por magic link a su sesión.
- **Cifrado `refresh_token`:** validar Supabase Vault al inicio del Sprint G; si no está disponible, fallback a `pgcrypto` (`pgp_sym_encrypt`) con llave en `GOOGLE_TOKEN_ENCRYPTION_KEY` (Vercel).

### 8.7 TODOs / preguntas abiertas

1. **Plantillas de correo:** conseguir el copy literal de Héctor para todas las plantillas antes del Sprint G (hoy solo tenemos "Entrevista Final" / `pase_fase3`).
2. **"Filtro por DG":** confirmar con Héctor la regla de transición (¿un voto basta? ¿mayoría? ¿solo cuenta como voto registrado y Héctor decide en comité?).
3. **Entrevistadores:** ¿siempre los mismos 3 en orden fijo Benny → Maritere → Sergio, o configurables por vacante/sesión?
4. **Retención de datos** de candidatos descartados (compliance CNBV / LFPDPPP) — definir política de purga/anonimización.
5. **Workspace OAuth:** validar al inicio del Sprint G si CrediFlexi restringe apps externas en su Workspace; si sí, Manuel debe whitelistear el `client_id` una vez.

> Resueltos (ya no son preguntas abiertas): alcance Gmail+Calendar (= Opción A) · cifrado del `refresh_token` (= Vault si está, `pgcrypto` si no — ver §8.6) · pipeline (= 1↔1, N↔N v2) · RLS (= admin ve todo, nadie más entra). El set de placeholders de plantillas y la caducidad/rotación de magic links se resuelven como parte del trabajo del Sprint G y S5 respectivamente (no son bloqueantes de planeación).

### 8.8 S5 — Evaluaciones vía magic link (entregado 2026-07-15)

> **Entregado 2026-07-15** (REC-046..REC-052). Lo que sigue es el plan de implementación tal como se ejecutó; las notas de cierre están al final de la sección.

> Plan listo para ejecutar (2026-07-15). Tickets REC-046..REC-052, un commit atómico por ticket, en este orden. Convenciones del repo: commits en español `feat(rec): ... (REC-0XX)`, **sin** `Co-Authored-By` ni firma de Claude; Server Actions con patrón `Result<T> = ({ ok: true } & T) | { ok: false; error: string }`; validación con zod `safeParse`; **nunca** commitear `sessions.md` ni `.env*`.

**Contexto que el implementador debe leer antes de tocar código:**
- `supabase/migrations/20260630120200_rec_003_tablas.sql` — ya existen `rec_magic_links` (token único, `expira_at`, `usado_at`, `unique(sesion_id, entrevistador_id)`) y `rec_evaluaciones` (`unique(entrevista_id, entrevistador_id)`, `entrevistador_id → profiles.id` NOT NULL).
- `supabase/migrations/20260630120300_rec_004_rls.sql` — RLS actual (admin-only) de las tablas `rec_*`.
- `supabase/migrations/20260707100100_rec_010_agendamiento.sql` — columnas de sesión (`entrevistadores` jsonb `[{nombre, email}]`) y seed de plantillas.
- `lib/actions/agendamiento.ts` — server action `agendarSesion` (aquí se generan los magic links en REC-048).
- `lib/google/client.ts` — `enviarCorreo` (ya soporta adjuntos; para estos correos NO se adjunta nada).
- `middleware.ts` — hoy solo `/login` y `/auth` son públicas; hay que abrir `/evaluar`.
- `lib/supabase/types.ts`, `lib/schemas/reclutamiento.ts` — patrones de tipos y schemas existentes.

**Decisión de diseño clave (resuelve una inconsistencia del schema):** en S4 los entrevistadores quedaron modelados como jsonb `[{nombre, email}]` en `rec_sesiones_entrevistas.entrevistadores` — NO son `profiles` (Benny/Maritere/Sergio no tienen cuenta en la app). Por lo tanto S5 identifica al entrevistador **por email**, no por `profiles.id`: se relajan `rec_magic_links.entrevistador_id` y `rec_evaluaciones.entrevistador_id` a nullable y se agregan columnas `entrevistador_email` + `entrevistador_nombre` (text). Los uniques pasan a `(sesion_id, entrevistador_email)` y `(entrevista_id, entrevistador_email)`.

**Parámetros de producto (ya decididos, no preguntar):**
- Token: `crypto.randomBytes(32).toString('base64url')`, multi-uso hasta expirar (NO single-use; `usado_at` solo informativo, se actualiza en cada submit).
- Expiración: `fecha` de la sesión + 7 días (`expira_at = (fecha + interval '8 days')::date` a medianoche, o equivalente).
- URL pública: `/evaluar/[token]` (corta, va en correos). Carpeta `app/evaluar/[token]/page.tsx` — FUERA de `(dashboard)`.
- Formulario por candidato: `recomendacion` (`rec_viabilidad`: `si`/`no`/`filtro_dg`) **obligatoria**, `comentarios` (text, opcional), `puntaje` (1–10, opcional). Editable mientras el token no expire (upsert).
- La página pública muestra SOLO: nombre del entrevistador, vacante, fecha, y por candidato nombre + horario + su propio formulario. **Nunca** CVs, emails de candidatos ni evaluaciones de otros entrevistadores.
- Un correo individual por entrevistador (plantilla `notificacion_entrevistador`, placeholder `{{magic_link}}`) — no se mete la liga en el correo de agenda compartido porque las ligas son personales.

**Tickets:**

| Ticket | Entregable | Detalle |
|---|---|---|
| **REC-046** | Migración `rec_011_evaluaciones_magic_link.sql` | (a) `alter table rec_magic_links`: `entrevistador_id` nullable, add `entrevistador_email text`, `entrevistador_nombre text`; drop constraint `rec_magic_links_sesion_id_entrevistador_id_key`, nuevo `unique (sesion_id, entrevistador_email)`. (b) Igual en `rec_evaluaciones`: `entrevistador_id` nullable, add `entrevistador_email`/`entrevistador_nombre`; drop `rec_evaluaciones_entrevista_id_entrevistador_id_key`, nuevo `unique (entrevista_id, entrevistador_email)`. (c) Seed de plantilla `notificacion_entrevistador` (`on conflict (codigo) do update`): asunto `'Tus evaluaciones — {{vacante}} / {{fecha}}'`, cuerpo corto con `{{nombre_entrevistador}}`, `{{vacante}}`, `{{fecha}}`, liga `{{magic_link}}` y nota de que expira en 7 días. (d) RPC `rec_sesion_por_token(p_token text) returns jsonb` — `security definer set search_path = public`; valida token existente y no expirado (si no: `{"valido": false, "motivo": "invalido"|"expirado"}`); si es válido devuelve `{"valido": true, "entrevistador_nombre", "vacante", "fecha", "candidatos": [{entrevista_id, nombre, horario, evaluacion: {recomendacion, comentarios, puntaje} | null}]}` — candidatos de las `rec_entrevistas` de la sesión del token, ordenados por `fecha_hora`, con la evaluación existente de ESE email si la hay. (e) RPC `rec_submit_evaluacion(p_token text, p_entrevista_id uuid, p_recomendacion rec_viabilidad, p_comentarios text, p_puntaje smallint) returns jsonb` — security definer; valida token vigente Y que `p_entrevista_id` pertenezca a la sesión del token (si no, error); upsert en `rec_evaluaciones` por `(entrevista_id, entrevistador_email)` con `enviada_at = now()`; actualiza `usado_at = now()` en el magic link; devuelve `{"ok": true}` o `{"ok": false, "error": ...}`. (f) `grant execute` de ambas RPCs a `anon` y `authenticated`; `revoke` de todo lo demás. Las tablas siguen admin-only por RLS (el acceso público es EXCLUSIVAMENTE vía estas RPCs). |
| **REC-047** | Tipos TS | `lib/supabase/types.ts`: columnas nuevas de `rec_magic_links`/`rec_evaluaciones` y firmas de las dos RPCs (seguir el patrón de `rec_transicion_etapa`). |
| **REC-048** | Generación + correos en `agendarSesion` | En `lib/actions/agendamiento.ts`, después del correo de agenda (paso 5): por cada entrevistador `e1/e2/e3` → generar token (`crypto.randomBytes(32).toString('base64url')`), insert en `rec_magic_links` (`sesion_id`, `entrevistador_email`, `entrevistador_nombre`, `token`, `expira_at`), construir liga `${baseUrl}/evaluar/${token}` (baseUrl: usar la env pública de URL que ya exista en el repo — buscar `NEXT_PUBLIC_` en `.env.example`/código; si no hay ninguna, crear `NEXT_PUBLIC_APP_URL` y documentarla), y enviar correo individual con plantilla `notificacion_entrevistador` (cargarla junto con las otras dos en el paso 2). Registrar cada envío en `rec_correos_enviados` (`plantilla_codigo: 'notificacion_entrevistador'`, estado enviado/error). Errores aquí NO abortan la acción (mismo patrón de resiliencia del resto). Extender el retorno con `linksGenerados: number` si es útil para la UI. |
| **REC-049** | Ruta pública `/evaluar/[token]` | `middleware.ts`: agregar `pathname.startsWith('/evaluar')` a las rutas públicas (retornar `supabaseResponse` sin exigir user). `app/evaluar/[token]/page.tsx` (server component): llama `rec_sesion_por_token`; si `valido=false` renderiza pantalla amable ("liga inválida" / "liga expirada — pide una nueva a RH") sin filtrar información; si es válido renderiza encabezado (entrevistador, vacante, fecha) + lista de candidatos. Layout mínimo standalone (sin sidebar del dashboard), responsive (se usará desde celular). |
| **REC-050** | Formulario + submit | `lib/schemas/reclutamiento.ts`: schema zod `submitEvaluacionSchema` (`token`, `entrevista_id` uuid, `recomendacion` enum, `comentarios` opcional, `puntaje` 1–10 opcional). Server action `submitEvaluacion` en `lib/actions/reclutamiento.ts` (o archivo nuevo `lib/actions/evaluaciones.ts`): `safeParse` → llama RPC `rec_submit_evaluacion` → `Result`. Componente client `components/reclutamiento/evaluacion-form.tsx`: radio/segmented para `si`/`no`/`filtro_dg` (labels: "Viable" / "No viable" / "Filtro DG"), textarea comentarios, puntaje opcional, botón guardar con estado pending y confirmación visual. Precarga la evaluación existente si la hay. |
| **REC-051** | UX de progreso | En la página: badge "Evaluado ✓" por candidato ya evaluado, contador "N de M evaluados", los formularios siguen editables (re-guardar = actualizar). Orden de candidatos por horario. Estados vacíos correctos. |
| **REC-052** | Verificación + cierre | `npx tsc --noEmit` limpio, `npx next build` verde, `supabase db push` de la migración a remoto, smoke test manual del flujo (agendar → correo con liga → abrir `/evaluar/[token]` → guardar evaluación → editar → verificar fila en `rec_evaluaciones`). Commits atómicos por ticket. **Actualizar docs:** PLAN.md §8.4 (fila S5 → ✅ con fecha y tickets REC-046..052), este §8.8 marcar como entregado, bump de "Última actualización"; RESEARCH-CONSOLIDADO.md §13: agregar nota en 13.0 (o subsección nueva) con las decisiones entregadas de S5 (identificación por email en vez de profiles.id, RPCs security definer como única superficie pública, token multi-uso 7 días) y bump de fecha. Verificar consistencia final de ambos documentos contra lo implementado. |

**Fuera de alcance de S5 (no hacer):** vista de comité (S6), correo `pase_fase3` automático, recordatorios, cancelar/reagendar sesiones, rate limiting de la ruta pública (v2).

**Notas de cierre (2026-07-15):** entregado según plan. La migración `20260715120000_rec_011_evaluaciones_magic_link.sql` relaja `entrevistador_id` a nullable y agrega `entrevistador_email`/`entrevistador_nombre` con uniques por email en `rec_magic_links` y `rec_evaluaciones`; las RPC `rec_sesion_por_token` y `rec_submit_evaluacion` (security definer, grant a `anon`) son la única superficie pública. `agendarSesion` genera un token por entrevistador (`randomBytes(32).base64url`, expira a los 7 días) y envía la liga personal con la plantilla `notificacion_entrevistador`; la URL base se deriva de los headers de la petición (sin env nueva). La ruta `/evaluar/[token]` vive fuera de `(dashboard)` y está excluida del middleware; muestra solo nombre + horario + formulario por candidato (nunca CVs ni datos de otros). Pendiente operativo: `supabase db push` de la migración a remoto y smoke test end-to-end (requiere entorno con deps instaladas — el checkout local tenía node_modules incompleto).

### 8.9 S6 — Comité, entrevistadores dinámicos y contratación (plan 2026-07-27)

> Plan listo para ejecutar. Tickets REC-053..REC-060, un commit atómico por ticket, en este orden. Convenciones del repo: commits en español `feat(rec): ... (REC-0XX)`, **sin** `Co-Authored-By` ni firma de Claude; Server Actions con patrón `Result<T>`; zod `safeParse`; **nunca** commitear `sessions.md` ni `.env*`.

**Contexto que el implementador debe leer antes de tocar código:**
- `lib/actions/agendamiento.ts` — `agendarSesion` hoy asume exactamente 3 entrevistadores (`[e1, e2, e3]`, cascada de bloques de 20 min, tabla de agenda con 3 columnas, magic links por entrevistador).
- `lib/schemas/reclutamiento.ts` — `agendarSesionSchema` + `calcularCascada` + `ENTREVISTADORES_DEFAULT` (hoy Benny/Maritere/Sergio hardcodeados).
- `lib/actions/reclutamiento.ts` — `transicionarCandidato` y patrón de acciones existente; RPC `rec_transicion_etapa` (DAG §8.4).
- `app/(dashboard)/reclutamiento/` — páginas existentes (candidatos, pipeline, agendar) para respetar composición y componentes.
- `supabase/migrations/20260715120000_rec_011_evaluaciones_magic_link.sql` — patrón de RPCs security definer y seeds de plantilla.
- `lib/google/client.ts` — `enviarCorreo` ya soporta adjuntos MIME (`multipart/mixed`, patrón REC-033).

**Decisiones de producto (ya tomadas, no preguntar):**
1. **Entrevistadores dinámicos:** en `/reclutamiento/agendar` se inicia con **un** entrevistador (nombre + email) y un botón **"+"** agrega más filas; captura manual libre, sin catálogo. `ENTREVISTADORES_DEFAULT` deja de ser obligatorio (puede quedar como sugerencia inicial de la primera fila o eliminarse). N ≥ 1.
2. **Cascada generalizada:** cada entrevistador conserva su bloque de **20 min** por candidato → duración del Meet por candidato = `N × 20` min; los arranques se siguen escalonando 20 min (la rotación funciona para cualquier N: en el slot k coinciden los pares i+j=k, nadie se empalma).
3. **`en_revision` automática:** al abrir el admin el perfil/detalle de un candidato en etapa `postulado`, el server component dispara `rec_transicion_etapa` → `en_revision` (nota: "Apertura de perfil"). Idempotente: solo si `etapa === 'postulado'`.
4. **Comité:** página `/reclutamiento/comite` (filtrable por vacante) con los candidatos en etapa `comite`. Por candidato: todas las evaluaciones de los entrevistadores (recomendación + comentarios + puntaje, desde `rec_evaluaciones`), un campo nuevo **`notas_comite`** (text en `rec_candidatos`, capturado en la reunión de comité) y las acciones de decisión.
5. **Decisión de la DG (Javier):** Javier NO tiene login; la pantalla de comité se le muestra en la reunión y **el admin registra ahí mismo** la decisión: "Pasa con DG" (→ `final_dg`) o "Descartar" (motivo obligatorio). Todo queda en `rec_candidato_historial` (ya existente) — sí se documenta.
6. **Contratación:** acción `contratarCandidato` desde el comité/pipeline para candidatos en `final_dg` u `oferta`; captura `fecha_ingreso` y `fecha_limite_docs`, permite editar los CC (prellenados desde la plantilla) y al confirmar: encadena las transiciones del DAG hasta `contratado` y envía el correo **`bienvenida_contratacion`** al candidato con CC.
7. **Correo de bienvenida** (copy base = correo real de Héctor 2026-07-07 "Bienvenido / Documentos para contratación"): lista de documentos (acta de nacimiento, INE, CURP, constancia fiscal SAT, NSS/IMSS, comprobante de domicilio, estado de cuenta bancario, constancia laboral, constancia de estudios, layout de datos personales), liga del Google Form de Gente y Cultura (fija en el cuerpo), y **2 adjuntos fijos**: `FORMATO LAYOUT DATOS.xlsx` + `Lineamientos para fotografias.pdf`. Placeholders: `{{nombre_candidato}}`, `{{fecha_ingreso}}`, `{{fecha_limite_docs}}`.
8. **Adjuntos fijos desde Storage:** bucket `reclutamiento`, carpeta `plantillas/` (`plantillas/layout-datos-personales.xlsx`, `plantillas/lineamientos-fotografias.pdf`). **Paso operativo manual:** subirlos una vez por el dashboard de Supabase (los originales están en las Descargas de Uzziel, 2026-07-27). La acción los descarga y adjunta igual que REC-033.
9. **CC configurable:** columna `cc_emails jsonb` en `rec_plantillas_correo` (default seed: Irvin Mora, Cynthia Aguilar, Jesús Montellano); editable al momento de contratar (prellenado, se puede quitar/agregar).
10. **Automatización post-contratación adicional:** POR DEFINIR — S6 solo deja el gancho (la acción `contratarCandidato` centraliza el "al contratar pasa X"); no construir nada más ahí.

**Tickets:**

| Ticket | Entregable | Detalle |
|---|---|---|
| **REC-053** | Migración `rec_012_enum_bienvenida.sql` | `alter type rec_plantilla_codigo add value if not exists 'bienvenida_contratacion';` — **sola en su migración** (Postgres no permite usar un valor de enum nuevo en la misma transacción). |
| **REC-054** | Migración `rec_013_comite_contratacion.sql` | (a) `rec_candidatos`: add `notas_comite text`, `fecha_ingreso date`. (b) `rec_plantillas_correo`: add `cc_emails jsonb not null default '[]'`. (c) Seed plantilla `bienvenida_contratacion` (`on conflict (codigo) do update`) con el copy de la decisión 7 y `cc_emails` con los 3 defaults de la decisión 9. |
| **REC-055** | Tipos TS | `lib/supabase/types.ts`: columnas nuevas + valor de enum de plantilla. |
| **REC-056** | Entrevistadores dinámicos (lógica) | `lib/schemas/reclutamiento.ts`: `entrevistadores` pasa de 3 fijos a `z.array(...).min(1)`; `calcularCascada` recibe `numEntrevistadores` (bloque candidato = N×20 min, stagger 20 min). `lib/actions/agendamiento.ts`: reemplazar `[e1,e2,e3]` por loops sobre el array (descripción del evento, attendees, tabla HTML de agenda con N columnas, magic links y correos por N entrevistadores). |
| **REC-057** | Entrevistadores dinámicos (UI) | `/reclutamiento/agendar`: una fila de entrevistador (nombre + email) inicial + botón "+" para agregar y "×" para quitar (mín. 1); preview de cascada refleja N; validación inline de emails. |
| **REC-058** | `en_revision` automática | En el detalle/perfil del candidato: si `etapa === 'postulado'`, disparar `rec_transicion_etapa` → `en_revision` server-side al renderizar (con `revalidatePath`). No romper si la RPC falla. |
| **REC-059** | Comité + contratación | Página `/reclutamiento/comite` (decisiones 4–5) + sidebar. Server actions: `guardarNotasComite`, decisión (→ `final_dg` / descarte) reutilizando `transicionarCandidato`, y `contratarCandidato` (decisión 6: schema zod con `fecha_ingreso`, `fecha_limite_docs`, `cc_emails`; encadena transiciones; render de plantilla; descarga adjuntos de `plantillas/`; `enviarCorreo` con CC + adjuntos; bitácora en `rec_correos_enviados`). |
| **REC-060** | Verificación + cierre | `tsc`/`build` verdes, `supabase db push`, subir los 2 adjuntos al bucket (paso manual documentado), smoke test **con datos de prueba y correos propios — NUNCA los reales** (lección 2026-07-15), actualizar PLAN §8.4/§8.9 y RESEARCH §13, bump de fechas. |

**Fuera de alcance de S6 (no hacer):** resto de la automatización post-contratación (decisión 10), correo `pase_fase3` automático, recordatorios, cancelar/reagendar, portal del candidato, catálogo de entrevistadores.

**Notas de cierre (2026-07-27):** entregado según plan. Migraciones aplicadas a remoto: `rec_012` (enum `bienvenida_contratacion`), `rec_013` (columnas `notas_comite`/`fecha_ingreso` en `rec_candidatos`, `cc_emails jsonb` en `rec_plantillas_correo`, seed de la plantilla y bloque dinámico N×20 en `rec_sesion_por_token`), `rec_014` (plantilla `agendamiento_fase2` con placeholder único `{{rotacion_entrevistadores}}`) y `rec_015` (se agrega el mime type xlsx al bucket `reclutamiento` para poder subir el layout). Entrevistadores dinámicos (N ≥ 1) en schema, cascada, `agendarSesion` (eventos/attendees/tabla/magic links) y UI de `/reclutamiento/agendar`. `en_revision` automática al abrir el perfil de un `postulado`. Nueva página `/reclutamiento/comite` (con item en el sidebar) que muestra las evaluaciones por entrevistador, captura `notas_comite`, registra la decisión de la DG (`final_dg`/descarte reutilizando `transicionarCandidato`) y ejecuta `contratarCandidato` (encadena el DAG hasta `contratado`, actualiza `fecha_ingreso`, envía `bienvenida_contratacion` con CC configurable y los 2 adjuntos fijos, bitácora en `rec_correos_enviados`). `enviarCorreo` ahora soporta header `Cc`. `tsc` limpio para los archivos de S6 (persiste el ruido baseline de `cartera_*` ajeno a rec). **Paso operativo pendiente (manual, requiere sesión autenticada — no hay service-role key en env):** subir por el dashboard de Supabase `FORMATO LAYOUT DATOS.xlsx` → `plantillas/layout-datos-personales.xlsx` y `Lineamientos para fotografias.pdf` → `plantillas/lineamientos-fotografias.pdf` en el bucket `reclutamiento`. Sin ellos, la contratación funciona pero el correo sale sin adjuntos (best-effort). Smoke test end-to-end pendiente de ejecutar solo con datos de prueba y correos propios.

---

*Fin del plan.*
