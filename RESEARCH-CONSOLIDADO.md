# RESEARCH CONSOLIDADO — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Single source of truth del estado real del repo.
> Última actualización: 2026-07-01.
> Para el plan de trabajo activo ver `PLAN.md`.

---

## 1. Resumen Ejecutivo

**mea-tickets** es la plataforma interna de Financiera CrediFlexi (Next.js 14 App Router + Supabase). Hoy convive con un **ecosistema** que comprende:

- **Legacy intocable** (`automatizador-crediflexi`, Flask local) — sistema en operación que genera el Reporte de Antigüedad Individual en Excel y lo distribuye por correo. **No es objeto de cambio**; queda como referente funcional y de negocio.
- **Plataforma** (`mea-tickets`, este repo) — Next.js + Supabase. Convive 4 módulos: Tickets, Score, Onboarding/Auth, Cartera.
- **Microservicio** (`crediflexi-services`, FastAPI) — separado del repo principal, encargado del ETL de cartera; reemplaza progresivamente al legacy desde el flujo de datos.

**Estado por módulo** (detalle en §5):

1. **Mesa de Tickets** — producción. Base de captura **superior al promedio** (formularios dinámicos sin código, cierre confirmado, rechazo con motivo), pero con gaps en el **ciclo de vida operativo** del ticket: sin notificaciones, sin reasignación, conversación con paridad forzada y sin búsqueda/filtros. Benchmark y no-negociables en §5.1.2–5.1.6.
2. **Score Crediticio** — producción, modelo HM replicado.
3. **Onboarding + presets** — producción.
4. **Cartera Individual** — pipeline ETL end-to-end funcional (upload → microservicio → staging). **Falta toda la capa de consumo** (endpoints de lectura + dashboards). Microservicio aún sin deploy. ETL inserta solo ~20 de las ~55 columnas posibles. La tabla `loan_amortizacion_individual` está vacía (se llenará vía script externo TBD).

**Riesgos principales**:
- Seguridad RLS: `attachments_insert` no valida participación; `profiles_select using (true)` expone PII.
- Cartera depende de microservicio externo sin deploy y sin auth entre servicios.
- Mutaciones de tickets desde el cliente — seguridad 100% en RLS.
- Tickets: ciclo de vida operativo incompleto (notificar, reasignar, priorizar, buscar) — ver no-negociables §5.1.4.
- Tipos Supabase desactualizados respecto a cartera.
- Sin tests, sin CI, sin `error.tsx` global.

**Recomendación inmediata**: Cartera es el eje estratégico. La paridad con el legacy (vía dashboards en la plataforma) es lo que justifica la inversión. Endurecer RLS de tickets en paralelo.

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

### Server Actions vs Client Mutations

- **Server Actions**: solo `lib/actions/acreditados.ts` (4 funciones: `crearAcreditado`, `actualizarAcreditado`, `guardarEvaluacion`, `eliminarAcreditado`).
- **Cliente Supabase directo**: tickets (`ticket-form.tsx`, `response-composer.tsx`), admin (`catalogo-admin.tsx`, `usuarios-admin.tsx`, `areas-admin.tsx`, `cartera-accesos.tsx`).
- **Route Handlers**: `auth/callback`, `api/cartera/{upload,procesar,uploads}`.

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
| Onboarding (nombre + área) | Completo | RPC `complete_onboarding` security definer |
| Login presets (operadores Score) | Completo | `login_presets` + trigger `handle_new_user` |
| Mesa de tickets (crear/responder/rechazar/cerrar) | Completo (con bugs UX) | Cliente Supabase + RLS + triggers |
| Campos dinámicos por catálogo | Completo | `problem_catalog.campos` jsonb + `tickets.datos` jsonb |
| Rechazo responsable | Completo | enum `rechazo_responsable` + triggers + vista |
| Score Crediticio (CRUD + modelo) | Completo | Server Actions + RPC `guardar_evaluacion_promotor` |
| Admin tickets/areas/usuarios | Completo | Cliente Supabase + RLS admin |
| Métricas admin (tickets + score) | Parcial | Falta filtrar `rechazado`, sin gráficas |
| Cartera — carga Excel + ETL parcial | Completo end-to-end (con gaps de columnas) | Next.js → Storage → microservicio Python → `stg_yunius_cartera_individual` |
| Cartera — API de consulta | Pendiente | Sin endpoints GET ni RPCs agregadoras |
| Cartera — dashboards | Pendiente | Solo placeholders en sidebar |
| Cartera — Chat IA / Asistente | Demo entregada (sin LLM) | KB embebida determinística (2026-06-04); agente real con Gemini + tools planeado (PLAN §2.5, ver §5.5) |
| Notificaciones email | Pendiente | — |
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
| Notificaciones email | Pendiente | — |
| `error.tsx` global | Pendiente | 0 archivos en el proyecto |
| Tests | Pendiente | No hay framework instalado |

