# Sesiones — mea-tickets

> Detalle por sesión (append-only, orden cronológico: viejo arriba → reciente abajo).
> El resumen agregado vive en el vault: `70_Trabajo/proyectos/mea-tickets_INDEX.md`.
> Archivos vivos del repo: `PLAN.md` y `RESEARCH-CONSOLIDADO.md` (no se tocan desde este sistema).
> Backfill inicial inferido de git (`git log` + `git show`) + contexto de PLAN.md §7.

---

## 2026-04-21 — Sesión [18:00-19:26]
- **Commits:** 10 (`a5dc63b`, `6debceb`, `b8c56cc`, `4b0e513`, `e89872f`, `0705bca`, `31f5292`, `32ec189`, `393c68d`, `f1b2453`)
- **Duración:** ~1.5 h
- **Hecho:** Fase 0 — base del módulo Tickets. Schema inicial (tablas, enums, relaciones), RLS + `is_admin`, triggers (paridad, auto-profile, cierre), vista `tickets_with_status` + `next_response_order`, seed (3 áreas, 4 tipos de problema), auth con magic link + callback, sidebar/header/user menu, dashboard protegido con guard de admin.
- **Avance vs PLAN.md:** §7 "2026-04-21 — Base: tickets, RLS, vistas, triggers".
- **Pendiente próxima sesión:** OAuth Google, layout responsive.
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** Arquitectura base de tickets sobre Supabase (Postgres + RLS + triggers).

## 2026-04-22 — Sesión [08:42-09:05]
- **Commits:** 4 (`5bc3c41`, `6b0c55b`, `7f649c1`, `332e688`)
- **Duración:** ~0.5 h
- **Hecho:** Login con Google OAuth + restricción de dominio corporativo. Sidebar/header responsivos con drawer móvil. Fix de validación manual de selects en formulario de nuevo ticket. Fix de márgenes desktop, build limpio y tipos de vista Supabase.
- **Avance vs PLAN.md:** Refuerzo de auth y layout sobre la base de Fase 0 (no es un ítem numerado de PLAN).
- **Pendiente próxima sesión:** Pulido UX (skeletons, toasts).
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** Restricción de acceso por dominio corporativo en OAuth.

## 2026-04-23 — Sesión [07:43-20:53]
- **Commits:** 11 (`017c70e`, `4cc8b1b`, `5327702`, `59eb259`, `847c702`, `86dadb1`, `88a761f`, `8b84a0c`, `d0693e5`, `d7c18b2`, `de7a1f4`)
- **Duración:** ~estimada 4-5 h (jornada con varios bloques a lo largo del día)
- **Hecho:** Pulido UX (loading skeletons en dashboard/listas/detalle, toasts con sonner en todas las acciones, 404 personalizado, metadata themeColor, transición drawer). Rebrand a "Operaciones" con secciones Mesa de tickets / Score Crediticio. Perf: queries paralelas en dashboard, uploads paralelos. Fixes: nombre real desde email, evidencia obligatoria, orden del composer, Suspense en login. Dashboard admin con contadores reales y páginas de administración. **Arranque del módulo Score**: schema SQL para acreditados, tipos TS, toggle de acceso por usuario, algoritmo de score en TS + Zod + Server Actions.
- **Avance vs PLAN.md:** Trabajo previo al módulo Score completo (§7 "2026-04-24"); pulido transversal de la plataforma.
- **Pendiente próxima sesión:** UI completa de Score (formularios, páginas).
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** Decisión de rebrand "Operaciones". Algoritmo de score en TypeScript + Server Actions.

## 2026-04-25 — Sesión [17:27-??]
- **Commits:** 1 (`5be2420`)
- **Duración:** ~estimada 1 h (inferencia débil — commit único, sin ventana clara)
- **Hecho:** UI completa de Score — formulario, páginas, skeletons + fix de tipos Supabase.
- **Avance vs PLAN.md:** §7 "2026-04-24 — Módulo Score Crediticio completo" (cierra la UI del módulo).
- **Pendiente próxima sesión:** Ajustes de layout/padding de Score.
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** —

