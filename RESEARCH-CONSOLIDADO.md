# RESEARCH CONSOLIDADO — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Single source of truth del estado real del repo.
> Última actualización: 2026-08-11.
> Para el plan de trabajo activo ver `PLAN.md`.

---

> **Foco activo (2026-08-11): Mesa de Tickets.** Reclutamiento, Cartera, Score y Factorial están **en pausa** — desplegados y operables, sin desarrollo nuevo. Este documento sigue describiendo los cinco módulos porque el contexto no caduca; la cola de trabajo vigente vive en `PLAN.md §0`.

## 1. Resumen Ejecutivo

**mea-tickets** es la plataforma interna de Financiera CrediFlexi (Next.js 14 App Router + Supabase). Hoy convive con un **ecosistema** que comprende:

- **Legacy intocable** (`automatizador-crediflexi`, Flask local) — sistema en operación que genera el Reporte de Antigüedad Individual en Excel y lo distribuye por correo. **No es objeto de cambio**; queda como referente funcional y de negocio.
- **Plataforma** (`mea-tickets`, este repo) — Next.js + Supabase. Conviven **5 módulos**: Tickets, Score, Onboarding/Auth, Cartera y **Reclutamiento** (el más grande y el único con integraciones externas de escritura: Google Workspace y Factorial HR).
- **Microservicio** (`crediflexi-services`, FastAPI) — separado del repo principal, encargado del ETL de cartera; reemplaza progresivamente al legacy desde el flujo de datos.

**Estado por módulo** (detalle en §5):

1. **Mesa de Tickets** — producción, y desde el **2026-08-10 es una herramienta de equipo**: el ticket vive en la cola de su área hasta que alguien lo toma, avanza por estados explícitos, se puede soltar o pasar, deja bitácora y **avisa por correo**. Con eso caen los tres gaps estructurales más viejos (TKT-001 paridad, TKT-002 reasignación, TKT-003 notificaciones). Queda abierto: verificar un envío real de correo, la cola global de admin (TKT-007), notas internas (TKT-008) y la seguridad de escritura. Arquitectura en §5.1.7, benchmark en §5.1.3.
2. **Score Crediticio** — producción, modelo HM replicado.
3. **Onboarding + presets** — producción.
4. **Cartera Individual** — completo de punta a punta: ETL (upload → microservicio en Render → staging), capa de consulta (5 RPCs) y 5 dashboards, más el asistente Gemini con tools. Pendiente: `loan_amortizacion_individual` sigue vacía (bloquea drill-down y liquidación anticipada) y faltan los endpoints GET (CART-015).
5. **Reclutamiento** — el pipeline `postulado → contratado` opera completo desde el kanban, con Meets y correos reales vía Google Workspace, evaluaciones por magic link y alta automática en Factorial HR. **Su deuda no es de código, es de validación**: el smoke test end-to-end nunca se corrió con correos de prueba y el alta en Factorial sigue apagada por interruptor.

**Riesgos principales**:
- **`FACTORIAL_API_KEY` es god-mode**: la API Key de Factorial no se puede acotar por scope, así que da acceso total a los datos de RH de la empresa. Solo server-side, nunca en cliente (§13.9).
- **Destinatarios reales seedeados**: `bienvenida_contratacion` tiene 3 empleados de CrediFlexi en CC. Cualquier prueba de contratación les manda correo si no se reapunta antes desde `/reclutamiento/ajustes`.
- Seguridad RLS: `attachments_insert` no valida participación; `profiles_select using (true)` expone PII.
- Mutaciones de tickets desde el cliente — seguridad 100% en RLS. Las acciones nuevas (tomar, cambiar estado, reasignar, notificar) **sí** son Server Actions sobre RPCs `security definer`; crear ticket y responder siguen saliendo del navegador.
- **La cola de un área la ve todo el que tenga esa `area_id`** — correcto para una cola, pero obliga a mantener `/admin/usuarios` limpio.
- Correos de tickets **entregados pero nunca verificados** con un envío real.
- `database.types.ts` congelado en la migración 23 de 64 (no truena porque el código usa `types.ts` manual, pero el archivo generado miente).
- Sin tests, sin CI, sin `error.tsx` global.

**Recomendación inmediata**: la plataforma ya no tiene un solo eje, y a esta altura **el patrón dominante del repo es el mismo en los tres módulos: la deuda ya no es de código, es de verificación.** Cartera alcanzó paridad con el legacy; Reclutamiento opera end-to-end pero su smoke test nunca se corrió y el alta en Factorial sigue apagada; Tickets ganó cola, estados, bitácora y notificaciones el 2026-08-10, pero **ningún correo se ha visto llegar**. El trabajo de mayor valor es cerrar esa brecha antes de construir más. Endurecer RLS sigue siendo transversal y pendiente.

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
| Repo principal | `github.com/uzzielvz/mesa-tickets` (privado) |

### Ecosistema (tres repos en juego)

| Repo | Rol | Estado | Deploy |
|------|-----|--------|--------|
| `mea-tickets` (este) | Plataforma Next.js + Supabase | Activo | Vercel |
| `crediflexi-services` | Microservicio FastAPI (ETL cartera) | Activo, mínimo | Sin deploy (solo localhost) |
| `automatizador-crediflexi` (legacy) | Flask local, genera Excel actual | Producción operativa | Local en máquina de operador |

### Stack (plataforma)

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
  stand-by/page.tsx      ← usuarios sin accesos
  (dashboard)/
    layout.tsx           ← guard sesión + redirect stand-by si sin accesos
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
  admin/, brand/, cartera/, layout/, score/, stand-by/, tickets/, ui/
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
| `app/(dashboard)/layout.tsx` | Sidebar, redirect a `/stand-by` si sin accesos, contadores de tickets |
| `app/(dashboard)/admin/layout.tsx` | Bloquea `/admin/*` si rol ≠ admin |
| `lib/actions/acreditados.ts` | CRUD acreditados + evaluación promotor |
| `lib/scoring/modelo.ts` | Algoritmo de score HM (réplica GAS) |
| `components/tickets/ticket-form.tsx` | Crear ticket (cliente Supabase) |
| `components/cartera/upload-form.tsx` | Drag-drop, upload a Storage, polling de estado |
| `app/api/cartera/procesar/route.ts` | Bridge a microservicio Python |
| `lib/tickets/sla.ts` | Cálculo del SLA de un ticket (puro, sin React ni Supabase) |
| `lib/reclutamiento/etapas.ts` | Motor de etapas: qué exige cada paso del pipeline, qué lo bloquea y qué acción dispara (puro) |
| `lib/reclutamiento/ajustes.ts` | Lectura de `rec_ajustes` (DG, destinatarios, interruptor de Factorial). Recibe el cliente Supabase por parámetro |
| `lib/reclutamiento/plantillas.ts` | Catálogo de plantillas de correo: cuándo se envía cada una, variables y requeridos (puro) |
| `lib/actions/comite.ts` | Contratación: correos de bienvenida y de altas + alta en Factorial (best-effort) |
| `lib/google/*` | OAuth propio vía REST + Calendar (Meet) + Gmail; `refresh_token` cifrado AES-256-GCM |
| `lib/factorial/client.ts` | Alta de empleado en Factorial HR vía SDK oficial (API Key `x-api-key`) |
| `supabase/migrations/*.sql` | **64** migraciones: schema, RLS, triggers, vistas, scoring, cartera, tickets y `rec_*` — inventario completo en §11 |

### Server Actions vs Client Mutations

> **Cambió con Reclutamiento.** El módulo se construyó entero sobre Server Actions con `safeParse` de Zod y el patrón `Result`, así que la afirmación original ("solo `acreditados.ts`") dejó de ser cierta hace tiempo. Tickets es hoy la **excepción**, no la regla — de ahí que SEC-001 siga abierto.

- **Server Actions**: `lib/actions/acreditados.ts`, **`reclutamiento.ts`**, **`agendamiento.ts`**, **`comite.ts`**, **`ajustes.ts`**, **`evaluaciones.ts`**.
- **Cliente Supabase directo**: tickets (`ticket-form.tsx`, `response-composer.tsx`), admin (`catalogo-admin.tsx`, `usuarios-admin.tsx`, `areas-admin.tsx`, `cartera-accesos.tsx`).
- **Route Handlers**: `auth/callback`, `api/cartera/{upload,procesar,uploads}`, `api/google/{conectar,callback}`.
- **RPCs security definer** como única superficie pública (sin login): `rec_sesion_por_token`, `rec_submit_evaluacion`.

### Documentación del repo

| Archivo | Estado |
|---------|--------|
| `context.md` | Spec original MVP + design system tokens. **Conservar** (referencia de diseño). |
| `RESEARCH-CONSOLIDADO.md` (este) | Single source of truth. |
| `PLAN.md` | Plan vivo. |
| `supabase/migrations/GUIA-SQL-SUPABASE.md` | Guía operativa para correr SQL manual. **Conservar**. |
| Propuesta comercial (`.tex`, `.pptx`) | Material externo. **Conservar fuera del flujo dev**. |

---

## 3. Mapa de Arquitectura

### Módulos y estado

| Módulo | Estado | Tecnología |
|--------|--------|------------|
| Auth corporativa | Completo | Supabase + middleware + filtro dominio |
| Stand-by corporativo | Completo | Usuarios sin accesos → `/stand-by`; admin asigna área/accesos |
| Login presets (operadores Score) | Completo | `login_presets` + trigger `handle_new_user` |
| Mesa de tickets (crear/responder/rechazar/cerrar) | Completo | Cliente Supabase + RLS + triggers |
| Tickets — prioridad, SLA visible, filtros y búsqueda | Completo | `problem_catalog` (mig. 54) + `lib/tickets/sla.ts` |
| Tickets — cola por área, estados, reasignación | Completo | `area_id` + RPCs `tkt_*`; RLS por pertenencia al área |
| Tickets — bitácora y notificaciones | Completo (correos sin verificar) | `ticket_historial` por trigger + 9 avisos vía Gmail |
| Campos dinámicos por catálogo | Completo | `problem_catalog.campos` jsonb + `tickets.datos` jsonb |
| Rechazo responsable | Completo | enum `rechazo_responsable` + triggers + vista |
| Score Crediticio (CRUD + modelo) | Completo | Server Actions + RPC `guardar_evaluacion_promotor` |
| Admin tickets/areas/usuarios | Completo | Cliente Supabase + RLS admin |
| Métricas admin (tickets + score) | Parcial | Falta filtrar `rechazado`, sin gráficas |
| Cartera — carga Excel + ETL parcial | Completo end-to-end (con gaps de columnas) | Next.js → Storage → microservicio Python → `stg_yunius_cartera_individual` |
| Cartera — capa de consulta | Completo | RPCs `cartera_resumen` / `por_coordinacion` / `por_recuperador` / `mora_operativa` / `cohort`. Falta CART-015 (endpoints GET) |
| Cartera — dashboards | Completo | `/cartera`, `/coordinacion`, `/recuperador`, `/mora`, `/cohort` sobre los RPCs |
| Cartera — Chat IA / Asistente | Completo (IA-A) | Agente Gemini `gemini-2.5-flash` + 6 tools sobre los RPCs, widget flotante (ver §5.5) |
| Reclutamiento — pipeline `postulado → contratado` | Completo | RPC `rec_transicion_etapa` + motor de etapas + kanban dinámico (S1-S7.5) |
| Reclutamiento — Google Workspace (Meet + Gmail) | Completo | OAuth propio vía REST, `refresh_token` cifrado AES-256-GCM (Sprint G) |
| Reclutamiento — ajustes y plantillas editables | Completo | `rec_ajustes` + `/reclutamiento/ajustes`; cero correos quemados (S7.5 + S9.5) |
| Reclutamiento — alta en Factorial HR | Completo, sin validar | SDK oficial + API Key; **interruptor apagado por defecto** (S9, §13.9) |
| Reclutamiento — onboarding del candidato | Pendiente | S10 — captura de datos de contratación vía magic link |
| Notificaciones email (tickets) | Pendiente | Reclutamiento sí manda correos; tickets no notifica nada |
| Tests automatizados | Pendiente | — |
| CI/CD | Pendiente | Solo deploy automático de Vercel desde main |

### Flujo del ecosistema cartera (alto nivel)

```
                  LEGACY (no se toca)
┌─────────────────────────────────────────────────┐
│ automatizador-crediflexi (Flask, local)         │
│   Excel Yunius → procesa → Excel reformateado   │
│   (12 hojas) → correo manual a operadores       │
│                                                 │
│   Output ref: ReportedeAntiguedad_nuevo_*.xlsx  │
└─────────────────────────────────────────────────┘
                  Sigue funcionando en paralelo

                  PLATAFORMA (en construcción)
┌─────────────────────────────────────────────────┐
│ mea-tickets (Next.js)                           │
│   /cartera/cargar                               │
│   → POST /api/cartera/upload                    │
│     → Supabase Storage (bucket 'cartera')       │
│     → insert cartera_uploads (pendiente)        │
│   → click Procesar                              │
│   → POST /api/cartera/procesar                  │
│     → fetch a PYTHON_SERVICE_URL                │
│                                                 │
│ crediflexi-services (FastAPI, local)            │
│   POST /cartera/procesar                        │
│     → descarga Excel de Storage                 │
│     → ETL pandas (replica lógica legacy)        │
│     → bulk insert en stg_yunius_cartera_indiv.  │
│     → update cartera_uploads.estado=procesado   │
│                                                 │
│ Supabase                                        │
│   cartera_uploads (ledger)                      │
│   stg_yunius_cartera_individual (datos)         │
│   loan_amortizacion_individual (vacía hoy)      │
│                                                 │
│ /cartera/* dashboards                           │
│   ❌ NO EXISTEN                                 │
└─────────────────────────────────────────────────┘
```

### Flujos de usuario