---

## 5. Módulos — Deep Dive

> Para cada módulo: alcance, estado, archivos clave, riesgos.

### 5.1 Mesa de Tickets

**Alcance**: gestión de incidencias internas. Levantador crea, responsable atiende, hilo de mensajes, cierre con confirmación, rechazo con motivo.

**Estado**: producción. UX bugs críticos cerrados 2026-05-25.

**Archivos clave**: `app/(dashboard)/tickets/*`, `components/tickets/*`, migraciones 01-04, 07-09, 12.

**Pendientes**: SEC-001 (Server Actions), RLS-001/002/004/005, UI-003/004.

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
| **TKT-001** | **Alta** | **La paridad estricta rompe conversaciones reales.** El responsable **no puede enviar dos mensajes seguidos** (ni el usuario): tras una respuesta par, el siguiente orden es impar y el trigger exige que sea el levantador. Un follow-up del agente antes de que conteste el usuario es rechazado con excepción SQL. | `validate_response_order` mig. 04:23-33 / 08:36-44 |
| **TKT-002** | **Alta** | **Sin reasignación ni transferencia.** El responsable se fija al crear y no hay UI ni flujo para cambiarlo. Si el problema cae en el área equivocada o la persona no está, el ticket queda atascado. (`tickets_update_admin` existe pero ninguna UI lo usa.) | `tickets` schema mig. 01:43 / sin ruta de reasignación |
| **TKT-003** | **Alta** | **Sin notificaciones.** Nadie se entera de un ticket nuevo, respuesta o cierre salvo que entre a la app y mire los contadores. Para reemplazar WhatsApp/correo esto es central. (Diferido a Resend, PRO-005.) | No hay integración de email/in-app |
| **TKT-004** | **Media** | **Sin prioridad / urgencia / severidad.** Todos los tickets son iguales; no hay forma de triar. | `tickets` schema sin campo prioridad |
| **TKT-005** | **Media** | **Sin SLA, fecha de vencimiento ni envejecimiento.** No hay "tickets vencidos" ni alertas de tiempo. | — |
| **TKT-006** | **Media** | **Sin búsqueda ni filtros en las listas.** `mios`/`asignados` traen todo ordenado por fecha; no se puede filtrar por estatus, área, responsable ni buscar por texto/número. | `mios/page.tsx`, `asignados/page.tsx` |
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
| Hilo de conversación + adjuntos | ✅ | ✅ (con paridad forzada, ver TKT-001) | Parcial |
| Asignación a un responsable | ✅ | ✅ (fija, default por catálogo) | Parcial |
| **Reasignación / transferencia** | ✅ | ❌ | **Gap (TKT-002)** |
| **Prioridad / urgencia** | ✅ | ❌ | **Gap (TKT-004)** |
| **SLA / vencimiento / escalación** | ✅ | ❌ | **Gap (TKT-005)** |
| **Notificaciones (email/in-app)** | ✅ | ❌ | **Gap (TKT-003)** |
| **Búsqueda y filtros de cola** | ✅ | ❌ | **Gap (TKT-006)** |
| **Cola/Bandeja de agente y de admin** | ✅ | Parcial (mios/asignados, sin global) | **Gap (TKT-007)** |
| **Notas internas (privadas)** | ✅ | ❌ | **Gap (TKT-008)** |
| Estados de ticket | ✅ | ✅ (derivados, no editables) | Parcial |
| Cierre con confirmación del solicitante | A veces | ✅ (mejor que el promedio) | **Ventaja propia** |
| Rechazo con motivo obligatorio | A veces | ✅ | **Ventaja propia** |
| Campos dinámicos por tipo (sin código) | A veces (planes altos) | ✅ | **Ventaja propia** |
| Historial/auditoría de cambios | ✅ | Parcial (solo el hilo; la asignación nunca cambia) | Gap menor |
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