## 2026-05-04 — Sesión [16:50-??]
- **Commits:** 1 (`4685ea1`)
- **Duración:** ~estimada 0.5 h (inferencia débil — commit único de fix menor)
- **Hecho:** Fix de padding en layout de Score (paridad con páginas de tickets).
- **Avance vs PLAN.md:** Ajuste menor, sin ítem en PLAN.
- **Pendiente próxima sesión:** Catálogo dinámico, rechazo, onboarding.
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** —

## 2026-05-13 — Sesión [20:54-21:41]
- **Commits:** 5 (`6f13761`, `6b3b498`, `361ab7b`, `f30d934`, `b4c1a0d`)
- **Duración:** ~1 h
- **Hecho:** Catálogo dinámico, rechazo de solicitudes y onboarding inicial. Forzar selector de cuenta Google tras logout explícito. Fixes de overflow en catálogo (ampliar columnas Area/acciones, `minmax(0,1fr)` + `min-w-0`, `max-w-5xl`).
- **Avance vs PLAN.md:** §7 "2026-05-14 — Catálogo dinámico, rechazo, onboarding, presets login".
- **Pendiente próxima sesión:** Score listo para producción (RLS operadores, presets, import de clientes).
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** Catálogo de áreas/tipos pasa de seed fijo a gestión dinámica.

## 2026-05-19 — Sesión [12:58-17:53]
- **Commits:** 23 (`8e08647`, `10ccb8b`, `9af0a48`, `76d3e32`, varios `feat/fix(migrations)` y `chore(scripts)`)
- **Duración:** ~estimada 3-4 h
- **Hecho:** Score Crediticio listo para producción. Gestión completa de acreditados con `acceso_score`. RLS: operador Score edita/elimina cualquier acreditado, policy delete en `acreditados`, `login_presets` con RLS. Presets de login + `handle_new_user` para operadores Score. Scripts SQL para importar base de clientes desde Excel + verificación de setup Supabase + recrear vista tickets tras columna `datos`. Guía para aplicar migraciones.
- **Avance vs PLAN.md:** Cierre de robustez del módulo Score (relacionado con §2.3); presets de login.
- **Pendiente próxima sesión:** Scaffolding del módulo Cartera Individual.
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** Patrón de presets de login + `handle_new_user` para roles. Migraciones idempotentes (drop policy/trigger).

## 2026-05-21 — Sesión [19:12-20:04]
- **Commits:** 7 (`816c200`, `b477379`, `67d2435`, `8381812`, `d539169`, `fecc6b2`, `ce01925`)
- **Duración:** ~1 h
- **Hecho:** Scaffolding del módulo Cartera Individual. Tablas + RLS + columna `acceso_cartera`. Tipos `CarteraUpload`/`UploadEstado`. Route handlers (upload, procesar, listado de cargas). Formulario de carga con drag & drop + polling de estado + lista de cargas recientes. Layout guard, placeholder y página admin de accesos. Sección Cartera en sidebar. Doc research consolidado de cartera (Fase 1+2).
- **Avance vs PLAN.md:** §7 "2026-05-20 — Schema cartera + RLS + acceso por perfil".
- **Pendiente próxima sesión:** Integración con microservicio Python + Storage.
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** `cartera_uploads` (ledger) separada de `stg_yunius_cartera_individual` (dato crudo). Polling 3s del estado de carga.