```
[Anónimo]
  → /login (Google | magic link @financieracrediflexi.com)
  → /auth/callback (valida dominio + allowlist extras)
  → si sin accesos → /stand-by (admin asigna área/accesos)
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
  → /cartera/cargar (UI activa)
  → upload + polling
  → ❌ Sin vistas de consumo aún

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
| Listar/crear tickets | Completo | UI-001 (toast error) corregido 2026-05-25 |
| Hilo de respuestas | Completo | UI-002 (adjuntos iniciales) corregido 2026-05-25 |
| Adjuntos en tickets | Completo | Suben a Storage; nuevos asocian `response_id` |
| Rechazo con motivo (≥10 chars) | Completo | enum + trigger + estado `rechazado` en vista |
| Catálogo dinámico (jsonb) | Completo | Mini-builder en admin + render dinámico en form |
| Score: captura + cálculo | Completo | `modelo.ts` réplica del modelo HM |
| Score: evaluación promotor (A/B/C/D) | Completo | RPC con validaciones |
| Score: editar/eliminar | Completo | Historial de cambios automático |
| Admin: usuarios/áreas/catálogo/cartera-accesos | Completo | Toggle por usuario |
| Métricas admin tickets | Parcial | Sin estado `rechazado` aparte; filtro por nombre de área |
| Métricas admin score | Completo | A/B/C/D, promedio, pendientes |
| Cartera: upload + Storage + ETL parcial | Parcial | Funciona end-to-end pero mapea solo 20 de ~55 cols |
| Cartera: dashboards | Completo | `/cartera` (resumen), `/cartera/coordinacion`, `/cartera/recuperador`, `/cartera/mora`, `/cartera/cohort` — sobre RPCs `cartera_*`. Placeholders `cobranza`/`riesgo` retirados. |
| Cartera: Asistente IA | Completo (IA-A) | Agente real Gemini `gemini-2.5-flash` + 6 tools sobre RPCs (mora seudonimizada), modo mock (`AI_ASSISTANT_MOCK`), logging tokens/costo. **Widget flotante** (FAB + panel con pantalla completa) en todas las páginas de cartera; `/cartera/chat` → redirect. (AI-001..004, PLAN §2.5) |
| Tickets: prioridad / SLA / modalidad | Completo | Metadata en `problem_catalog` (mig. 54) visible al levantar **y** en seguimiento: chip de prioridad, columna "Atención" coloreada, filtros y buscador. Cálculo en `lib/tickets/sla.ts`. **Sin alertas ni escalación** (TKT-005) |
| Tickets: cola por área + tomar/reasignar | Completo | `tickets.area_id`, `responsable_id` nullable, RPCs `tkt_tomar_ticket` / `tkt_reasignar_ticket`, pantalla `/tickets/area` |
| Tickets: estados explícitos | Completo | Enum `ticket_estado`; se acabó la paridad de respuestas y con ella TKT-001 |
| Tickets: bitácora de cambios | Completo | `ticket_historial` por trigger — base de las métricas de tiempo real |
| Tickets: notificaciones por correo | Completo (sin verificar) | 9 avisos vía Gmail (`lib/google`), best-effort. **Falta ver llegar un correo real** |
| Reclutamiento: vacantes + candidatos | Completo | CRUD, CV a Storage, fuente, revisión de CV con motivo (S1-S2) |
| Reclutamiento: pipeline (DAG) | Completo | RPC `rec_transicion_etapa` + historial; kanban dinámico donde cada tarjeta exige los datos de su etapa (S3 + S7.5) |
| Reclutamiento: Google Workspace | Completo | OAuth propio (REST, sin SDK), `refresh_token` cifrado AES-256-GCM, Calendar (Meet) + Gmail (Sprint G) |
| Reclutamiento: agendamiento en cascada | Completo | N entrevistadores × 20 min, eventos + correos + transición automática (S4 + S6) |
| Reclutamiento: evaluaciones por magic link | Completo | Token propio por email (no Auth), ruta pública `/evaluar/[token]`, RPCs security definer (S5) |
| Reclutamiento: comité → contratación | Completo | Notas de comité, decisión de la DG con Meet, config de alta, correo interno de altas (S6-S7) |
| Reclutamiento: ajustes editables | Completo | DG, 7 destinatarios de altas, CC y **cuerpo de las plantillas** desde `/reclutamiento/ajustes`. Cero correos quemados en el código (S7.5 + S9.5) |
| Reclutamiento: bitácora de correos | Completo | `/reclutamiento/correos` — últimos 200 envíos con filtro y mensaje de error (S9.5) |
| Reclutamiento: alta en Factorial HR | Completo (sin validar) | `createWithContract` best-effort al contratar, idempotente por `factorial_employee_id`. **Interruptor apagado por defecto**; falta la prueba contra producción (S9) |
| Reclutamiento: onboarding del candidato | Pendiente | S10 — captura de datos de contratación vía magic link |
| Métricas de SLA / tiempo por técnico | Pendiente | Ya hay con qué (`ticket_historial` desde 2026-08-10); falta la vista |
| `error.tsx` global | Pendiente | 0 archivos en el proyecto |
| Tests | Pendiente | No hay framework instalado |

---

## 5. Módulos — Deep Dive

> Para cada módulo: alcance, estado, archivos clave, riesgos.

### 5.1 Mesa de Tickets

**Alcance**: gestión de incidencias internas. Levantador crea, responsable atiende, hilo de mensajes, cierre con confirmación, rechazo con motivo.

**Estado**: producción. UX bugs críticos cerrados 2026-05-25. **2026-07-28**: catálogo Sistemas/TI con prioridad/SLA/modalidad. **2026-08-01**: esa metadata se vuelve operable (listados con filtros, buscador y SLA visible) y se arregla que los adjuntos del hilo no se pudieran abrir. **2026-08-10 — el módulo pasa de individual a de equipo**: cola por área con self-assign, estados explícitos (muere la paridad), reasignación, bitácora por trigger, notificaciones por correo, guía contextual y un `/tickets/nuevo` donde el usuario **ya no elige área**.

**Archivos clave**: `app/(dashboard)/tickets/*`, `components/tickets/*`, **`lib/tickets/{sla,guia,correos}.ts`** (los tres puros y reutilizables), `lib/actions/tickets.ts`, migraciones 01-04, 07-09, 12, 54-55, **65-69**.

**Pendientes**: verificar un envío real de correo, métricas sobre la bitácora, SEC-001 (Server Actions), RLS-001/002/004/005, UI-003/004, TKT-007 (cola global de admin), TKT-008 (notas internas), paginación de listados.

**Plan de evolución (go-live producción)**: las limitaciones de §5.1.1–5.1.4 (responsable fijo, paridad forzada, estado derivado) se resuelven en la fase **Tickets-Producción** del `PLAN.md` (T-P1 cola por área, T-P2 estados explícitos, T-P3 seed de los 3 tipos, T-P4 seguridad full). Este §5.1 describe el **estado real actual**; el plan de cambio vive en `PLAN.md §2.2`.

#### 5.1.1 Cómo funciona hoy (modelo de datos + máquina de estados)

**Modelo de datos** (mig. 01 + 09):

```
areas ──< problem_catalog (campos jsonb dinámicos, responsable_default_id)
                 │
tickets (numero bigserial, levantado_por_id, responsable_id FIJO, datos jsonb)
   ├──< ticket_responses (orden int, autor_id, tipo enum, contenido)
   └──< ticket_attachments (response_id, storage_path)
```

- **Roles**: `admin` / `responsable` / `usuario`. Un ticket tiene **un solo responsable fijo**, asignado al crear (`responsable_default_id` del catálogo, o el propio creador si el catálogo no define default — `ticket-form.tsx:124`).
- **Campos dinámicos**: cada tipo de problema (`problem_catalog`) define un array `campos` jsonb (`key/label/type/required/options`); las respuestas viven en `tickets.datos`. Hay compat legacy con columnas `grupo/cliente/ciclo_cliente`.
- **Conversación = paridad estricta** (`validate_response_order`, mig. 04 + 08): orden impar → debe ser el levantador, orden par → debe ser el responsable. El `rechazo_responsable` es la única excepción (cualquier orden, solo responsable).
- **Estatus derivado** de la última respuesta (vista `tickets_with_status`): `abierto` → `contestado` → `terminado` → `cerrado`, más `rechazado`. No es un campo editable; se infiere del tipo/paridad del último mensaje y de `closed_at`.
- **Cierre en dos pasos**: el responsable marca `terminado_responsable`; el levantador confirma (`terminado_usuario` → `closed_at`) o reabre con un mensaje. El rechazo cierra directo.
- **Seguridad**: 100% en RLS (mig. 02). Las mutaciones se hacen con el **cliente Supabase desde el navegador** (`ticket-form.tsx`, `response-composer.tsx`), no por Server Actions.
- **Vistas de usuario**: `mios` (levantados por mí), `asignados` (responsable = yo), `[numero]` (detalle/hilo). Sidebar con contadores de no-cerrados.

#### 5.1.2 Limitaciones y bugs propios del módulo

> Todo lo de abajo se verificó leyendo el código fuente, no es especulación. IDs `TKT-` = familia nueva de funcionalidad de tickets.

| ID | Sev. | Hallazgo | Evidencia |
|----|------|----------|-----------|
| ~~**TKT-001**~~ | ~~Alta~~ | ✅ **Resuelto 2026-08-10** al quitar la paridad de `validate_response_order` (mig. `20260810120100`). Ambos lados pueden escribir las veces que haga falta. *Texto original:* **La paridad estricta rompe conversaciones reales.** El responsable **no puede enviar dos mensajes seguidos** (ni el usuario): tras una respuesta par, el siguiente orden es impar y el trigger exige que sea el levantador. Un follow-up del agente antes de que conteste el usuario es rechazado con excepción SQL. | `validate_response_order` mig. 04:23-33 / 08:36-44 |
| ~~**TKT-002**~~ | ~~Alta~~ | ✅ **Resuelto 2026-08-10.** RPC `tkt_reasignar_ticket`: "Devolver a la cola" y "Pasar a…" (solo gente del área). Devolver un `en_revision` lo regresa a `abierto`; **`programado` se conserva** — la validación del trabajo no se pierde por cambiar de manos. | mig. `20260810140000` · `control-estado.tsx` |
| ~~**TKT-003**~~ | ~~Alta~~ | ✅ **Resuelto 2026-08-10** (sin Resend: se reusó Gmail vía `lib/google`, ya probado por Reclutamiento). 9 avisos por correo, todos best-effort. **Pendiente: nunca se ha verificado un envío real.** | mig. `20260810150100` · `lib/tickets/correos.ts` |
| ~~**TKT-004**~~ | ~~Media~~ | ✅ **Resuelto 2026-07-28 / 2026-08-01.** La prioridad es fija **por tipo de problema** (`problem_catalog.prioridad`), no por ticket: quien levanta no la elige, así que nadie puede marcar todo como urgente. Visible al levantar y como chip en listados y detalle. | mig. `20260728130000` · `lib/tickets/sla.ts` |
| **TKT-005** | **Media** | **Parcial.** El SLA existe como `problem_catalog.sla_min` y se **muestra** (columna "Atención", coloreada por estado, con filtro "Vencidos"). Lo que sigue faltando es lo activo: **no avisa a nadie**, no escala y no hay métrica histórica de cumplimiento. | `lib/tickets/sla.ts` · sin notificaciones |
| ~~**TKT-006**~~ | ~~Media~~ | ✅ **Resuelto 2026-08-01.** `ticket-list.tsx` (ahora client component) tiene filtros `Activos/Vencidos/Cerrados/Todos` con conteo y buscador sobre número, asunto, área y personas. Falta paginación — hoy se renderiza todo. | `components/tickets/ticket-list.tsx` |
| **TKT-007** | **Media** | **Sin cola global de administración.** El admin puede leer todos los tickets vía RLS, pero no hay página `/admin/tickets` para verlos/gestionarlos; solo métricas parciales. | `app/(dashboard)/admin/*` sin vista de tickets |
| **TKT-008** | **Media** | **Sin notas internas.** Todo mensaje es visible para el solicitante; no hay comentario privado entre agentes/admin. | `ticket_responses.tipo` sin tipo "interno" |
| **TKT-009** | Baja | **Auto-asignación degenerada.** Si el catálogo no tiene `responsable_default_id`, el ticket se asigna al propio creador (levantador = responsable). El modelo de paridad colapsa (misma persona en orden par e impar) y la "solicitud" no llega a nadie. | `ticket-form.tsx:124` |
| **TKT-010** | Baja | **Sin paginación.** Las listas crecen sin límite (también UI-005 en acreditados). A escala org-wide degrada. | `mios/asignados` sin `range()` |
| **TKT-011** | Baja | **Sin reapertura de tickets ya `cerrado`.** Desde `terminado` se puede reabrir, pero un ticket con `closed_at` no tiene camino de reapertura en UI. | `[numero]/page.tsx:136` |
| **RLS-004** | Media | **Respuestas en ticket cerrado no bloqueadas en DB.** El trigger no valida `closed_at`; solo la UI oculta el composer. Vía API se podría insertar en un ticket cerrado. | (ya en §6) |
| **RLS-001/002** | Alta/Media | Adjuntos sin validar participación; `profiles_select using(true)` expone PII. | (ya en §6) |
| **SEC-001** | Alta | Mutaciones desde el cliente; toda la barrera es RLS. | (ya en §6) |

#### 5.1.3 Benchmark vs herramientas del mercado

> **Vara de medir** *(supuesto a confirmar — el usuario quedó indeciso)*: **mesa de ayuda interna para empleados** (referencia: Jira Service Management, Zammad, osTicket, Freshservice en modo interno). **Se excluye a propósito** lo cliente-facing que no aplica a un tool interno: multicanal (email entrante, chat, redes), portal de clientes, CSAT público. Si más adelante se quiere comparar contra Zendesk/Freshdesk completos, la lista de gaps crece.

| Capacidad estándar (helpdesk interno) | Mercado | mea-tickets | Veredicto |
|---|---|---|---|
| Crear ticket con categoría/formulario | ✅ | ✅ (catálogo + campos dinámicos jsonb) | **Paridad — y bien resuelto** |
| Hilo de conversación + adjuntos | ✅ | ✅ | **Paridad** |
| Asignación a un responsable | ✅ | ✅ (cola por área + self-assign) | **Paridad** |
| Reasignación / transferencia | ✅ | ✅ (devolver a la cola o pasar a alguien del área) | **Paridad** (TKT-002 cerrado) |
| Prioridad / urgencia | ✅ | ✅ (fija por tipo de problema) | **Paridad** (TKT-004 cerrado) |
| **SLA / vencimiento / escalación** | ✅ | Parcial (se ve y filtra; no avisa ni escala) | **Gap (TKT-005)** |
| Notificaciones (email) | ✅ | ✅ (9 avisos vía Gmail, best-effort) | **Paridad** (TKT-003 cerrado, sin verificar envío) |
| Búsqueda y filtros de cola | ✅ | ✅ (filtros + buscador; sin paginación) | **Paridad** (TKT-006 cerrado) |
| **Cola/Bandeja de agente y de admin** | ✅ | Parcial (mios/asignados/**cola del área**, sin global de admin) | **Gap parcial (TKT-007)** |
| **Notas internas (privadas)** | ✅ | ❌ | **Gap (TKT-008)** |
| Estados de ticket | ✅ | ✅ (explícitos, los controla el responsable) | **Paridad** |
| Cierre con confirmación del solicitante | A veces | ✅ (mejor que el promedio) | **Ventaja propia** |
| Rechazo con motivo obligatorio | A veces | ✅ | **Ventaja propia** |
| Campos dinámicos por tipo (sin código) | A veces (planes altos) | ✅ | **Ventaja propia** |
| Historial/auditoría de cambios | ✅ | ✅ (`ticket_historial` por trigger: creado/tomado/devuelto/reasignado/cambio de estado) | **Paridad** (desde 2026-08-10) |
| Respuestas predefinidas / macros | ✅ | ❌ | Opcional interno |
| Reportes / dashboards | ✅ | Parcial (métricas admin) | Opcional interno |
| Base de conocimiento | ✅ | ❌ | Fuera de alcance interno |
| Multicanal / portal cliente | ✅ | ❌ | Fuera de alcance (interno) |

**Lectura**: el módulo tiene una base de captura **superior al promedio** (formularios dinámicos sin código, cierre confirmado, rechazo con motivo). Donde se queda corto frente a cualquier helpdesk es en el **ciclo de vida operativo del ticket**: reasignar, priorizar, ser notificado, encontrar y triar. Eso es justo lo que diferencia "un tablero de mensajes" de "una mesa de ayuda".

#### 5.1.4 Requisitos no negociables (para que sume valor real)

> Calibrado a uso interno reemplazando WhatsApp/correo/Sheets. Clasificación: **Crítico** = sin esto no supera al estado actual; **Importante** = se nota su ausencia rápido en operación; **Opcional** = mejora, no bloquea valor.

**Crítico (no negociable):**
1. **Notificaciones** (TKT-003) — sin avisos, la gente sigue dependiendo de WhatsApp para "avisar que hay ticket". Mata la propuesta de valor.
2. **Reasignación/transferencia** (TKT-002) — los tickets mal ruteados deben poder moverse, o se atascan.
3. **Conversación libre** (TKT-001) — quitar la paridad forzada; permitir mensajes consecutivos de cualquiera de las dos partes.
4. **Seguridad real en escritura** (SEC-001 + RLS-001/002/004) — autorización del lado servidor, no solo RLS con mutaciones desde el navegador. En una financiera, PII y trazabilidad no son opcionales.
5. **Búsqueda/filtro de cola** (TKT-006) — encontrar un ticket por número/cliente/estatus es operación básica diaria.

**Importante:**
6. **Prioridad** (TKT-004) y **SLA/envejecimiento básico** (TKT-005) — al menos marcar urgentes y ver "lleva N días sin respuesta".
7. **Cola global de admin** (TKT-007) — supervisión.
8. **Notas internas** (TKT-008).
9. **Auditoría de cambios** (estado, asignación, prioridad) — relevante en contexto financiero.
10. **Paginación** (TKT-010).

**Opcional (post-valor):**
11. Respuestas predefinidas / plantillas. 12. Reportes/dashboards de tickets. 13. Reapertura de cerrados (TKT-011). 14. Etiquetas/tags. 15. Acciones masivas.

**Fuera de alcance (uso interno):** multicanal (email entrante, chat, redes), portal de clientes externos, base de conocimiento pública, CSAT cliente-facing.

#### 5.1.5 Recomendación de orden

Si el objetivo es "sólido y que sume valor" como reemplazo operativo real: **1) liberar la conversación (TKT-001) + endurecer seguridad de escritura (SEC-001/RLS-*) → 2) notificaciones (TKT-003) → 3) reasignación (TKT-002) → 4) búsqueda/filtros + cola admin (TKT-006/007) → 5) prioridad + SLA básico (TKT-004/005)**. Los puntos 1-3 son los que convierten el módulo de "demo bonita" en herramienta de uso diario.

> **Estado al 2026-08-10:** de esa lista quedan abiertos **la seguridad de escritura** (SEC-001/RLS-*, punto 1b) y **la cola global de admin** (TKT-007). Todo lo demás está entregado. El orden resultó bueno: los puntos 1-3 sí fueron los que cambiaron la naturaleza del módulo.

#### 5.1.7 Modelo de equipo — arquitectura entregada (2026-08-10)

**Qué cambió de fondo.** El módulo estaba diseñado para *una persona*: el ticket nacía con dueño fijo, el estatus se deducía y nadie se enteraba de nada sin abrir la app. Ahora está diseñado para un **equipo que rota**.

**Decisiones cerradas (no re-litigar):**

1. **El ticket pertenece a un área, no a una persona.** `tickets.area_id` está **desnormalizado** a propósito (podría derivarse de `problem_catalog`): la política RLS se evalúa por fila y un join ahí se paga caro, y tener el área en el ticket permitirá transferirlo entre áreas sin reescribir su tipo de problema. Un trigger lo rellena en el insert, así que el front —que todavía escribe con el cliente Supabase— **no puede crear un ticket sin cola** aunque lo intente.
2. **`responsable_id` nullable = está en la cola.** El self-assign va por **RPC `security definer`**, no por política UPDATE: una política lo bastante amplia para permitir el self-assign también abriría la puerta a editar otras columnas. Mismo criterio para cambiar estado y reasignar. Es el patrón de `rec_transicion_etapa`.
3. **La cola se gatea por pertenencia al área, no por rol.** El técnico de Sistemas que la atiende tiene rol `usuario` en los presets; gatearla por rol la escondería justo de quien la necesita.
   > **Consecuencia a vigilar:** cualquiera con `profiles.area_id` = un área ve **todos** los tickets de esa área. Es el modelo correcto para una cola, pero exige que `/admin/usuarios` mantenga las áreas limpias.
4. **El estado es una columna, no una inferencia.** Enum `ticket_estado`. Con eso muere la regla de paridad de `validate_response_order` (TKT-001) y aparece el "en proceso" que nunca existió. Los tipos de respuesta preexistentes (`terminado_*`, `rechazo_*`) **sincronizan el estado por trigger**, así que el front viejo siguió funcionando durante la migración.
5. **La bitácora se llena por trigger, no desde las acciones.** Instrumentar las RPCs habría dejado fuera los cierres, que los dispara el trigger de las respuestas. Con triggers sobre `tickets`, ningún camino de escritura la esquiva —ni un update manual de admin— y el evento se deriva de *qué columna cambió*. `ticket_historial` no tiene política de insert: solo los triggers escriben, un cliente no puede fabricar historia.
6. **Las notificaciones reusan Gmail, no se agregó Resend.** `lib/google` ya mandaba correos en producción para Reclutamiento. Todo envío es **best-effort**: un Gmail caído nunca bloquea crear, tomar o mover un ticket.
   > **Riesgo registrado:** las notificaciones las dispara cualquier usuario, pero `rec_credenciales_google` solo la leen admin/Reclutamiento. La RPC `tkt_credencial_google` devuelve el `refresh_token` **cifrado (AES-256-GCM)**; la llave vive solo en el entorno del servidor, así que quien la llame obtiene un blob indescifrable.

**Semántica del SLA (revisada).** El reloj corre mientras el área debe algo — `abierto` o `en_revision` — y se mide desde `created_at`. `programado` lo **pausa** a propósito: el trabajo ya se validó y espera a la siguiente tanda, así que la demora dejó de ser del técnico; `resuelto` también, porque ahí la pelota es del solicitante. **Las pausas no se acumulan**: un ticket reabierto vuelve a contar contra su hora original. Es la lectura estricta y defendible; acumular exige reconstruir desde `ticket_historial`, que es justo lo que la bitácora habilita.

**El usuario no elige área.** `/tickets/nuevo` es un solo paso. La gente piensa en síntomas, no en organigramas, y el área siempre fue consecuencia del tipo de problema. Buscador insensible a acentos que indexa **también las opciones de los campos select** (ahí viven las frases reales: "instalar impresora"), tarjetas con ejemplos concretos tomados del catálogo, y atajos frecuentes anclados por fragmento de nombre para que renombrar un tipo nunca deje un link muerto.

**Deuda consciente:** las plantillas de correo y las frases frecuentes de tickets viven en el código, a diferencia de las de Reclutamiento, que se editan desde Ajustes. **Y los correos nunca se han enviado de verdad** — la ruta es la misma que Reclutamiento usa a diario, pero falta verlo llegar.

#### 5.1.6 Validación de requisitos (de dónde sale cada no-negociable)

> **Advertencia de método**: la lista de no-negociables de §5.1.4 es una **hipótesis** derivada de (a) las normas genéricas de un helpdesk y (b) el poco contexto de negocio que hay documentado. **No está validada** contra cómo opera CrediFlexi de verdad. Un requisito riguroso no se justifica con *"el mercado lo trae"* sino con **un dolor observado en el flujo actual (WhatsApp/correo/Sheets) o una necesidad declarada por un usuario real**. Por eso aquí se marca el **nivel de evidencia** de cada uno y **cómo confirmarlo** antes de construir.

| No-negociable | Fuente | Nivel de evidencia | Cómo confirmarlo (validación) |
|---|---|---|---|
| Notificaciones (TKT-003) | Reemplaza WhatsApp, cuyo valor central es *avisar* | Inferido fuerte | Preguntar: "¿cómo te enteras hoy de que tienes algo pendiente?" Si la respuesta es "me escriben por WhatsApp", está confirmado. |
| Reasignación (TKT-002) | Norma de helpdesk | Supuesto | Preguntar: "¿alguna vez una solicitud cae en la persona equivocada? ¿qué hacen hoy?" |
| Conversación libre (TKT-001) | Limitación verificada en código | Confirmado (técnico), impacto Supuesto | Observar 5-10 hilos reales: ¿alguien necesitó mandar 2 mensajes seguidos y no pudo? |
| Seguridad en escritura (SEC-001/RLS-*) | Debilidad técnica real + contexto financiera | Confirmado (técnico) | Validar con sistemas/cumplimiento qué exige CrediFlexi para PII y trazabilidad. |
| Búsqueda/filtros (TKT-006) | Norma + volumen esperado | Supuesto (depende del volumen) | Estimar tickets/semana esperados. Si son <20 quizá no urge; si son cientos, es crítico. |
| Prioridad / SLA (TKT-004/005) | Norma de helpdesk | Supuesto | Preguntar: "¿hay incidencias que NO pueden esperar? ¿cómo las distinguen hoy?" |

**Método para traducir requisitos bien (lo que asegura que ayudas):**

1. **Observa el flujo que reemplazas** ("shadowing"): pide ver 10 incidencias reales en el WhatsApp/correo/Sheets actual. Cada fricción que veas es un requisito con evidencia.
2. **Habla 20-30 min con 2-3 usuarios por rol** (un solicitante, un responsable/recuperador, un admin/coordinador). No preguntes por funciones ("¿quieres SLA?"); pregunta por **dolores y por la última vez que pasó** ("cuéntame la última vez que se te perdió una incidencia").
3. **Traduce dolor → requisito → criterio de aceptación.** Ej: *"se me pierden tickets en WhatsApp"* → *requisito: notificación + cola buscable* → *aceptación: el responsable ve y encuentra todo pendiente sin salir de la app*.
4. **Marca cada requisito como Confirmado / Inferido / Supuesto** (como la tabla de arriba). Solo construye sin validar los Confirmados; los Supuestos se confirman antes de invertir esfuerzo.
5. **Separa los dos objetivos**: lo que hace falta para la **demo ejecutiva** (impresionar a Dupont) ≠ lo que hace falta para **operación diaria real**. Un no-negociable de operación (notificaciones) puede ser opcional para la demo, y viceversa.

**Preguntas de descubrimiento listas para llevar a los usuarios:**
- ¿Cómo reportas/recibes una incidencia hoy y cómo sabes que llegó?
- ¿Cuántas incidencias manejas por semana, aprox.?
- ¿Cuántas veces algo se perdió o se atendió tarde? ¿Por qué?
- ¿Hay incidencias urgentes vs. que pueden esperar? ¿Cómo las distingues?
- ¿Alguna vez algo cayó en la persona equivocada? ¿qué hiciste?
- ¿Qué necesitas ver de un vistazo al abrir la herramienta?
- ¿Qué te haría dejar de usar WhatsApp/correo para esto?

### 5.2 Score Crediticio

**Alcance**: captura de acreditados con referencias, modelo HM replicado (réplica del GAS legacy), evaluación A/B/C/D por promotor, historial automático.

**Estado**: producción.

**Archivos clave**: `lib/scoring/modelo.ts`, `lib/actions/acreditados.ts`, `app/(dashboard)/score/*`, `components/score/*`, migraciones 05, 10, 11, 13.

**Pendientes**: DB-001/002 (transacción), SEC-003 (trigger recalcular), RLS-003 (validar capturador), DB-004 (mapear errores RPC).

### 5.3 Auth + Stand-by + Presets

**Alcance**: Google OAuth + magic link, filtro de dominio `@financieracrediflexi.com` + allowlist de correos externos (`NEXT_PUBLIC_AUTH_EMAILS_EXTRA`), presets de acceso para operadores en `login_presets`. Usuarios nuevos sin accesos → `/stand-by` (mensaje: "tu área y accesos los asigna administración"); admin gestiona en `/admin/usuarios`. El onboarding self-service fue eliminado (2026-07-02); bandera `acceso_tickets` añadida para que Tickets deje de ser universal.

**Estado**: producción.

**Archivos clave**: `middleware.ts`, `app/(auth)/auth/callback/route.ts`, `app/stand-by/page.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/tickets/layout.tsx`, migraciones 14, 15, 40 (TKT stand-by).

**Pendientes**: UI-003 (copy `?error=auth`).

### 5.4 Módulo Cartera — Deep Dive

> Sección más extensa porque es el eje estratégico actual.

#### 5.4.1 Origen y contexto

CrediFlexi opera con un sistema externo (Yunius) que exporta semanalmente el **Reporte de Antigüedad** crudo (~63 columnas, 1 sheet). Históricamente esto se ha procesado con un Flask local (`automatizador-crediflexi`) que genera un Excel reformateado de 12 hojas y se distribuye por correo a varios roles.

El **legacy NO se toca** — sigue funcionando independiente mientras la plataforma lo reemplaza progresivamente. La plataforma debe lograr **paridad de información** (no de formato) y luego **superación** (real time, multi-corte, drill-down, exportación bajo demanda).

#### 5.4.2 Legacy — lo que entrega hoy

`automatizador-crediflexi` (Flask, 3122 líneas en `app/reportes.py`, 14+ iteraciones recientes según commits). Genera Excel con 12 hojas:

| Hoja | Contenido | Consumidor |
|------|-----------|-----------|
| `R_Completo` | 74 cols, todos los registros procesados | Vista de respaldo, filtros manuales |
| `[DDMMYYYY]` (fecha de corte) | Copia exacta de R_Completo | Snapshot del corte |
| `[MesAño]` (Marzo2026, Abril2026, Mayo2026...) | Cohort de créditos cuyo **`Inicio ciclo`** cae en ese mes; acumulativo desde antes del 1-abril | Análisis por camada |
| `X_Coordinación` (6 pivots) | Cartera × PAR por región | Coordinadores |
| `X_Recuperador` (2 pivots) | Cartera × PAR por recuperador | Recuperadores |
| `RECUPERADOR_000124` | Hoja especial de un recuperador | Caso particular |
| `Mora` (+ 4 cols verdes Call Center + 5 cols azules Campo) | Registros con días de mora ≥ 1 | Call center / cobranza campo |
| `Cuentas con saldo vencido` | Saldo vencido ≥ 1 y mora ≤ 0 | Casos especiales |
| `Liquidación anticipada` | Calculadora con VLOOKUP a R_Completo | Operativo (cotizar liquidación) |
| `Cobranza`, `Asignación`, `Recuperación` | Pegadas manualmente | Áreas operativas |

**Reglas de negocio confirmadas** (extraídas de `reportes.py`, `config.py`, `plan.md` del legacy):

- **Filtro de fraude**: 27 códigos hardcodeados en `LISTA_FRAUDE`.
- **Exclusión de recuperador**: código `000124`.
- **Buckets PAR**: `0`, `7`, `15`, `30`, `60`, `90`, `Mayor_90`, `Mayor_180` (basado en días de mora).
- **Columnas calculadas**:
  - `Concepto Depósito`: `"1" + codigo_acreditado + ciclo_str` (al ciclo mayor cuando hay múltiples).
  - `Saldo riesgo capital` / `Saldo riesgo total`: vale 0 si mora ≤ 0.
  - `% MORA`: saldo vencido / saldo total.
  - `Días desde el último pago`: diff con hoy.
  - `Alerta`: 1 si `días desde último pago > plazo_dias` según periodicidad.
  - `Cuotas sin pagar`: `días_desde_último_pago / días_de_periodicidad` (truncado).
  - `Saldo_Riesgo_total` (nueva def): `saldo_total if mora > 30 else 0`.
  - `Combinado`: cuotas si mora ≤ 30, else saldo_riesgo_nuevo.
- **Hojas mensuales**: segmentación por `Inicio ciclo`. Marzo2026 = antes del 1-abril (acumulado), Abril2026 = abril, Mayo2026 = mayo, etc. Es decisión de negocio.
- **Plantilla**: `PLANTIILA2_nueva.xlsx` aporta los pivots de X_Coordinación / X_Recuperador con caches preconfigurados.

**Reporte de Antigüedad Grupal**: existe ruta `POST /reportes/procesar_antiguedad_grupal` pero es **stub no implementado** (TODO en `reportes.py:3067`). No está en el alcance porque tampoco se usa.

#### 5.4.3 Microservicio `crediflexi-services` — estado actual

FastAPI mínimo (4 commits, ~340 LOC útiles). Estructura:

```
main.py                  ← app FastAPI + health
routers/cartera.py       ← POST /cartera/procesar
services/cartera_etl.py  ← pipeline pandas (replica legacy)
core/config.py           ← env vars
core/supabase.py         ← cliente service_role singleton
```

**Endpoint único**:
```
POST /cartera/procesar
Body: { upload_id, fecha_corte, storage_path }
→ marca cartera_uploads.estado='procesando'
→ descarga Excel desde Supabase Storage con service_role
→ transformar(tmp) [pandas pipeline]
→ delete previo + insert batches de 500 en stg_yunius_cartera_individual
→ marca estado='procesado', rows_inserted=N
→ on error: estado='error', error_detalle=...
```

**Lo que el ETL hace** (`services/cartera_etl.py:258`):
- Cargar Excel con DTYPE_CONFIG (preserva strings de teléfonos).
- Normalizar headers (strip `\n`).
- Filtrar fraude + excluir recuperador 000124.
- Calcular PAR, Concepto Depósito, Saldo riesgo, % MORA, Alerta, Cuotas sin pagar, Saldo_Riesgo_total, Combinado.

**Lo que el ETL NO hace** (gap):
- ❌ No mapea todas las columnas a Supabase: `df_a_registros` solo serializa ~20 campos, pero `stg_yunius_cartera_individual` define ~55 (faltan `nom_region`, `codigo_promotor`, `nombre_promotor`, `codigo_recuperador`, `nombre_recuperador`, garantías, referencias, geolocalización, plazo, fechas de ciclo, montos comisión, etc.).
- ❌ No procesa amortizaciones (`loan_amortizacion_individual` queda vacía).
- ❌ No autentica al caller (cualquiera con la URL puede dispararlo).

#### 5.4.4 Plataforma — lo que tiene y lo que falta

**Tiene**:
- `app/(dashboard)/cartera/cargar/page.tsx` + `components/cartera/upload-form.tsx` — UI drag-drop con polling.
- `app/api/cartera/upload/route.ts` — sube a Storage + crea `cartera_uploads`.
- `app/api/cartera/procesar/route.ts` — bridge al microservicio (valida `acceso_cartera`, llama POST).
- `app/api/cartera/uploads/route.ts` — lista uploads con auto-cleanup de timeouts >10 min.
- `app/(dashboard)/admin/cartera/page.tsx` — gestión admin de uploads.
- `app/(dashboard)/admin/usuarios/` con `cartera-accesos.tsx` — toggle `profiles.acceso_cartera`.

**Falta** (todo lo de consumo):
- ❌ Endpoints GET / RPCs para leer datos agregados.
- ❌ Vistas materializadas para PAR consolidado, totales por coordinación/recuperador.
- ❌ Páginas `/cartera`, `/cartera/cobranza`, `/cartera/riesgo` — son placeholders.
- ❌ Drill-down crédito × cuotas.
- ❌ Exportación Excel/CSV bajo demanda.
- ❌ Selector multi-corte (comparar fechas de corte).

#### 5.4.5 Schema en Supabase

3 tablas creadas (`20260520000001_cartera_tables.sql`):

| Tabla | Filas reales | Llenado por | Uso futuro |
|-------|--------------|-------------|-----------|
| `cartera_uploads` | Crece con cada upload | Next.js (`/api/cartera/upload`) | Ledger |
| `stg_yunius_cartera_individual` | ~191 filas probadas | Microservicio (20 de 55 campos) | Fuente principal de dashboards |
| `loan_amortizacion_individual` | 0 (vacía) | TBD — código externo que tiene el usuario | Drill-down + liquidación real |

**Índices existentes**: `fecha_corte`, `coordinacion`, `par_bucket`, `codigo_recuperador`, `(fecha_corte, codigo_acreditado)` en amortización.

**RLS**: `has_cartera_access()` (admin o `profiles.acceso_cartera = true`).

#### 5.4.6 Gap legacy → plataforma

| Vista del legacy | Equivalente en plataforma | Gap |
|------------------|---------------------------|-----|
| Excel completo con 12 hojas | — | No reemplazado |
| `R_Completo` (74 cols) | tabla `stg_yunius_cartera_individual` | Datos en DB pero sin UI de listado/filtrado |
| Hoja con fecha del día | snapshot por `fecha_corte` | Falta selector de corte |
| Hojas mensuales (cohort por `Inicio ciclo`) | filtro por mes | `fecha_inicio_ciclo` está en schema pero NO se llena en ETL |
| `X_Coordinación` (6 pivots) | RPC/vista agregada por coord × PAR | No existe |
| `X_Recuperador` | RPC/vista agregada por recuperador × PAR | No existe |
| `RECUPERADOR_000124` | filtro especial | Caso particular — replicable cuando exista la vista por recuperador |
| `Mora` + cols Call Center + Campo | tabla con seguimiento | Falta diseño operativo |
| `Cuentas con saldo vencido` | filtro `saldo_vencido≥1 AND dias_mora≤0` | Query directa, falta UI |
| `Liquidación anticipada` (VLOOKUP) | drill-down + cálculo | Requiere amortizaciones |
| `Cobranza`, `Asignación`, `Recuperación` (manuales) | módulo separado | Fuera de scope inmediato |

**Conclusión**: la base de datos tiene la materia prima, pero le faltan: (a) que el ETL llene **todas** las columnas; (b) endpoints/RPCs de consulta; (c) la capa de UI.

#### 5.4.7 Decisiones de diseño confirmadas (sesión 2026-05-27)

- Legacy no se toca; queda como referente.
- Hojas mensuales = segmentación por `Inicio ciclo` (cohort), no por fecha de corte.
- Amortizaciones llegarán vía script externo TBD; no bloquean MVP de dashboards.
- Orden de dashboards: **snapshot ejecutivo → coord × PAR → recuperador → mora operativa → drill-down/liquidación**.
- Excel no se reemplaza con un Excel mejor: se reemplaza con dashboards interactivos. Si el usuario quiere Excel descargable, será derivable on-demand desde la UI.

#### 5.4.8 Riesgos y preguntas abiertas del módulo

| Tipo | Punto |
|------|-------|
| Riesgo | ETL inserta solo 20/55 cols — dashboards quedarán cojos hasta cerrar gap. |
| Riesgo | Microservicio sin auth + sin deploy. En prod sería disparable por cualquiera. |
| Riesgo | Hojas mensuales del legacy dependen de hardcodes (`mes=4 año=2026`); la plataforma debe ser dinámica. |
| Pregunta | ¿De dónde y cómo se llenará `loan_amortizacion_individual`? (usuario: "otro código existe") — confirmar formato y disparador. |
| Pregunta | Liquidación anticipada en la plataforma: ¿se calcula desde amortizaciones (real) o se replica el VLOOKUP del Excel (aproximación)? |
| Pregunta | `Cobranza`, `Asignación`, `Recuperación` (hojas pegadas a mano en legacy): ¿entran al scope de la plataforma o quedan fuera? |
| Pregunta | ¿La plataforma debe ofrecer exportación Excel del listado, o el legacy seguirá generándolo por correo? |

#### 5.4.9 Análisis profundo input/output (sesión 2026-05-28) — fuente de verdad

Tres documentos hijos consolidan el análisis exhaustivo realizado a fin de cuadrar el microservicio al 100 % con el `FINAL TARGET`:

- [`docs/cartera/input-analysis.md`](./docs/cartera/input-analysis.md) — Inventario col-por-col del Excel Yunius (63 cols × 343 filas en sample): tipo, %nulls, unicos, rol semántico, mapeo a schema, uso en legacy.
- [`docs/cartera/output-analysis.md`](./docs/cartera/output-analysis.md) — Diseccion de las 13 hojas del FINAL y comparación contra el output actual (`nuevo_31032026`): qué se deriva, qué viene externo, cálculos por hoja, schema canónico de detalle (71 + 4 calc cols).
- [`docs/cartera/mapping-matrix.md`](./docs/cartera/mapping-matrix.md) — Matriz definitiva input ↔ schema ↔ output con estado por col y checklist de aceptación.

##### 5.4.9.a Hallazgos críticos

**Bug en producción** (`cartera_etl.py:336-338`): el ETL inserta tres campos que **no existen** en `stg_yunius_cartera_individual` (`concepto_deposito`, `cuotas_sin_pagar`, `combinado`). PostgREST los rechaza silenciosamente — resultado: `concepto_deposito` se calcula correctamente pero **nunca se persiste**, y los duplicados de `Saldo_Riesgo_total`/`Combinado` se pierden (esto último es deseable: son derivables al exportar).

**Cobertura real del ETL**: persiste solo 19 campos del registro (los del `df_a_registros()`), no los ~55 que el schema permite. Faltan en el insert: `nom_region`, `codigo_promotor`, `nombre_promotor`, `codigo_recuperador`, `nombre_recuperador`, todas las garantías, todas las referencias, plazo, fechas de ciclo, montos de comisión, geolocalización, criticidad, forma_de_entrega, etc.

**Cobertura real del schema**: cubre solo 52 cols de las ~63 que el input trae *y que el output necesita*. Faltan 10 columnas que el output canónico requiere:

1. `situacion_credito` 2. `medio_comunic_2` 3. `medio_comunic_3` 4. `tipo_garantia_2` 5. `descripcion_garantia_2` 6. `garantia_2` 7. `calle` 8. `colonia` 9. `nom_personal_castiga_cartera` 10. `frecuencia`

(+ `parcialidad_comision` para preservar la suma `Parcialidad + Parcialidad comisión`).

**Comportamiento exacto del FINAL** (decisiones nuevas confirmadas por comparación de archivos):
- La hoja `R_Completo` **se elimina**; la hoja `{ddmmyyyy}` (snapshot del corte) la sustituye con 4 cols calculadas adicionales (`Cuotas sin pagar`, `Saldo_Riesgo_total`, `Combinado`, `Suma`).
- `Saldo_Riesgo_total` y `Combinado` son **duplicados literales** de `Saldo riesgo total` (col 68). Existen para evitar colisiones de header en pivot tables nativas de Excel. El microservicio puede emitir tablas estáticas con `xlsxwriter` y eliminar la duplicación.
- `Cuotas sin pagar` (col 72 del detalle) **no se calcula por días/periodicidad** (como hace hoy `cartera_etl.py:248`) sino por `count(amortizaciones WHERE estatus != 'PAGADA' AND es_futura_al_corte = false)` → requiere JOIN con `loan_amortizacion_individual` al exportar.
- Hoja `Asignación` = unión histórica de últimos 4 snapshots con `Corte` antepuesto (append idempotente).
- Hojas `Mora` y `Cuentas con saldo vencido` reordenan cols 1-7 del detalle (mueven `Código acreditado` a posición 7). `Mora` agrega 9 cols vacías para llenado manual de Call Center / Campo (`Estatus de llamada`, `Fecha del acuerdo de pago`, ..., `Monto del acuerdo5` — preservar sufijos numéricos textualmente para no romper macros).
- `Recuperación` (101 cols), `Cobranza` (19 cols) son **externos** al input cartera — la primera viene del core Yunius (REPORTE DE PAGOS), la segunda es un tracking manual de Call Center con ventanas de 28/21/14 días.
- `amortizaciones_individual_test` (89 cols, solo en FINAL): nuevo formato rico esperado para `loan_amortizacion_individual`, con JOIN del snapshot cartera embebido y cols computadas (`Categoría`, `Incremento`, `es_futura_al_corte`, `es_no_aplica_liquidacion`, `fuente_fecha_liquidacion`).

##### 5.4.9.b Plan de cierre del microservicio (al 100 %)

Pasos ordenados (referenciar `docs/cartera/mapping-matrix.md` §3-4 para detalle por punto):

1. **Migración SQL** — agregar 11 cols a `stg_yunius_cartera_individual` y extender `loan_amortizacion_individual` con `estatus_amortizacion`, `monto_recibido`, `categoria`, `incremento`, `fuente_fecha_liquidacion`, `es_no_aplica_liquidacion`, `codigo_ciclo`.
2. **Refactor `cartera_etl.py`**:
   - Extender `COLUMN_MAPPING` con TODOS los headers persistibles.
   - Reescribir `df_a_registros()` para serializar las ~50 cols (no solo 19).
   - Eliminar inserts de `cuotas_sin_pagar` y `combinado`.
   - Agregar `.zfill(2)` para `ciclo` antes de persistir.
   - Quitar el filtro `CODIGOS_RECUPERADOR_EXCLUIR` al persistir (mover al exportador).
3. **Módulo nuevo `cartera_export.py`** — genera el `.xlsx` FINAL TARGET (12 hojas, excluyendo `Recuperación`/`Cobranza`/`amortizaciones_test` en v1). Usa `pandas.pivot_table` + `xlsxwriter` para los pivotes (tablas estáticas, no PivotTables nativos).
4. **Endpoint nuevo** `GET /cartera/export/{fecha_corte}` que emite el XLSX bajo demanda. Llamable desde la UI Next.js.
5. **Tests E2E**: subir input → ETL → export → comparar `.xlsx` celda a celda contra `FINAL TARGET.xlsx`.

Una vez completados estos 5 pasos, el ecosistema Yunius input → Supabase → FINAL TARGET output queda cerrado.

##### 5.4.9.c Decisiones aún pendientes (cliente)

- ¿Mantener la hoja `RECUPERADOR_000124` o eliminarla (ahora que no se filtra al persistir)?
- ¿Generar `amortizaciones_individual_test` en v1 o diferir a fase 2?
- ¿Automatizar parser del export Yunius para llenar `Recuperación` (101 cols)?
- Criterio exacto para `Liquidación anticipada` (¿todos los vigentes? ¿solo con saldo adelantado?).
- ¿Las 9 cols operativas de `Mora` siguen siendo Excel-manuales o migran a UI?

##### 5.4.9.d Alineación del ETL al input real (sesión 2026-06-17, CART-016)

Ajuste del ETL contra un export Yunius **real** (`docs/etl/bruto.xlsx`, 63 cols × 187 filas) para corregir desajustes de mapeo detectados al comparar headers efectivos vs. los nombres asumidos en sesiones previas. Verificado ejecutando `transformar()` + `df_a_registros()` sobre el archivo real (160 registros tras filtro de fraude).

Cambios aplicados en `services/cartera_etl.py`:

1. **Parcialidad fusionada** — Yunius exporta **una sola** columna `"Parcialidad + Parcialidad comisión"` (no dos columnas separadas como se asumía). Se mapea a `parcialidad`; `parcialidad_comision` queda en `NULL`. Verificado: `parcialidad` poblada 160/160.
2. **Monto último pago** — el header real es `"$ Último pago"` (con `Ú` mayúscula y signo `$`), no `"Monto último pago"`. El lookup en `df_a_registros` es **exact-match** sobre el nombre de columna, así que la mayúscula importa. Verificado: `monto_ultimo_pago` poblado 133/160 (los 27 NULL son créditos sin pago aún — consistente con 157/187 no-nulos antes del filtro de fraude).
3. **Robustez de encabezado** — `_detectar_fila_encabezado()` busca la fila ancla (`"Código acreditado"`) en las primeras 6 filas y `cargar_excel()` la usa como `header`, tolerando una fila de título arriba del encabezado. Default 0 si no la encuentra.

Diferidos a la fase de export (CART-006), **no** al ETL de ingesta:
- `Link de Geolocalización` — derivable de `geolocalizacion` (lat/long → URL de maps) al exportar; no se persiste en staging.
- `Próximo Pago` — **requiere segunda fuente** (`REPORTE DE COBRANZA`); en el legacy es un `XLOOKUP(Código acreditado & Ciclo → 'REPORTE DE COBRANZA'!AO)`. No es derivable del reporte individual que ingerimos hoy.

##### 5.4.9.e Fecha de corte automática y trazabilidad de procesado (sesión 2026-06-17)

Cierre del pipeline de cartera para producción (mismo día que SEC-002 y CART-016), con la **primera carga real** ejecutada OK:

1. **Fecha de corte automática** — al procesar ya no se pide la fecha a mano; se asume el **día anterior** (el insumo Yunius es el corte del día previo). Elimina el error humano de teclear mal la fecha.
2. **Trazabilidad de carga/proceso** — migración `20260617120000_cart_015_trazabilidad_procesado.sql`: se registra cuándo se cargó y procesó cada corte, para auditar qué insumo alimentó cada snapshot.
3. **Limpieza pre-producción** — DB y buckets de cartera limpiados de datos de prueba antes de la primera carga real.

### 5.5 Asistente IA

**Alcance**: asistente conversacional con doble rol — experto en la empresa (cartera, PAR, reportes legacy) y experto en uso de la plataforma. Brainstorm completo en `docs/ideas-agente-ia-asistente.md`.

**Estado actual (entregado 2026-06-04, PRO-004)**: demo **determinística sin LLM**:

- `lib/ai/knowledge-base.ts` — KB embebida (13 chunks empresa + plataforma) + `retrieveRelevant` (keyword overlap) + `generateDemoResponse`.
- `app/api/ai/assistant/route.ts` — endpoint que arma la respuesta con retrieval + templates.
- `components/cartera/assistant-chat.tsx` + `app/(dashboard)/cartera/chat/page.tsx` — UI con empty-state, chips de sugerencias, citas y banner "modo demo".
- `@ai-sdk/react` ya instalado (preparado para la migración).

**Decisiones 2026-06-09** (detalle en PLAN §4 "Asistente IA"):

- Stack: **Vercel AI SDK + Gemini API tier de pago** (nunca el tier gratuito de AI Studio — entrena con los datos). Escalado futuro a Vertex AI (ZDR + region pinning) = swap de provider.
- Fase A (PLAN §2.5): LLM + streaming + **tools que envuelven los 5 RPCs de cartera existentes** (los checks de permisos de los RPCs aplican al ejecutarse con la sesión del usuario). KB completa en el system prompt — sin RAG vectorial todavía.
- PII: tool de mora **seudonimizada** (códigos/saldos/días, sin nombres ni teléfonos) hasta visto bueno de cumplimiento (LFPDPPP / secreto financiero). El resto de tools son agregados sin PII.
- Guardrail: el agente nunca inventa cifras; todo número proviene de una tool y se cita con `fecha_corte`.

**Riesgos**: enviar PII a un tercero requiere validación de cumplimiento antes de habilitar el detalle de mora (AI-022); una API key creada sin billing cae en el tier gratuito (entrenamiento) — verificar tier antes de usar en producción.

---

## 6. Problemas y Bugs Detectados

### Arquitectura

- **SEC-001 (Alta)** — Tickets mutados desde el cliente. `ticket-form.tsx:118`, `response-composer.tsx`, `catalogo-admin.tsx`, `usuarios-admin.tsx`. Toda la seguridad depende de RLS; si una policy falla, no hay barrera. **Recomendación**: migrar a Server Actions con validación Zod en servidor.
- **API-001 (Media)** — `app/api/cartera/procesar/route.ts:40` hace `fetch` síncrono a microservicio Python. Si el ETL tarda más que el timeout serverless de Vercel, la respuesta se cuelga. **Recomendación**: arquitectura asíncrona — Next.js solo dispara el job y el microservicio actualiza estado en DB; el cliente sigue por polling (ya implementado).

### Seguridad / RLS

- **RLS-001 (Alta)** — `attachments_insert` (mig. 002:114) permite a cualquier autenticado insertar adjunto a **cualquier** `ticket_id` que conozca; no valida participación. **Fix**: `with check` con `EXISTS` sobre `tickets` donde `auth.uid()` sea `levantado_por_id` o `responsable_id`.
- **RLS-002 (Media)** — `profiles_select using (true)` (mig. 002:15) expone email/nombre/rol de todos los perfiles a todos los autenticados. **Fix**: restringir a campos públicos vía vista o a admin.
- **RLS-003 (Media)** — `acreditado_referencias` / `acreditado_historial` INSERT solo validan `has_score_access()`; un operador puede contaminar registros ajenos. **Fix**: validar también que el `acreditado_id` es del capturador o via RPC.
- **RLS-004 (Media)** — `ticket_responses_insert` no bloquea si `closed_at IS NOT NULL`. **Fix**: trigger `before insert` que rechace.
- **RLS-005 (Media)** — Bucket Storage `ticket-attachments` no tiene políticas en el repo (sí en el dashboard). **Fix**: migración versionada análoga a `20260524000002_cartera_storage_policy.sql`.
- **SEC-002 (Media) ✅ 2026-06-17** — Cartera: el microservicio usa `service_role_key` (bypassa RLS, correcto para backend-to-DB). El endpoint `/cartera/procesar` del microservicio ya **autentica** la llamada de Next.js vía **token compartido** (`INTERNAL_API_TOKEN`, mismo valor en Vercel y Render): Next.js manda `Authorization: Bearer <token>` y el micro valida con `secrets.compare_digest`, respondiendo 401 si no coincide (fail-closed: sin token configurado rechaza todo). Se descartó HMAC por sobre-ingeniería para tráfico server-to-server interno sobre HTTPS.

### Cartera (gaps de datos)

- **CART-001 (Alta)** — ETL del microservicio mapea solo 20 de ~55 campos definidos en `stg_yunius_cartera_individual`. Faltan: `nom_region`, `codigo_promotor`, `nombre_promotor`, `codigo_recuperador`, `nombre_recuperador`, plazo, fechas de ciclo, garantías, referencias, geolocalización, etc. **Fix**: extender `df_a_registros()` en `crediflexi-services/services/cartera_etl.py:301`.
- **CART-002 (Media)** — `fecha_inicio_ciclo` no se llena → no se puede hacer la segmentación cohort del legacy ("Marzo2026/Abril2026/Mayo2026"). **Fix**: parte de CART-001.
- **CART-003 (Alta)** — `loan_amortizacion_individual` vacía. No se puede hacer drill-down ni liquidación anticipada. **Fix**: integrar con script externo del usuario (pendiente definición).
- **CART-004 (Media)** — Sin endpoints de consulta. Aunque los datos lleguen completos, la UI no puede leerlos. **Fix**: RPCs de agregación + endpoints GET (ver §7).
- **CART-005 (Baja)** — `cartera_uploads.fecha_corte` se ingresa manualmente por el usuario; no se valida contra el contenido del Excel. **Fix**: validar al procesar o derivar.

### UX

- **UI-001 (Alta)** — ~~Toast de error en creación de ticket~~ ✅ 2026-05-25.
- **UI-002 (Alta)** — ~~Adjuntos iniciales no se muestran en el hilo~~ ✅ 2026-05-25.
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
  - RPCs: `guardar_evaluacion_promotor`, `has_score_access`, `has_cartera_access`
  - Enum `response_type` con `rechazo_responsable`
  - **Fix**: usar `supabase gen types typescript`.

### Performance

- **PERF-001 (Baja)** — Dashboard hace 4 queries en paralelo (aceptable). Sin paginación de tickets viejos.
- **PERF-002 (Baja)** — `acreditado-form` recalcula score en `useMemo` por cada keystroke (OK funcionalmente).

### Deuda operativa

- **OPS-001 (Alta)** — Microservicio Python solo corre en localhost. Sin Dockerfile, sin deploy. Cartera en producción no funcionaría.
- **OPS-002 (Media)** — Parte 1 ✅ resuelta (2026-05-28): Supabase CLI v2.101 linkeado al proyecto, baseline de 22 migraciones repareadas, scripts `npm run db:new`/`db:push`/`db:status` operativos. Parte 2 pendiente: workflow GitHub Actions con `supabase db push` en CI.
- **OPS-003 (Baja)** — No hay `.env.example` en el repo raíz.

---

## 7. Deuda Técnica

| ID | Tipo | Ubicación | Severidad | Recomendación |
|----|------|-----------|-----------|---------------|
| CART-001 | Datos | `cartera_etl.py:301` | Alta | Mapear todas las columnas a `stg_yunius_*` |
| CART-003 | Datos | `loan_amortizacion_individual` | Alta | Integrar fuente externa de amortizaciones |
| CART-004 | API | Falta capa de consulta cartera | Alta | RPCs `cartera_resumen`, `cartera_por_coordinacion`, etc. |
| RLS-001 | Seguridad | `ticket_attachments.insert` | Alta | Policy con EXISTS sobre tickets |
| RLS-005 | Seguridad | Storage `ticket-attachments` | Alta | Migración con políticas versionadas |
| OPS-001 | Operación | Microservicio Python | Alta | Dockerfile + deploy (Railway/Fly/Render) + `PYTHON_SERVICE_URL` en Vercel |
| SEC-001 | Arquitectura | Mutaciones cliente en tickets/admin | Alta | Migrar a Server Actions |
| SEC-002 ✅ | Seguridad | Microservicio sin auth | Media | ✅ 2026-06-17 — token compartido `INTERNAL_API_TOKEN` (Bearer + `compare_digest`, fail-closed) |
| CART-002 | Datos | `fecha_inicio_ciclo` no llenada | Media | Parte de CART-001 |
| CART-005 | Datos | `fecha_corte` no validada vs Excel | Baja | Validación al procesar |
| RLS-002 | Seguridad | `profiles_select` open | Media | Vista pública o restringir |
| RLS-003 | Seguridad | Score historial/refs INSERT | Media | RPC única + validar capturador |
| RLS-004 | Seguridad | Responses en ticket cerrado | Media | Trigger before insert |
| DB-001/002 | Datos | Acreditado sin transacción | Media | RPC `upsert_acreditado` |
| SEC-003 | Seguridad | Score editable vía API | Media | Trigger DB que recalcule |
| TYP-001 | Tipos | `lib/supabase/types.ts` desincronizado | Media | `supabase gen types` |
| OPS-002 | Operación | CLI local ✅, falta CI | Media | Parte 1 hecha (CLI configurado); falta GitHub Action con `supabase db push` |
| API-001 | Arquitectura | `/api/cartera/procesar` síncrono | Media | Fire-and-forget al microservicio |
| DEB-001 | Tests | Sin framework | Media | Vitest + Playwright para críticos |
| UI-003/004 | UX | `error=auth`, `error.tsx` faltantes | Baja | Añadir copy y boundaries |
| DB-003/004 | Datos | Diff espurio + mensajes RPC | Baja | Comparar refs y mapear errores |

---

## 8. Gaps y Features Pendientes (por módulo)

### Cartera (crítica — eje estratégico)

1. **CART-001** — Completar mapeo de columnas en ETL.
2. **CART-002** — Llenar `fecha_inicio_ciclo` (habilita cohort mensual).
3. **CART-004** — Capa de consulta: RPCs/vistas (resumen, coord × PAR, recuperador × PAR, mora operativa).
4. **DASH-001** — Dashboard ejecutivo `/cartera` (snapshot: total cartera, total mora, % PAR consolidado, top coord en mora, indicador del último corte).
5. **DASH-002** — Vista por Coordinación × PAR (equivalente a `X_Coordinación`).
6. **DASH-003** — Vista por Recuperador (equivalente a `X_Recuperador`, con filtro "mi cartera").
7. **DASH-004** — Vista de Mora operativa (equivalente a hoja `Mora` + columnas de seguimiento Call Center/Campo).
8. **DASH-005** — Drill-down de crédito + Liquidación anticipada (bloqueado por CART-003).
9. **OPS-001** — Deploy del microservicio.
10. **SEC-002** ✅ 2026-06-17 — Auth entre Next.js y microservicio (token compartido `INTERNAL_API_TOKEN`).

### Tickets (UX y seguridad)

11. **RLS-001 + RLS-005** — Endurecer adjuntos y políticas Storage.
12. **UI-003 + UI-004** — Copy login + `error.tsx` global.
13. **SEC-001** — Migrar mutaciones a Server Actions (gradual).

### Score (robustez)

14. **DB-001 + DB-002** — RPC atómica `upsert_acreditado`.
15. **RLS-003** — Validar capturador en historial/refs.
16. **SEC-003** — Trigger DB recalcula score.
17. **DB-004** — Mapear errores RPC.

### Transversal

18. **TYP-001** — Regenerar tipos Supabase.
19. **OPS-002 (parte 2)** — Migraciones automatizadas en CI (CLI local ya configurado el 2026-05-28).
20. **DEB-001** — Tests E2E críticos.
21. **PRO-004** — Chat IA en `/cartera/chat`: demo determinística ✅ (2026-06-04); agente real con LLM + tools en curso (PLAN §2.5, AI-001..003).
22. **PRO-005** — Notificaciones email (Resend).
23. **PRO-006** — Dominio custom.

---

## 9. Recomendaciones Técnicas

1. **Cartera primero, todo lo demás después**. Es el módulo con mayor brecha y mayor valor para reemplazar el legacy.
2. **Cerrar el ETL antes que los dashboards**. Sin todas las columnas, los dashboards se quedan cojos. Orden: CART-001 → CART-004 → DASH-*.
3. **Endurecer RLS de adjuntos y Storage en migración versionada** (no en dashboard manual).
4. **Migrar tickets a Server Actions** progresivamente: empezar por `crear ticket` y `responder`.
5. **HMAC entre Next.js y microservicio** antes de exponer el microservicio en internet.
6. **`supabase gen types` automatizado** post-migración (script en `scripts/`).
7. **`error.tsx` global + por sección** (tickets, score, cartera).
8. **Tests mínimos**: smoke E2E de login + crear ticket + crear acreditado + cargar cartera.
9. **Documentar variables de entorno** en `.env.example` (sin secretos).
10. **Considerar Edge Function/RPC para agregaciones** de cartera en vez de SELECT cliente — permite cachear y proteger.

---

## 10. Preguntas Abiertas

### Plataforma / transversales

1. ¿Dónde se desplegará el microservicio Python? (Railway / Fly.io / Render / VPS propio de CrediFlexi)
2. ¿Las políticas Storage del bucket `ticket-attachments` en producción están abiertas o restringidas?
3. ¿Qué LLM provider se usará para Chat IA en cartera? (OpenAI / Anthropic / local)
4. ¿Notificaciones email son requisito antes de ampliar usuarios de tickets?
5. ¿El algoritmo de score debe seguir replicando exactamente el GAS legacy o se puede iterar?
6. ¿Quién corre las migraciones SQL en producción (manualmente vs CI)?

### Cartera

7. ¿De dónde y cómo se llenará `loan_amortizacion_individual`? El usuario tiene "otro código" — formato esperado y disparador a definir.
8. ¿Liquidación anticipada: cálculo real desde amortizaciones o aproximación tipo VLOOKUP?
9. ¿Hojas externas del legacy (`Cobranza`, `Asignación`, `Recuperación`) entran al scope de la plataforma o quedan fuera?
10. ¿La plataforma exporta Excel del listado, o ese flujo lo sigue cubriendo el legacy?
11. ¿Quiénes son los consumidores reales del reporte hoy y con qué prioridad? (Asumido: todos los roles, prioridad coord → recuperador → mora operativa.)
12. ¿El dashboard de cartera consume el último corte por defecto o permite seleccionar fecha?

---

## 11. Apéndice — Inventario de migraciones

| # | Archivo | Propósito |
|---|---------|-----------|
| 01 | `20260421000001_initial_schema.sql` | profiles, areas, problem_catalog, tickets, responses, attachments |
| 02 | `20260421000002_rls_policies.sql` | RLS base + `is_admin()` |
| 03 | `20260421000003_views_and_functions.sql` | Vista `tickets_with_status` |
| 04 | `20260421000004_triggers.sql` | `validate_response_order`, `handle_ticket_closure`, `handle_new_user` |
| 05 | `20260424000001_scoring_schema.sql` | acreditados, referencias, historial + RLS |
| 06 | `20260514000001_onboarding.sql` | ~~RPC `complete_onboarding`~~ (eliminada 2026-07-02) + handle_new_user nombre vacío |
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
| 23 | `20260528190511_cart_000d_cols_faltantes.sql` | Columnas faltantes staging cartera |
| 24 | `20260531031407_cart_010_resumen_rpc.sql` | RPC `cartera_resumen` |
| 25 | `20260531033054_cart_010b_resumen_saldo_total.sql` | Métrica `saldo_total` en resumen |
| 26 | `20260531034435_cart_010c_resumen_filtros.sql` | Filtros en `cartera_resumen` |
| 27 | `20260531035020_cart_010d_fix_filtros_recuperadores.sql` | Fix filtros recuperadores |
| 28 | `20260602135452_cart_011_por_coordinacion_rpc.sql` | RPC `cartera_por_coordinacion` |
| 29 | `20260602142131_cart_012_por_recuperador_rpc.sql` | RPC `cartera_por_recuperador` |
| 30 | `20260602144732_cart_013_mora_operativa_rpc.sql` | RPC `cartera_mora_operativa` |
| 31 | `20260602152000_cart_014_cohort_rpc.sql` | RPC `cartera_cohort` (frontera configurable) |
| 32 | `20260612154500_tkt_limpieza_tickets_prueba.sql` | Borra tickets de prueba + reinicia `tickets_numero_seq` → 1 |
| 33 | `20260612160000_alta_empleados_presets.sql` | Áreas + presets de login de 73 empleados |
| 34 | `20260612160500_tkt_catalogo_incidencias_junta.sql` | Catálogo: 3 incidencias confirmadas en junta (campos dinámicos + responsables default) |
| 35 | `20260615120000_tkt_borra_catalogo_prueba.sql` | Borra los 4 tipos de problema de prueba (guard anti-FK) |
| 36 | `20260617120000_cart_015_trazabilidad_procesado.sql` | Trazabilidad del procesado de cartera |
| 37 | `20260617230820_cart_016_limpieza_datos_prueba.sql` | Limpieza de datos de prueba de cartera |
| 38 | `20260630120000_rec_001_profiles_acceso.sql` | `profiles.acceso_reclutamiento` |
| 39 | `20260630120100_rec_002_enums.sql` | Enums `rec_*` (etapa, fuente, revisión, viabilidad) |
| 40 | `20260630120200_rec_003_tablas.sql` | `rec_vacantes`, `rec_candidatos` + índices |
| 41 | `20260630120300_rec_004_rls.sql` | RLS `rec_*` + `has_reclutamiento_access()` |
| 42 | `20260630120400_rec_005_login_presets.sql` | Preset de login + `handle_new_user` (Héctor) |
| 43 | `20260701120000_rec_006_reclutamiento_bucket.sql` | Bucket `reclutamiento` (CVs) + Storage RLS |
| 44 | `20260701130000_rec_007_candidato_historial.sql` | `rec_candidato_historial` (auditoría de etapas) |
| 45 | `20260701130100_rec_008_transicion_etapa.sql` | **RPC `rec_transicion_etapa`** (DAG + descarte + historial) |
| 46 | `20260702120000_tkt_acceso_tickets_standby.sql` | Acceso a tickets en stand-by; elimina RPC `complete_onboarding` |
| 47 | `20260707100000_rec_009_enum_agenda.sql` | Enum de plantillas de correo (agendamiento) |
| 48 | `20260707100100_rec_010_agendamiento.sql` | `rec_sesiones_entrevistas`, `rec_entrevistas`, `rec_plantillas_correo`, `rec_correos_enviados` |
| 49 | `20260715120000_rec_011_evaluaciones_magic_link.sql` | Magic link por email + RPCs públicas `rec_sesion_por_token` / `rec_submit_evaluacion` |
| 50 | `20260727120000_rec_012_enum_bienvenida.sql` | Enum plantilla `bienvenida_contratacion` |
| 51 | `20260727120100_rec_013_comite_contratacion.sql` | `notas_comite`/`fecha_ingreso`, `cc_emails jsonb`, seed bienvenida, bloque dinámico N×20 |
| 52 | `20260727120200_rec_014_plantilla_rotacion_dinamica.sql` | `update … set cuerpo` de plantilla *(patrón retirado en S9.5)* |
| 53 | `20260727120300_rec_015_bucket_mime_xlsx.sql` | Permite mime xlsx en el bucket |
| 54 | `20260728130000_tkt_catalogo_metadata.sql` | **`problem_catalog.prioridad` / `sla_min` / `modalidad`** + recreación de `tickets_with_status` |
| 55 | `20260728130100_tkt_catalogo_sistemas_ti.sql` | Seed del catálogo Sistemas/TI (6 incidencias con campos dinámicos) |
| 56 | `20260728140000_rec_016_enum_altas.sql` | Enum plantilla `altas_nuevos_ingresos` |
| 57 | `20260728140100_rec_017_alta_config.sql` | `rec_alta_config` (1:1 con candidato) + RLS + seed plantilla |
| 58 | `20260728140200_rec_018_final_dg_meet.sql` | `final_dg_at` / `final_dg_meet_url` |
| 59 | `20260729100000_rec_019_plantilla_altas_real.sql` | `update … set cuerpo` con el formato real de altas *(patrón retirado en S9.5)* |
| 60 | `20260730120000_tkt_limpieza_tickets_prueba_2.sql` | 2ª limpieza de tickets de prueba + reinicia `tickets_numero_seq` → 1 |
| 61 | `20260730130000_rec_020_ajustes.sql` | **`rec_ajustes`** (key/value) + RLS + seed de DG y destinatarios de altas |
| 62 | `20260730130100_rec_021_vista_requisitos.sql` | **Vista `rec_candidato_requisitos`** con `security_invoker = on` (sin él se salta RLS) |
| 63 | `20260731144900_rec_022_factorial_employee_id.sql` | `rec_candidatos.factorial_employee_id` (idempotencia del alta en Factorial) |
| 64 | `20260731160000_rec_023_factorial_sync_toggle.sql` | Clave `factorial` en `rec_ajustes` con `{ sync_activa: false }` — el alta arranca **apagada** |
| 65 | `20260810120000_tkt_cola_por_area.sql` | **Cola por área**: `tickets.area_id` (backfill + trigger de relleno), `responsable_id` nullable, `es_de_area()`, RLS ampliada en tickets/respuestas/adjuntos, RPC `tkt_tomar_ticket` |
| 66 | `20260810120100_tkt_estados_explicitos.sql` | **Estados explícitos**: enum `ticket_estado` + columna con backfill, `validate_response_order` sin paridad, RPC `tkt_cambiar_estado`, vista recreada con `left join profiles` |
| 67 | `20260810140000_tkt_reasignacion.sql` | RPC `tkt_reasignar_ticket` (devolver a la cola / pasar a alguien del área) |
| 68 | `20260810150000_tkt_historial.sql` | **Bitácora** `ticket_historial` + triggers `log_ticket_creado` / `log_ticket_cambio` |
| 69 | `20260810150100_tkt_notif_credencial.sql` | RPC `tkt_credencial_google` — refresh_token **cifrado** para que cualquier usuario dispare notificaciones |

> **Estado 2026-08-10:** las **69** migraciones locales tienen par remoto. No hay nada pendiente de `db push`.
>
> **Ojo con los dos archivos de tipos.** `lib/supabase/database.types.ts` (1738 líneas) es el **espejo autogenerado** (`npm run db:types`); `lib/supabase/types.ts` (838 líneas) es el **manual de dominio/UI**. `client.ts` y `server.ts` importan `Database` del **manual**, no del generado — por eso el generado puede estar desfasado sin que truene nada.
>
> **Regenerado el 2026-08-04** (`8bcec2e`). Se había quedado en el 28-29 de julio, sin `problem_catalog.prioridad`/`sla_min`/`modalidad` (mig. 54, que se pusheó a remoto más tarde que las `rec_*` del mismo día), `rec_ajustes`, `rec_candidato_requisitos` ni `factorial_employee_id`. Como nada lo importa, el desfase no rompía nada — solo daba respuestas viejas con cara de autoridad. **Regenerar con `npm run db:types` después de cada `db push`.**

---

## 12. Auto-chequeo final

| Pregunta | Respuesta |
|----------|-----------|
| ¿Leí package.json, middleware, layouts raíz, dashboard? | Sí |
| ¿Leí al menos 3 Server Actions / route handlers? | Sí (`acreditados.ts`, `cartera/upload`, `cartera/procesar`) |
| ¿Revisé las migraciones (al menos las críticas)? | Sí — eran 22 al escribir esto; hoy son **69** y el inventario §11 está completo (actualizado 2026-08-10) |
| ¿Investigué el legacy y el microservicio? | Sí (README + research.md + plan.md del legacy, código del microservicio completo, schema Supabase) |
| ¿Distinguí "lo que existe" de "lo que se asume / hay que confirmar"? | Sí — §10 lista preguntas abiertas |
| ¿Documenté el estado real, no el aspirable? | Sí — Cartera marcada como ETL parcial + dashboards pendientes |
| ¿Identifiqué riesgos críticos? | Sí — RLS adjuntos, microservicio sin deploy, ETL incompleto |
| ¿IDs de tickets consistentes? | Sí — SEC, RLS, DB, UI, API, PERF, TYP, OPS, DEB, PRO, CART, DASH |

---

## 13. Módulo Reclutamiento *(S1..S9.5 + Sprint G implementados — ⏸ en pausa desde 2026-08-11)*

> Documentación de research del 4º módulo. **Estado 2026-08-04:** S1 (fundaciones), S2 (vacantes+candidatos), S3 (pipeline/DAG), **Sprint G (Google Workspace)**, **S4 (agendamiento masivo en cascada)**, **S5 (evaluaciones vía magic link)**, **S6 (comité + entrevistadores dinámicos + contratación)**, **S7 (`final_dg` + config de alta + correo interno de altas)**, **S7.5 (destinatarios editables + pipeline dinámico)**, **S9 (alta automática en Factorial HR — §13.9)** y **S9.5 (plantillas editables + bitácora de correos)** entregados. Todo el pipeline `postulado → … → contratado` está cubierto end-to-end y se opera desde el kanban.
>
> **Lo que falta no es código, es validación:** el smoke test end-to-end con correos de prueba nunca se corrió, y el alta en Factorial sigue apagada por interruptor. Pendiente **S10** (onboarding del candidato).
> El plan de trabajo (modelo de datos, sprints, integraciones) vive en `PLAN.md §8`.
> Detalle operativo en `docs/reclutamiento/`.

### 13.0 Agendamiento en cascada — arquitectura entregada (Sprint G + S4, 2026-07-07)

- **Integración Google sin `googleapis`:** `lib/google/client.ts` llama las APIs REST directo con `fetch` (token exchange/refresh, Calendar `events` con `conferenceDataVersion=1` + `sendUpdates=all` para Meet, Gmail `messages/send` con MIME base64url + asunto RFC 2047). Cero dependencias nuevas, apto para serverless.
- **Cifrado del `refresh_token`:** se resolvió con **AES-256-GCM del módulo `crypto` de Node** (`lib/google/crypto.ts`, formato `iv.tag.enc` en base64), llave derivada por SHA-256 de `GOOGLE_TOKEN_ENCRYPTION_KEY`. Se descartó Vault/`pgcrypto`: más simple y sin acoplar el cifrado a Postgres. La llave vive en `.env.local` y Vercel.
- **OAuth reconectable:** `/api/google/conectar` (genera `state` anti-CSRF en cookie httpOnly, `access_type=offline&prompt=consent`) + `/api/google/callback` (valida `state`, intercambia el code, cifra y hace upsert en `rec_credenciales_google` por `profile_id`). La cuenta emisora es la última conectada (`order by actualizado_at`); hoy `uzziel.valdez@`, mañana `reclutamiento@` **sin tocar código**.
- **Cascada (`lib/actions/agendamiento.ts` + `calcularCascada` en el schema):** una liga de Meet de 60 min por candidato; 3 entrevistadores rotan en bloques de 20 min (default Benny→Maritere→Sergio, editables); arranques escalonados 20 min; pausa opcional tras el candidato N. Por candidato: evento Calendar (invita candidato + 3 entrevistadores) → guarda `gcal_event_id`/`meet_url` → correo `agendamiento_fase2` por Gmail → log en `rec_correos_enviados` → transición a `entrevistas_agendadas` vía `rec_transicion_etapa`. Cierra con correo `agenda_entrevistadores` (tabla HTML) a los 3.
- **Resiliencia:** cada candidato se procesa de forma independiente; un fallo de Calendar/Gmail en uno no aborta la sesión (se reporta por candidato en la UI y en la bitácora con estado `error`).
- **Deploy:** requiere en Vercel `GOOGLE_RECLUTAMIENTO_CLIENT_ID/SECRET` + `GOOGLE_TOKEN_ENCRYPTION_KEY` y el redirect URI de producción registrado en GCP. Consent screen sigue en modo *External/producción* compartido con el login (advertencia de app no verificada esperada hasta verificar la app).

#### 13.0.1 Evaluaciones vía magic link — decisiones entregadas (S5, 2026-07-15)

- **Magic link = token propio, no Supabase Auth.** El "magic link" del entrevistador es un token aleatorio (`randomBytes(32).base64url`) guardado en la tabla `rec_magic_links`; **no** consume el sistema de emails/OTP de Supabase Auth ni crea usuarios/sesiones. El correo se manda por Gmail (Sprint G) y la validación es una RPC. Costo marginal: filas en una tabla propia.
- **Identificación por email, no por `profiles.id`.** Los entrevistadores no son `profiles` (se modelan como jsonb `[{nombre,email}]` en la sesión desde S4). Por eso la migración `rec_011` relajó `entrevistador_id` a nullable y agregó `entrevistador_email`/`entrevistador_nombre` con uniques por email en `rec_magic_links` y `rec_evaluaciones`. Cuando aparezca la tabla `rec_entrevistadores` (v2) se podrá reconciliar por email.
- **Superficie pública mínima = 2 RPC security definer.** `rec_sesion_por_token(token)` devuelve solo lo que el entrevistador debe ver (su nombre, vacante, fecha, y por candidato nombre+horario+su propia evaluación) y `rec_submit_evaluacion(...)` hace upsert validando que la entrevista pertenezca a la sesión del token. Ambas con `grant execute` a `anon`; las tablas `rec_*` siguen admin-only por RLS. La ruta `/evaluar/[token]` **nunca** expone CVs, correos de candidatos ni evaluaciones de otros entrevistadores.
- **Token multi-uso, expira a 7 días.** El entrevistador entra las veces que necesite durante la jornada; `usado_at` es informativo (se refresca en cada submit), la vigencia la define `expira_at` (fecha de sesión + 7 días). La liga se arma con la URL base derivada de los headers de la petición en `agendarSesion` (sin variable de entorno nueva).

#### 13.0.2 Comité, entrevistadores dinámicos y contratación — decisiones entregadas (S6, 2026-07-27)

- **Entrevistadores dinámicos (N ≥ 1), no 3 fijos.** Se eliminó el hardcode de 3 entrevistadores/`ENTREVISTADORES_DEFAULT`. En `/reclutamiento/agendar` se inicia con una fila (nombre + email) y un botón "+" agrega más; captura manual libre, sin catálogo. La cascada se generalizó: cada entrevistador conserva su bloque de 20 min → duración del Meet por candidato = `N × 20`, arranques escalonados 20 min (la rotación i+j=k sigue sin empalmes para cualquier N). `calcularCascada`, `agendarSesion` (evento/attendees/tabla de agenda con N columnas/magic links) y la RPC `rec_sesion_por_token` (bloque dinámico `N×20` con `make_interval`) se ajustaron; la plantilla `agendamiento_fase2` pasó a un placeholder único `{{rotacion_entrevistadores}}` en lugar de `{{entrevistador_1..3}}`/`{{hora_1..3}}`.
- **`en_revision` automática al abrir el perfil.** El server component del detalle del candidato dispara `rec_transicion_etapa → en_revision` si `etapa === 'postulado'` (idempotente, nota "Apertura de perfil"). No rompe si la RPC falla. Refleja el as-is: revisar el CV = abrir el perfil.
- **Comité sin login para la DG.** Página `/reclutamiento/comite` (filtrable por vacante, etapas `comite/final_dg/oferta`). Por candidato muestra todas las evaluaciones de los entrevistadores (recomendación + comentarios + puntaje) y un campo nuevo `notas_comite` (decisión conjunta, capturada en la reunión). Javier (DG) no tiene cuenta: la pantalla se le muestra en la reunión y **el admin registra ahí mismo** la decisión ("Pasa con DG" → `final_dg`, o descarte con motivo), reutilizando `transicionarCandidato`; todo queda en `rec_candidato_historial`.
- **Contratación como acción única que centraliza el "al contratar pasa X".** `contratarCandidato` valida prerequisitos (email del candidato, plantilla activa, credencial Google) **antes** de mutar; luego encadena las transiciones del DAG hasta `contratado`, fija `fecha_ingreso` y envía el correo `bienvenida_contratacion` (copy base = correo real de Héctor) con `fecha_ingreso`/`fecha_limite_docs` renderizadas en español largo. El envío es best-effort con bitácora en `rec_correos_enviados` (estado `enviado`/`error`). Es el único gancho para automatización post-contratación futura (por definir).
- **CC configurable + adjuntos fijos.** Se agregó `cc_emails jsonb` a `rec_plantillas_correo` (default seed: Irvin Mora, Cynthia Aguilar, Jesús Montellano), editable al contratar; `enviarCorreo` ahora emite header `Cc`. Dos adjuntos fijos viven en el bucket `reclutamiento/plantillas/` (`layout-datos-personales.xlsx`, `lineamientos-fotografias.pdf`) y se adjuntan igual que en REC-033. El bucket restringía mime types a PDF/DOC/DOCX, así que `rec_015` agregó el mime de xlsx. **Subir los archivos es un paso manual por el dashboard** (no hay service-role key en el entorno para automatizarlo); sin ellos el correo se envía sin adjuntos.

#### 13.0.3 Configuración editable y pipeline dinámico — decisiones entregadas (S7.5, 2026-07-30)

- **Cero correos en el código.** Las constantes `DG_EMAIL`/`DG_NOMBRE`/`ALTA_DESTINATARIOS_DEFAULT` se eliminaron y viven en la tabla `rec_ajustes` (key/value jsonb: claves `dg` y `alta_destinatarios`), editables en `/reclutamiento/ajustes`. Los CC por plantilla **no se duplicaron** ahí: `rec_plantillas_correo.cc_emails` ya existía y solo le faltaba UI. Los valores prellenan cada formulario y siguen siendo editables por candidato (config + override, no una u otra).
- **RLS de escritura por acceso al módulo, no admin-only.** `rec_ajustes` usa `has_reclutamiento_access() or is_admin()`: Héctor tiene el flag pero no es admin, y con escritura admin-only el único operador real del módulo no podría cambiar un correo. La auditoría queda en `actualizado_por`/`actualizado_at`.
- **Sin fallbacks de correo.** Si falta la fila, `leerAjustes(supabase)` devuelve strings vacíos + `faltanAjustes: true` y la acción falla con `Result` en español. Nunca se envía a una dirección quemada por accidente. El lector **recibe el cliente por parámetro** (mismo patrón que `enviarCorreoAltas`) para importarse igual desde Server Components y Server Actions.
- **Requisitos derivados en una vista, con `security_invoker = on`.** `rec_candidato_requisitos` agrega `evaluaciones_esperadas`/`evaluaciones_registradas`/`tiene_alta_config` a `rec_candidatos`: una consulta por página en vez de 4 round-trips repetidos en tres pantallas. `security_invoker` es obligatorio (PG15+): sin él la vista corre como owner y **se salta RLS**. Corrigió de paso un bug de conteo — el total de evaluaciones se calculaba como `entrevistas.length` (siempre 1, porque `agendarSesion` crea 1 entrevista y N evaluaciones); el total correcto es `sum(jsonb_array_length(entrevistadores))`.
- **Motor de etapas puro.** `lib/reclutamiento/etapas.ts` (sin React, sin Supabase, sin directivas) recibe el candidato + contexto y devuelve `SiguientePaso` (destino, copy, acción, `puede`, `bloqueos`, `advertencias`, `progreso`). Lo consumen kanban, perfil y comité: las reglas y el copy dejaron de estar duplicados en tres componentes.
- **Fricción proporcional al efecto secundario.** Todo paso que manda correo (`comité→final_dg`, `oferta→contratado`) exige un formulario en modal; los pasos `directa` no envían nada. Un click accidental en una tarjeta de 220px no puede disparar un Meet ni una bienvenida. **Bloqueo duro solo con 0 evaluaciones**; con parciales es advertencia confirmable, para que un entrevistador que no responde no congele el pipeline.
- **`components/ui/*` es código muerto que rompe el build.** El scaffolding de shadcn importa `@/lib/utils` (el helper `cn`), que nunca se creó, y `clsx`/`tailwind-merge` no están instalados: importar cualquiera de esos componentes tira `next build`. Para diálogos se usan los primitivos de `@radix-ui/react-dialog` directamente.

### 13.1 Resumen y alcance

CrediFlexi necesita automatizar el tramo de reclutamiento que va de **"el candidato cumple requisitos"** hasta **"el candidato es contratado"**, hoy 100% manual a cargo de **Héctor Ramírez** (Gerente de Gente y Cultura). El cuello de botella medido: ~**6 horas** cada miércoles de ciclo creando ligas de Google Meet una por una, armando concentrados en Excel (con typos recurrentes) y enviando correos a candidatos y entrevistadores.

**No reemplaza a Factorial** (SaaS ya en uso para vacante/postulación/expediente). Este módulo es **complemento**: orquesta agendamiento, entrevistas, evaluaciones y correos del tramo intermedio. Factorial se integra por API en v2.

**Alcance del MVP**: una sola vacante — **Gerente/Ejecutivo de Inversiones**. Otras vacantes (ej. Subgerente de Crédito con *assessment center*) son v2.

### 13.2 Stakeholders

| Persona | Rol | En MVP | Acceso |
|---------|-----|--------|--------|
| **Héctor Ramírez** | Gerente de Gente y Cultura | ✅ único usuario | Admin (Supabase Auth + `acceso_reclutamiento`) |
| Benigno (Benny) Cerdeira | Entrevistador técnico | ✅ | **Solo link mágico** (sin Supabase Auth) |
| Maritere Ríos | Entrevistadora técnica | ✅ | **Solo link mágico** |
| Sergio Soto | Entrevistador técnico | ✅ | **Solo link mágico** |
| Jesús Montellano | Operativo de RH | ❌ v2 | — |
| Brendoli Hernández | Comunicados | ❌ v2 | — |
| Javier Vargas | Director General (entrevista final) | ❌ v2 | — |
| Félix Linares | Gerente Data Science (sponsor técnico) | ❌ | — |
| **Candidatos** | — | **NUNCA** entran a la app | Solo reciben correos + invitaciones de Calendar |

### 13.3 Flujo as-is (ciclo típico de 5 días)

| Día | Quién | Qué pasa hoy (manual) |
|-----|-------|------------------------|
| 0 (lun) | Héctor | Publica la vacante en OCC, Computrabajo, LinkedIn, Factorial |
| 1-2 (mar-mié) | Héctor | Llegan correos de las plataformas (~73-80 postulados). Revisa CVs, **descarta ~85%** por juicio humano, llama a los viables y los cita |
| 3 (mié, 4-10 PM) | Héctor | **6 h de dolor**: genera 8-13 ligas Meet a mano, invita candidato + 3 entrevistadores con horarios escalonados, arma el Excel "Entrevistas Fase II" y lo envía |
| 4 (jue, 9 AM-3 PM) | Entrevistadores | Día de entrevistas. Cada candidato tiene **1 Meet de 60 min**; 3 entrevistadores rotan en bloques de 20 min: Benny (00-20) → Maritere (20-40) → Sergio (40-60). Llenan Excel "Análisis 1" con comentario + viabilidad (Sí / No / Filtro por DG) |
| 5 (vie) | Comité | Héctor + entrevistadores deciden quién pasa a Javier (DG). Correo "Entrevista Final" a los que pasan. Javier entrevista por separado. Reunión final → carta oferta + carta informativa + alta vía Excel Yunius |

**Embudo típico**: 73-80 postulados → 11 a Fase 2 → ~5 a Fase 3 (DG) → 3-4 contratados.

### 13.4 Pain points cuantificados (lo que el MVP debe matar)

1. **6 h del miércoles** creando 11 Meet links a mano + invitaciones escalonadas. → *Sprint 4 (feature estrella).*
2. **Concentrado Excel duplicado** de la semana anterior con typos reales detectados ("Setgio", "DONGU" vs "DOLGU", tab mal nombrada). → *Datos estructurados + plantillas.*
3. **Embudo del Excel "Centro Data" nunca se llena** (las 3 fases vacías). Héctor ya intentó una base de datos y la abandonó por costo de captura. → *Captura mínima + automática; la trazabilidad es subproducto, no carga extra.*
4. **Plantillas de correo hardcoded en Gmail**; riesgo de mandar el nombre equivocado. → *`rec_plantillas_correo` + render con variables.*
5. **Sin trazabilidad**: nadie sabe en qué etapa está cada candidato. → *Enum `rec_etapa` + dashboard.*

### 13.5 Decisiones de producto cerradas

- **Un solo usuario MVP** (Héctor, admin). Solo vacante de Gerente/Ejecutivo de Inversiones.
- **El descarte del 85% NO se automatiza** — sigue siendo juicio humano. La plataforma solo asiste con un flujo rápido (ver CV, marcar **viable / parcial / no**, capturar motivo de descarte por *tags* + nota corta opcional).
- **Entrevistadores entran SOLO por link mágico** (token custom en tabla, **no** Supabase Auth — chocaría con el filtro de dominio del middleware).
- **Candidatos NO son usuarios** de la app.
- **Agendamiento en cascada**: Héctor selecciona N candidatos viables, define día + rango horario + orden de entrevistadores (Benny → Maritere → Sergio); la plataforma calcula slots de 20 min en cascada y crea **todo** automáticamente (Calendar events + Meet + correos + magic links).
- **No se consulta free/busy** de entrevistadores; se bloquea el día sí o sí.
- **Sin reagendamiento en MVP**: si un candidato no puede en su slot, se cae del proceso.
- **Submit explícito** de la evaluación del entrevistador (no autoguardado).
- **"Filtro por DG"** = el entrevistador no votaría "sí" pero quiere que Javier vea al candidato. Se usa **solo como voto**, no como transición automática.
- **Vacante = una entidad con N posiciones**; la **entidad geográfica** (Querétaro, Puebla, EdoMex, Tlaxcala…) es atributo del **candidato**, no de la vacante.
- **Alcance Google = Opción A (full Workspace):** Gmail API (envío) + Calendar API (eventos con Meet links), OAuth de usuario `reclutamiento@financieracrediflexi.com` (scopes `gmail.send`, `gmail.readonly`, `calendar.events`), conectado una sola vez en `/reclutamiento/admin/conectar-google`. El **agendamiento masivo no entrega valor sin Google**, por eso en el plan el **Sprint G va antes del sprint de agendamiento** (ver `PLAN.md §8.4`).
- **Pipeline 1↔1** candidato ↔ vacante en MVP (`rec_candidatos.vacante_id` FK directa). El modelo N↔N es v2.
- **RLS MVP definitiva:** Héctor (admin) ve y escribe **todo**; nadie más entra a la app autenticada (`acceso_reclutamiento` queda en el schema para v2); los entrevistadores solo acceden por **magic link** a la sesión de su token.
- **Vista de comité explícita:** pantalla del viernes donde Héctor consolida las 3 viabilidades por candidato y decide `final_dg` / `descartado` (con `notas_comite` opcional). Es un sprint propio (S6 en el plan).
- **Plantilla `notificacion_entrevistador`** (con placeholder exclusivo `{{magic_link}}`) se suma al catálogo de plantillas para el correo que lleva la liga al entrevistador.
- **Pipeline completo (S7):** `final_dg` = entrevista final con la DG (Javier) → se manda `pase_fase3` al candidato y se crea Meet (candidato + Javier); la liga se persiste en `rec_candidatos.final_dg_at`/`final_dg_meet_url` para que el admin la copie/reenvíe. `oferta` = "Configurar alta": form por candidato (equipo/sistemas/inducción/destinatarios, prellenados y editables) que se guarda en `rec_alta_config`. Al pasar a `contratado` se dispara, además de la bienvenida, el **correo interno "Altas nuevo ingreso"** (`altas_nuevos_ingresos`) a las áreas.
- **Correo interno de altas — decisiones (confirmadas con 2 correos reales de Héctor, 2026-07-29):** (a) **un candidato por correo** (el modelo de lote se descartó; los ejemplos reales mandan uno a la vez); (b) **Adriana Alejaldre = rol `jefe_directo`** (conecta al candidato a su inducción), no un rol nuevo; (c) las **líneas de tarea se arman por rol** solo si el destinatario está definido (y, para sistemas, si el sistema fue marcado); (d) los **correos default por rol** son estables salvo `correos` y `jefe_directo`, que varían por caso y se editan en el form. La "tabla completa" de datos personales se enriquece en S8.

### 13.6 Restricciones técnicas y conflictos con el codebase actual

- **Magic link vs middleware** *(conflicto resuelto por diseño)*: `middleware.ts` protege todo excepto `/login` y `/auth`, y el callback exige dominio `@financieracrediflexi.com`. La ruta de evaluación del entrevistador **debe quedar fuera de ese guard**. Opciones: (a) excepción explícita en el `matcher`/lógica del middleware para `/reclutamiento/evaluar/*`; (b) route group separado fuera de `(dashboard)`. Se decide por **excepción en el middleware** (la app es un solo deploy; un route group nuevo igual pasa por el middleware salvo que se excluya en el matcher) — ver `PLAN.md §8`.
- **`ignoreBuildErrors: true`**: el build no falla por tipos. Las tablas `rec_*` deben agregarse **a mano** a `lib/supabase/types.ts` o todo el módulo será `any` (mismo patrón que arrastra cartera). Ticket explícito en el plan.
- **Patrón Server Actions** (`lib/actions/reclutamiento.ts`), como Score — **no** cliente directo como Tickets. Acciones críticas (transición de etapa, generación masiva de entrevistas) van por **RPC `security definer`** que valida `rol/acceso_reclutamiento` adentro.
- **RLS activo en todas las tablas `rec_*` desde la primera migración**. Las tablas accedidas por magic link (`rec_evaluaciones`, lectura de `rec_candidatos`/`rec_entrevistas` del entrevistador) requieren un patrón de acceso por **token validado server-side**, no por `auth.uid()` — la escritura de la evaluación se hace vía **RPC `security definer` que recibe el token** y resuelve el `entrevistador_id`, nunca confiando en sesión.
- **Secretos**: `rec_credenciales_google.refresh_token` debe ir **encriptado**, nunca en claro. Decisión condicional: **validar Supabase Vault al inicio del Sprint G**; si está disponible se usa Vault (opción correcta), si no, fallback a **`pgcrypto` (`pgp_sym_encrypt`)** con llave en `GOOGLE_TOKEN_ENCRYPTION_KEY` (Vercel). La `INTERNAL_API_TOKEN` y el patrón de no exponer secrets aplican igual.
- **Design system de `context.md` inviolable** (naranja en 7 lugares, sin badges rellenos, tablas con divs+grid, Inter 400/500). El módulo reusa `components/ui/*`, `components/layout/sidebar.tsx` (nueva sección gateada) y `header.tsx`.
- **Reuso de Gemini**: el parsing de correos entrantes usa `@ai-sdk/google` (ya integrado en `app/api/ai/assistant/route.ts`) con un *structured output* (Zod) — **no web scraping** (ToS de OCC/LinkedIn/Computrabajo lo prohíben).

### 13.7 Integraciones externas (research)

| Integración | Scope / método | Estado | Nota |
|-------------|----------------|--------|------|
| **Gmail API** | OAuth de usuario (no service account / no DWD). Scopes `gmail.send` + `gmail.readonly`. Cuenta `reclutamiento@financieracrediflexi.com` | Greenfield | Refresh token encriptado en `rec_credenciales_google`. Setup 1 vez vía `/reclutamiento/admin/conectar-google` |
| **Calendar API** | Mismo proyecto OAuth, scope `calendar.events`. `attendees` = candidato + 3 entrevistadores; Meet vía `conferenceData.createRequest` | Greenfield | Eventos en el calendar personal de `reclutamiento@` por ahora; calendar compartido = v2 |
| **Parsing correos plataformas** | Polling Gmail `readonly` cada N min; identificar por sender/asunto (OCC/LinkedIn/Computrabajo); extraer con Gemini Flash + Zod → `rec_candidatos` | Greenfield | **NO scraping.** Webhook Pub/Sub solo si el polling no alcanza |
| **Factorial API** | Alta de empleado al contratar | ✅ **entregado 2026-07-31 (S9)** | API Key + SDK oficial. Detalle en §13.9 |
| **Google Cloud Console** | Nuevo proyecto o ampliar el de Gemini: habilitar Gmail + Calendar API, consent screen interno | Greenfield | **Validar al inicio del Sprint G**: si el Workspace restringe OAuth a apps externas, Manuel debe *whitelistear* el `client_id` una vez |

> **Hoy el repo NO tiene integración con Google Workspace** (solo Gemini vía AI SDK + el OAuth de *login* de Supabase). Gmail/Calendar son trabajo nuevo: el mayor riesgo/desconocido del módulo.

### 13.8 Preguntas abiertas / TODOs (resolver con Héctor antes del sprint que las consume)

1. **Plantillas de correo**: ya tenemos el copy real de "Entrevista Final" (`pase_fase3`) y de "Altas Nuevo Ingreso" (`altas_nuevos_ingresos`, formato de Héctor sembrado en `rec_019`). Falta conseguir el literal del resto (confirmación postulación, agendamiento Fase 2, notificación entrevistador, descarte, oferta, informativa).
2. **"Filtro por DG"**: confirmar regla — ¿mayoría requerida? ¿un solo voto basta para que el candidato pase a Javier? ¿o solo cuenta como voto registrado y Héctor decide en comité?
3. **Entrevistadores**: ¿siempre los mismos 3 en orden fijo Benny → Maritere → Sergio, o configurables por vacante/sesión? (afecta si `orden_entrevistadores` se fija por sesión).
4. **Retención de datos** de candidatos descartados (compliance CNBV / LFPDPPP) — definir política de purga/anonimización.
5. **Workspace OAuth**: validar al inicio del Sprint G si CrediFlexi restringe apps externas; si sí, whitelisting del `client_id` por Manuel (1 conversación, 3 clicks en su admin).

> **Resueltos** (ya no son preguntas abiertas): alcance Gmail+Calendar = **Opción A** · cifrado del `refresh_token` = **Vault si está, `pgcrypto` si no** (§13.6) · pipeline = **1↔1** (N↔N v2) · RLS = **admin ve todo, nadie más entra** (§13.5) · Calendar = **personal de `reclutamiento@`** en MVP (compartido v2). El set de placeholders de plantillas y la caducidad/rotación de magic links se resuelven dentro del Sprint G y S5 respectivamente (no bloquean planeación).
>
> **Actualización 2026-07-31 (pregunta 1):** el problema de fondo dejó de ser "conseguir el copy literal". Las plantillas ahora se editan desde `/reclutamiento/ajustes` (S9.5), así que Héctor puede escribirlas él mismo sin migración ni despliegue. Las 4 plantillas seedeadas que ningún flujo envía (`confirmacion_postulacion`, `descarte`, `oferta`, `informativa`) están **deliberadamente ocultas** del editor: mostrarlas haría creer que editarlas cambia algo.

### 13.9 Factorial HR — integración entregada (S9, 2026-07-31)

**Qué resuelve.** El último tramo de retranscripción manual del proceso: hasta ahora, contratar disparaba correos, pero **alguien tenía que teclear al empleado en Factorial a mano**. Ahora `contratarCandidato` lo crea vía API.

**Decisiones cerradas (no re-investigar):**

1. **Auth = API Key, no OAuth2.** Es lo que Factorial documenta para desarrollos internos: la genera un admin en la UI, sin consentimiento por usuario y **sin la caducidad del refresh token** (access 1 h / refresh 1 semana) que se rompería entre contrataciones esporádicas. El SDK la manda como header `x-api-key`.
   > **Riesgo aceptado y registrado:** la API Key da **acceso total y no se puede acotar por scope**. Es god-mode sobre los datos de RH de la empresa. Vive solo como secret server-side en Vercel (`FACTORIAL_API_KEY`) y nunca toca el cliente. Si se filtra, el radio de daño es toda la cuenta de Factorial — no solo el alta de empleados.
2. **SDK oficial `@factorialco/api-client`**, no REST a mano. Excepción consciente a la convención del repo (la integración Google sí es REST manual): aquí el SDK está auto-generado del OpenAPI y **tipado**, lo que cerró el mayor unknown de la documentación pública — el body exacto de `createWithContract`.
3. **El resguardo no es el entorno, es el interruptor.** Nunca se consiguió el entorno demo que preveía el plan. El spike corrió en **solo lectura contra la cuenta real** (solo `GET` de catálogos, seguro) y de paso devolvió los IDs de producción. Lo que impide crear empleados por error es `rec_ajustes.factorial.sync_activa`, que arranca en `false`.
4. **Idempotencia por candidato.** `rec_candidatos.factorial_employee_id` guarda el id devuelto; si ya tiene valor, el alta no se vuelve a ejecutar. Sin esto, un reintento de contratación duplicaría al empleado en el sistema de nómina.
5. **Best-effort.** El alta no bloquea la contratación si falla, igual que el correo de altas. Contratar a alguien no puede depender de que un tercero esté disponible.

**Datos reales de CrediFlexi capturados en el spike** (constantes en `lib/factorial/client.ts`, override por env):

| Catálogo | ID |
|---|---|
| `company_id` | `355437` |
| `legal_entity_id` | `380827` |
| `location_id` | `488730` |
| teams | 6 |
| roles / levels | 43 / 52 |

**Hallazgo del spike:** el puesto mapea a **`role_id` + su `level` default**, **no** a `tree_node` — ese endpoint exige un filtro que la documentación no menciona.

**Límite conocido:** el alta cubre empleado + contrato básico. **Salario (en cents) y job title viven en `ContractVersion`**, un segundo paso que no se construyó. Tampoco se capturan equipo ni nivel en la UI. El lugar correcto para esos datos es **S10 (onboarding)**, donde entran una sola vez y limpios, en vez de teclearse en dos sistemas.

**Estado de validación:** código entregado, **no probado contra producción**. Falta encender `sync_activa` y contratar un candidato de prueba verificando que el empleado se crea, que `factorial_employee_id` se persiste y que un reintento no duplica.

---

*Fin del research consolidado.*