### 5.3 Auth + Onboarding + Presets

**Alcance**: Google OAuth + magic link, filtro de dominio, onboarding obligatorio (nombre + área), presets de área para operadores con dominio `operador*`.

**Estado**: producción.

**Archivos clave**: `middleware.ts`, `app/(auth)/auth/callback/route.ts`, `app/onboarding/page.tsx`, migraciones 06, 14, 15.

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
  - RPCs: `complete_onboarding`, `guardar_evaluacion_promotor`, `has_score_access`, `has_cartera_access`
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

---

## 12. Auto-chequeo final

| Pregunta | Respuesta |
|----------|-----------|
| ¿Leí package.json, middleware, layouts raíz, dashboard? | Sí |
| ¿Leí al menos 3 Server Actions / route handlers? | Sí (`acreditados.ts`, `cartera/upload`, `cartera/procesar`) |
| ¿Revisé las 22 migraciones (al menos las críticas)? | Sí |
| ¿Investigué el legacy y el microservicio? | Sí (README + research.md + plan.md del legacy, código del microservicio completo, schema Supabase) |
| ¿Distinguí "lo que existe" de "lo que se asume / hay que confirmar"? | Sí — §10 lista preguntas abiertas |
| ¿Documenté el estado real, no el aspirable? | Sí — Cartera marcada como ETL parcial + dashboards pendientes |
| ¿Identifiqué riesgos críticos? | Sí — RLS adjuntos, microservicio sin deploy, ETL incompleto |
| ¿IDs de tickets consistentes? | Sí — SEC, RLS, DB, UI, API, PERF, TYP, OPS, DEB, PRO, CART, DASH |

---

## 13. Módulo Reclutamiento *(nuevo — en planeación, NO implementado)*

> Documentación de research del 4º módulo. Aún no hay código ni migraciones.
> El plan de trabajo (modelo de datos, sprints, integraciones) vive en `PLAN.md §8`.
> Detalle operativo en `docs/reclutamiento/`.

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
| **Factorial API** | — | ❌ v2 | Óscar Carlos (equipo Factorial) compartirá doc |
| **Google Cloud Console** | Nuevo proyecto o ampliar el de Gemini: habilitar Gmail + Calendar API, consent screen interno | Greenfield | **Validar al inicio del Sprint G**: si el Workspace restringe OAuth a apps externas, Manuel debe *whitelistear* el `client_id` una vez |

> **Hoy el repo NO tiene integración con Google Workspace** (solo Gemini vía AI SDK + el OAuth de *login* de Supabase). Gmail/Calendar son trabajo nuevo: el mayor riesgo/desconocido del módulo.

### 13.8 Preguntas abiertas / TODOs (resolver con Héctor antes del sprint que las consume)

1. **Plantillas de correo**: solo tenemos físicamente el copy de "Entrevista Final" (`pase_fase3`). Conseguir el literal del resto (confirmación postulación, agendamiento Fase 2, notificación entrevistador, descarte, oferta, informativa) **antes del Sprint G**.
2. **"Filtro por DG"**: confirmar regla — ¿mayoría requerida? ¿un solo voto basta para que el candidato pase a Javier? ¿o solo cuenta como voto registrado y Héctor decide en comité?
3. **Entrevistadores**: ¿siempre los mismos 3 en orden fijo Benny → Maritere → Sergio, o configurables por vacante/sesión? (afecta si `orden_entrevistadores` se fija por sesión).
4. **Retención de datos** de candidatos descartados (compliance CNBV / LFPDPPP) — definir política de purga/anonimización.
5. **Workspace OAuth**: validar al inicio del Sprint G si CrediFlexi restringe apps externas; si sí, whitelisting del `client_id` por Manuel (1 conversación, 3 clicks en su admin).

> **Resueltos** (ya no son preguntas abiertas): alcance Gmail+Calendar = **Opción A** · cifrado del `refresh_token` = **Vault si está, `pgcrypto` si no** (§13.6) · pipeline = **1↔1** (N↔N v2) · RLS = **admin ve todo, nadie más entra** (§13.5) · Calendar = **personal de `reclutamiento@`** en MVP (compartido v2). El set de placeholders de plantillas y la caducidad/rotación de magic links se resuelven dentro del Sprint G y S5 respectivamente (no bloquean planeación).

---

*Fin del research consolidado.*