## 2026-05-25 — Sesión [14:12-18:40]
- **Commits:** 7 (`e01a6bc`, `eac65c8`, `40f721b`, `a0f1e01`, `a9d1348`, `0c7511a`, `235a171`)
- **Duración:** ~estimada 2-3 h
- **Hecho:** Integración de Cartera con microservicio Python + Supabase Storage. UI-001/UI-002 en tickets: toast de error en creación y adjuntos iniciales (con/sin `response_id`) visibles en el hilo. Creación de `PLAN.md` (v1.0 + fases) y `RESEARCH-CONSOLIDADO.md` como single source of truth del repo; eliminación de planes/research obsoletos.
- **Avance vs PLAN.md:** §7 "2026-05-25 — UI-001 + UI-002" y "2026-05-24 — Cartera end-to-end funcional". Nacimiento del PLAN/RESEARCH actuales.
- **Pendiente próxima sesión:** Reestructura modular de PLAN/RESEARCH + Fase Cartera-0.
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** Microservicio Python separado para ETL de cartera (pandas/openpyxl pesan para serverless). Documentos consolidados como SSOT.

## 2026-05-27 — Sesión [18:59-19:26]
- **Commits:** 3 (`3082fd7`, `5115cf4`, `f272e65`)
- **Duración:** ~0.5 h
- **Hecho:** Reestructura modular de PLAN (fases Cartera C1-C4 + backlog priorizado) y RESEARCH (deep dive de Cartera). Agrega Fase Cartera-0 (contrato de datos antes del ETL). Introduce IDs `CART-`/`DASH-`.
- **Avance vs PLAN.md:** §7 "2026-05-27 — RESEARCH + PLAN refactorizados a estructura modular".
- **Pendiente próxima sesión:** Ejecutar Cartera-0 (análisis input/output + matriz de mapeo).
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** Hojas mensuales del legacy = segmentación cohort por `Inicio ciclo`, no por fecha de corte.

## 2026-05-28 — Sesión [12:25-20:52]
- **Commits:** 12 (`012aff0`, `6c4b0aa`, `8e8b5db`, `5e40226`, `310b0bb`, `1edbea7`, `845cee6`, `937f89e`, `1568abc`, `d053f07`, `72cebd6`, `13bb37a`)
- **Duración:** ~estimada 4-5 h (con hueco entre la tarde y la noche)
- **Hecho:** Fase Cartera-0 completa — análisis profundo de input (63 cols × 343 filas), output (FINAL TARGET) y matriz de mapeo definitiva (`docs/cartera/`), + `RESEARCH §5.4.9`. Cierre de schema: migración `cart_000d` con 11 cols faltantes + extensión de `loan_amortizacion_individual`. OPS-002a: Supabase CLI + `link` + baseline de 22 migraciones + scripts npm (`db:push/status/new/diff`). C1-7 TYP-001: `database.types.ts` generado (1112 líneas) + `npm run db:types`. Briefs de handoff CART-001 y OPS-001.
- **Avance vs PLAN.md:** §7 entradas "2026-05-28" (C0-1..C0-5, OPS-002a, C1-7 TYP-001, briefs).
- **Pendiente próxima sesión:** Smoke CART-001 + merge PR #1; deploy microservicio (OPS-001).
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** §5.4.9 deep dive cartera. Bug documentado: ETL insertaba 3 cols inexistentes. Migraciones vía Supabase CLI (fin del copy-paste al SQL editor).

## 2026-05-30 — Sesión [19:56-22:11]
- **Commits:** 7 (`4408266`, `9517025`, `69bedd9`, `40c8b12`, `df681a4`, `cb7fb5f`, `02bc4ab`)
- **Duración:** ~2 h
- **Hecho:** C1-1 CART-001 (refactor ETL) PR #1 mergeado + C1-5 OPS-001 microservicio LIVE en Render (registrado en PLAN). C2-1 CART-010: RPC `cartera_resumen(fecha_corte)` (totales + PAR 8 buckets + indicadores; métrica `saldo_total`, security definer). C3-1 DASH-001: `/cartera` snapshot ejecutivo (6 métricas + distribución PAR + filtros URL-state). Filtros opcionales + RPC `cartera_filtros`.
- **Avance vs PLAN.md:** §7 entradas "2026-05-30" (C1-1, C1-5, C2-1, C3-1).
- **Pendiente próxima sesión:** Dashboards por coordinación/recuperador/mora/cohort + sus RPCs.
- **Bloqueos:** Cron-job.org wake-up del microservicio pendiente (cold start Render Free).
- **Notas para RESEARCH-CONSOLIDADO.md:** Métrica PAR = `saldo_total` (estándar industria; `saldo_riesgo_total` inflaba %). Validado con 215 filas: PAR>30 34.52%, PAR>90 15.95%.

## 2026-06-02 — Sesión [08:18-12:38]
- **Commits:** 12 (`888e316`, `bbf9159`, `9d1ca3c`, `b5e18ce`, `d810c31`, `46a0abd`, `0b64209`, `622b2fc`, `eff28a9`, `31caf4a`, `2a9739b`, `2bbaeda`)
- **Duración:** ~estimada 3 h
- **Hecho:** Cuatro dashboards de cartera con sus RPCs. C2-2/C3-2 CART-011/DASH-002: `cartera_por_coordinacion` + `/cartera/coordinacion`. C2-3/C3-3 CART-012/DASH-003: `cartera_por_recuperador` + `/cartera/recuperador`. C2-4/C3-4 CART-013/DASH-004: `cartera_mora_operativa` + `/cartera/mora` (120 morosos, columnas de gestión MOCKEADAS). C2-5/C3-5 CART-014/DASH-005: `cartera_cohort` (frontera configurable) + `/cartera/cohort`.
- **Avance vs PLAN.md:** §7 entradas "2026-06-02" (C2-2..C2-5 + DASH-002..005). Cartera-2 y Cartera-3 prácticamente cerradas.
- **Pendiente próxima sesión:** C2-6 CART-015 (endpoints GET de RPCs); tabla `cartera_seguimiento` + persistencia real de gestión de mora; cron wake-up Render.
- **Bloqueos:** Muestra actual sin ciclos 2026 (rango 2023-08 a 2025-11) → frontera de cohorte se hizo configurable. Profiles sin `codigo_recuperador` → "Mi cartera" diferido.
- **Notas para RESEARCH-CONSOLIDADO.md:** Paridad con hojas mensuales del legacy vía cohorte por `fecha_inicio_ciclo`. Gestión de mora persistente es la feature que supera al Excel (histórico entre cortes).

## 2026-06-04 — Sesión [15:08-15:37]
- **Commits:** 3 (`a9f7208`, `ece883d`, `d70faeb`)
- **Duración:** ~estimada 1.5-2 h (incluye diagnóstico iterativo de GUI)
- **Hecho:** Asistente IA demo `/cartera/chat` (PRO-004): knowledge base embebida (13 chunks empresa+plataforma) + retrieval por keywords + UI (empty-state, sugerencias, citas), sin LLM aún. Fix de 2 bugs que rompían el endpoint (`ReferenceError` question→query + redefinición de `sources`). Refactor del sidebar: borra 2 links muertos (`/cartera/cobranza` y `/cartera/riesgo`, sin página → 404), íconos lucide, auto-apertura de sección activa, rename Cartera>Dashboard → "Resumen", agrupación Análisis/Operación. Pulido de chat (fuera header duplicado, empty-state en tarjetas, pills unificadas, tokens) y sidebar (punto indicador de sección activa colapsada, focus-visible, migración hex→tokens).
- **Avance vs PLAN.md:** C4-6 PRO-004 (Chat IA cartera) — primera entrega (estaba en "no v1.0" / Fase Cartera-4). Mejora transversal de Plataforma-UX.
- **Pendiente próxima sesión:** Cablear LLM real + tools (fase agente); crear o descartar páginas Cobranza/Riesgo; breadcrumbs en cartera; consistencia de empty-states/skeletons; rail colapsable del sidebar.
- **Bloqueos:** —
- **Notas para RESEARCH-CONSOLIDADO.md:** El asistente arranca como demo determinística (KB embebida, sin API key) por diseño; evolución a LLM + RAG + tools documentada en `docs/ideas-agente-ia-asistente.md`. El setup del sistema de tracking de sesiones (commit `801cf32`) se hizo al cierre del 2026-06-02.
