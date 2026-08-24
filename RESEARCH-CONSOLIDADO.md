# RESEARCH CONSOLIDADO — mea-tickets (CrediFlexi Operaciones)

> Documento vivo. Single source of truth del estado real del repo.
> Última actualización: 2026-08-18 (incluye el alta del módulo **Actividades**, §5.6).
> Para el plan de trabajo activo ver `PLAN.md`.

---

> **Foco activo (2026-08-11, vigente): Mesa de Tickets.** Cartera, Score y Factorial están **en pausa** — desplegados y operables, sin desarrollo nuevo. **Reclutamiento salió de la pausa el 2026-08-24 y está en lanzamiento de su v1** (§13; paquete de entrega en `docs/reclutamiento/`) — no fue desarrollo nuevo, fue la entrega que le faltaba. Este documento sigue describiendo los cinco módulos porque el contexto no caduca; la cola de trabajo vigente vive en `PLAN.md §0`.

> **⚠ Nota de mantenimiento (2026-08-18).**
>
> Este documento se había quedado en el 2026-08-11 mientras el código llegaba al 08-12: faltaban 7 tickets (TKT-043..049) y 8 migraciones, y varias afirmaciones habían pasado a ser falsas. Se corrigió, y de paso se limpió desfase **anterior** que hacía que el documento se contradijera a sí mismo (cartera y el asistente descritos como pendientes en §5 mientras §1/§3/§4 los daban por completos; el microservicio como "sin deploy" desde mayo).
>
> **Lo que hay que aprender de esto:** este archivo no truena cuando envejece. Igual que `database.types.ts` y que el inventario de §11, sigue dando respuestas con cara de autoridad después de dejar de ser cierto. Las secciones más peligrosas son las de detalle (§5.4, §6-§10), porque nadie las relee al hacer un cambio. **Del 2026-08-12 al 08-18 no hay commits ni registro de sesión**, así que lo marcado como pendiente puede estar resuelto sin rastro.

## 1. Resumen Ejecutivo

**mea-tickets** es la plataforma interna de Financiera CrediFlexi (Next.js 14 App Router + Supabase). Hoy convive con un **ecosistema** que comprende:

- **Legacy intocable** (`automatizador-crediflexi`, Flask local) — sistema en operación que genera el Reporte de Antigüedad Individual en Excel y lo distribuye por correo. **No es objeto de cambio**; queda como referente funcional y de negocio.
- **Plataforma** (`mea-tickets`, este repo) — Next.js + Supabase. Conviven **6 módulos**: Tickets, Score, Onboarding/Auth, Cartera, **Reclutamiento** (el más grande y el único con integraciones externas de escritura: Google Workspace y Factorial HR) y **Actividades** (el más nuevo, alta del 2026-08-18).
- **Microservicio** (`crediflexi-services`, FastAPI) — separado del repo principal, encargado del ETL de cartera; reemplaza progresivamente al legacy desde el flujo de datos.

**Estado por módulo** (detalle en §5):

1. **Mesa de Tickets** — producción, y desde el **2026-08-10 es una herramienta de equipo**: el ticket vive en la cola de su área hasta que alguien lo toma, avanza por estados explícitos, se puede soltar o pasar, deja bitácora y **avisa por correo**. Con eso caen los tres gaps estructurales más viejos (TKT-001 paridad, TKT-002 reasignación, TKT-003 notificaciones). El **11 y 12 de agosto** llegó la afinación que pidió la operación: supervisión de todas las colas, flujo por tipo de problema (pausa con nombre propio o sin pausa; los presenciales cierran directo), autocierre de resueltos a los 3 días y el remitente de correo sacado de la BD tras descubrir que **cualquiera podía cambiarlo sin querer**. Queda abierto: **verificar un envío real de correo**, notas internas (TKT-008), la pantalla `/admin/tickets` y la seguridad de escritura. Arquitectura en §5.1.7 y §5.1.8, benchmark en §5.1.3.
2. **Score Crediticio** — producción, modelo HM replicado.
3. **Onboarding + presets** — producción.
4. **Cartera Individual** — completo de punta a punta: ETL (upload → microservicio en Render → staging), capa de consulta (5 RPCs) y 5 dashboards, más el asistente Gemini con tools. Pendiente: `loan_amortizacion_individual` sigue vacía (bloquea drill-down y liquidación anticipada) y faltan los endpoints GET (CART-015).
5. **Reclutamiento** — el pipeline `postulado → contratado` opera completo desde el kanban, con Meets y correos reales vía Google Workspace, evaluaciones por magic link y alta automática en Factorial HR. **Su deuda no es de código, es de validación**: el smoke test end-to-end nunca se corrió con correos de prueba y el alta en Factorial sigue apagada por interruptor.
6. **Actividades** *(2026-08-18)* — tablero directivo de uso del tiempo, portado desde un Excel y un Power BI. Cuatro tablas, tres RPCs, tres pantallas y una de carga. **Es el módulo mejor verificado del repo antes de existir en producción**: sus 8 medidas se comprobaron una por una contra el tablero original, y el parser y las RPCs reproducen las cifras exactas. Sus datos hoy son **dummy**. Detalle en §5.6.

**Riesgos principales**:
- **`FACTORIAL_API_KEY` es god-mode**: la API Key de Factorial no se puede acotar por scope, así que da acceso total a los datos de RH de la empresa. Solo server-side, nunca en cliente (§13.9).
- **Destinatarios reales seedeados**: `bienvenida_contratacion` tiene 3 empleados de CrediFlexi en CC. Cualquier prueba de contratación les manda correo si no se reapunta antes desde `/reclutamiento/ajustes`.
- Seguridad RLS: `attachments_insert` no valida participación; `profiles_select using (true)` expone PII.
- Mutaciones de tickets desde el cliente — seguridad 100% en RLS. Las acciones nuevas (tomar, cambiar estado, reasignar, notificar) **sí** son Server Actions sobre RPCs `security definer`; crear ticket y responder siguen saliendo del navegador.
- **La cola de un área la ve todo el que tenga esa `area_id`**, y desde el 2026-08-11 quien tenga `supervisa_tickets` **ve todas las colas** — correcto para una mesa, pero obliga a mantener `/admin/usuarios` limpio en dos dimensiones, no una.
- Correos de tickets **entregados pero nunca verificados** con un envío real. El remitente ya no se puede cambiar por accidente (vive en variables de entorno), pero eso mismo significa que **corregirlo exige redesplegar**.
- **Migraciones 70-77 sin verificar contra remoto.** Si la 73 falló (`pg_cron` no disponible en el plan), el autocierre está escrito pero nunca corre, y nada avisa.
- `database.types.ts` congelado (no truena porque el código usa `types.ts` manual, pero el archivo generado miente). Mismo modo de falla que tuvo el inventario de migraciones de §11.
- Sin tests, sin CI, sin `error.tsx` global.

**Recomendación inmediata**: la plataforma ya no tiene un solo eje, y a esta altura **el patrón dominante del repo es el mismo en los tres módulos: la deuda ya no es de código, es de verificación.** Cartera alcanzó paridad con el legacy; Reclutamiento opera end-to-end pero su smoke test nunca se corrió y el alta en Factorial sigue apagada; Tickets acumuló cola, estados, bitácora, notificaciones, supervisión y autocierre entre el 10 y el 12 de agosto, y de todo eso **no se ha comprobado una sola cosa contra datos reales — empezando por que llegue un correo**. Cada semana que se construye encima agranda la superficie sin verificar. El guion de prueba ya existe (`docs/mocktest-mesa-tickets.md`); lo que falta es correrlo. Endurecer RLS sigue siendo transversal y pendiente.

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
| `crediflexi-services` | Microservicio FastAPI (ETL cartera) | Activo | **Render** — `crediflexi-services.onrender.com` (Free + Docker + autoDeploy) desde 2026-05-30 |
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
  evaluar/[token]/       ← ruta PÚBLICA del entrevistador (fuera del middleware)
  (dashboard)/
    layout.tsx           ← guard sesión + redirect stand-by si sin accesos
    dashboard/
    tickets/ (mios, asignados, area, nuevo, [numero])
    score/ (acreditados, nuevo, [numero], [numero]/editar)
    cartera/ (page, cargar, coordinacion, recuperador, mora, cohort)
    reclutamiento/ (vacantes, candidatos, pipeline, agendar, comite,
                    ajustes, correos)
    admin/ (catalogo, areas, usuarios, metricas, score/metricas, cartera)
  api/
    cartera/{upload,procesar,uploads}/route.ts   ← procesar delega al micro Python
    google/{conectar,callback}/route.ts          ← OAuth de Reclutamiento
    ai/assistant/route.ts                        ← agente Gemini + tools
    tickets/probar-correo/route.ts               ← diagnóstico de envío (admin)
components/
  admin/, brand/, cartera/, layout/, reclutamiento/, score/, stand-by/,
  tickets/             ← ya no hay `ui/`: el scaffolding shadcn se borró el
                          2026-08-18 (nunca se usó ni compiló — ver §13.0.3)
lib/
  actions/ (acreditados, reclutamiento, agendamiento, comite, ajustes,
            evaluaciones, tickets)
  tickets/ (sla.ts, guia.ts, correos.ts)         ← puros, sin React ni Supabase
  reclutamiento/ (etapas.ts, ajustes.ts, plantillas.ts)
  google/ (client.ts, crypto.ts)                 ← REST directo + AES-256-GCM
  factorial/client.ts
  ai/knowledge-base.ts
  cartera/types.ts · hooks/ · schemas/ · scoring/ · utils/
  supabase/ (client.ts, server.ts, types.ts, database.types.ts)
supabase/migrations/    ← 77 archivos + GUIA-SQL-SUPABASE.md
scripts/                ← utilidades manuales (incl. google-token-plataforma.mjs)
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
| `supabase/migrations/*.sql` | **77** migraciones: schema, RLS, triggers, vistas, scoring, cartera, tickets y `rec_*` — inventario completo en §11 |

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
| **`docs/catalogo-tickets.md`** (+ `.pdf`) | **Fuente de verdad del catálogo de tickets**: los 11 tipos con prioridad, SLA, modalidad, flujo, campos y obligatoriedad. ⚠ El catálogo se edita desde `/admin/catalogo` sin desplegar, así que este `.md` **se desfasa en silencio**. |
| `docs/mocktest-mesa-tickets.md` | Guion de pruebas pre-vuelo (7 bloques, dos cuentas, contra producción). Sus tres cubetas de hallazgos siguen vacías. |
| `docs/guion-demo-mesa-tickets.md` · `docs/presentacion-direccion.{md,html}` | Material de presentación a dirección. |
| `docs/junta-procesos-tickets.md` · `docs/layout-recoleccion-incidencias.md` | Insumos de descubrimiento: lo que se levantó en junta y el diccionario de campos para dar de alta un tipo nuevo. |
| `docs/cartera/{input,output}-analysis.md`, `mapping-matrix.md` | Contrato de datos del ETL (§5.4.9). |
| `docs/handoff/*.md` | Briefs de implementación (CART-001, OPS-001). Históricos. |
| `docs/ideas-agente-ia-asistente.md` · `docs/reclutamiento/README.md` | Brainstorm del asistente y detalle operativo de Reclutamiento. |
| Propuesta comercial (`.tex`, `.pptx`) | Material externo. **Conservar fuera del flujo dev**. |
| `docs/etl/{bruto,target}.xlsx` | Insumos reales de cartera usados para verificar el ETL. ⚠ **Sin trackear y sin ignorar**: son datos de clientes; si entran a un commit quedan en el historial de git para siempre. |

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
| Tickets — supervisión de todas las colas | Completo | Flag `profiles.supervisa_tickets` + `supervisa_mesa()`; selector de área en `/tickets/area` (mig. 70) |
| Tickets — flujo por tipo de problema | Completo | `problem_catalog.etiqueta_pausa` (`NULL` = sin pausa) + cierre directo de los presenciales en el trigger (mig. 71) |
| Tickets — autocierre de resueltos | Completo (cron sin verificar) | `tkt_cerrar_resueltos_vencidos(3)` + `pg_cron` a las 3:00 (mig. 72-73) |
| Tickets — bitácora y notificaciones | Completo (correos sin verificar) | `ticket_historial` por trigger + 9 avisos vía Gmail; remitente propio de la plataforma en variables de entorno (mig. 74-77) |
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
| Actividades — esquema y carga del Excel | Completo (ruta HTTP sin ejercitar) | `act_registros`/`act_cargas`/`act_empleados`/`act_puestos` + parser exceljs en `POST /api/actividades/cargar` (mig. 78-79) |
| Actividades — capa de consulta | Completo | RPCs `act_resumen` / `act_detalle` / `act_friccion`, verificadas contra el Power BI original (mig. 80-81) |
| Actividades — tableros | Completo | `/actividades`, `/actividades/personas`, `/actividades/friccion` + filtros en `searchParams` |
| Frontera de error de la app | Completo | `app/error.tsx` + `app/global-error.tsx` (UI-004, 2026-08-18) |
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
│ crediflexi-services (FastAPI en Render)         │
│   POST /cartera/procesar  [Bearer token]        │
│     → descarga Excel de Storage                 │
│     → ETL pandas (replica lógica legacy)        │
│     → bulk insert en stg_yunius_cartera_indiv.  │
│     → update cartera_uploads.estado=procesado   │
│                                                 │
│ Supabase                                        │
│   cartera_uploads (ledger)                      │
│   stg_yunius_cartera_individual (datos)         │
│   loan_amortizacion_individual (VACÍA — el      │
│     único gap real: bloquea drill-down y        │
│     liquidación anticipada)                     │
│   5 RPCs: resumen · coordinacion · recuperador  │
│           · mora_operativa · cohort             │
│                                                 │
│ /cartera/* dashboards                           │
│   ✅ resumen, coordinación, recuperador, mora,  │
│      cohortes + asistente Gemini flotante       │
│   ❌ falta: endpoints GET (CART-015), drill-down│
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
  → Mis tickets / Nuevo ticket (busca su problema; NO elige área)
  → ticket-form.tsx → tickets + responses + storage (cliente)
  → nace en la cola de su área, SIN responsable
  → Detalle: hilo + composer + guía contextual de su siguiente paso

[Quien atiende (pertenece al área)]
  → Cola del área → Tomar → responder, pausar, resolver, rechazar
    (motivo obligatorio), devolver a la cola o pasar a alguien del área

[Supervisor de la mesa (supervisa_tickets)]
  → Ve y toma de TODAS las colas, con selector de área — sin ser admin

[Operador Score (usuario + acceso_score)]
  → Sidebar oculta tickets (`esSoloOperadorScore`)
  → Acreditados CRUD + evaluación promotor (RPC)

[Operador Cartera (usuario + acceso_cartera)]
  → /cartera/cargar → upload + polling (fecha de corte automática = día anterior)
  → /cartera + coordinacion + recuperador + mora + cohort
  → asistente Gemini (widget flotante en todas las páginas de cartera)

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
| Tickets: notificaciones por correo | Completo (sin verificar) | 9 avisos vía Gmail (`lib/google`), best-effort. **Falta ver llegar un correo real** — diagnóstico en `GET /api/tickets/probar-correo` |
| Tickets: supervisión de la mesa | Completo | Flag `supervisa_tickets`: ve y **toma** de cualquier cola sin ser admin; `/tickets/area` con selector. Cierra TKT-007 como capacidad; falta la pantalla `/admin/tickets` |
| Tickets: flujo por tipo de problema | Completo | Pausa con nombre propio (`etiqueta_pausa`) o sin pausa; los tipos **presenciales cierran directo** sin pedir confirmación |
| Tickets: autocierre de resueltos | Completo (cron sin verificar) | `resuelto` sin actividad 3 días → `cerrado` a las 3:00, con actor "Sistema" en la bitácora. Los `programado` no se tocan |
| Tickets: remitente propio de la plataforma | Completo (sin verificar) | Cuenta emisora por módulo + `TICKETS_GOOGLE_REFRESH_TOKEN`/`TICKETS_SENDER_EMAIL` fuera de la BD. **Cambiarlo exige redesplegar** |
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

**Estado**: producción. UX bugs críticos cerrados 2026-05-25. **2026-07-28**: catálogo Sistemas/TI con prioridad/SLA/modalidad. **2026-08-01**: esa metadata se vuelve operable (listados con filtros, buscador y SLA visible) y se arregla que los adjuntos del hilo no se pudieran abrir. **2026-08-10 — el módulo pasa de individual a de equipo**: cola por área con self-assign, estados explícitos (muere la paridad), reasignación, bitácora por trigger, notificaciones por correo, guía contextual y un `/tickets/nuevo` donde el usuario **ya no elige área**. **2026-08-11/12 — la operación afina el modelo**: supervisión de todas las colas, pausa con nombre propio por tipo de problema, cierre directo de los presenciales, autocierre de resueltos y el remitente de correo sacado de la base de datos (§5.1.8).

**Archivos clave**: `app/(dashboard)/tickets/*`, `components/tickets/*`, **`lib/tickets/{sla,guia,correos}.ts`** (los tres puros y reutilizables), `lib/actions/tickets.ts`, `app/api/tickets/probar-correo/route.ts`, `scripts/google-token-plataforma.mjs`, migraciones 01-04, 07-09, 12, 54-55, **65-77**.

**Catálogo vivo**: 11 tipos en 4 áreas (Sistemas 6, Tesorería 2, Data Science 2, Call Center 1). La ficha completa —campos, obligatoriedad, prioridad, SLA, modalidad, pausa— vive en **`docs/catalogo-tickets.md`**, no aquí: el catálogo se edita desde `/admin/catalogo` sin desplegar, así que cualquier copia en este documento nacería desfasada.

**Pendientes**: verificar un envío real de correo, confirmar que las 8 migraciones del 11-12 de agosto están en remoto (y que el cron del autocierre quedó agendado), métricas sobre la bitácora, SEC-001 (Server Actions), RLS-001/002/004/005, UI-003/004, TKT-007 (falta la pantalla `/admin/tickets`; la capacidad ya está), TKT-008 (notas internas), paginación de listados.

**Relación con el plan**: las limitaciones originales de §5.1.1–5.1.4 (responsable fijo, paridad forzada, estado derivado) **ya se resolvieron** en las fases Tickets-Equipo y Tickets-Supervisión y flujo de `PLAN.md §2.2`. §5.1.1 se conserva como **retrato del modelo viejo** porque explica de dónde vienen las decisiones; el estado real vive en **§5.1.7 y §5.1.8**.

#### 5.1.1 Cómo funcionaba antes de agosto de 2026 *(histórico — no es el estado actual)*

> ⚠ **Esta subsección describe el modelo previo a la cola por área.** Se conserva porque §5.1.2–5.1.6 discuten sus limitaciones y sin él no se entiende qué se arregló. Para cómo funciona **hoy**, ir a §5.1.7 y §5.1.8.

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
| **TKT-005** | **Media** | **Parcial.** El SLA existe como `problem_catalog.sla_min` y se **muestra** (columna "Atención", coloreada por estado, con filtro "Vencidos"). Lo que sigue faltando es lo activo: **no avisa a nadie**, no escala y no hay métrica histórica de cumplimiento. **Trampa descubierta el 2026-08-12** (TKT-049): `sla_min = null` no significa "sin compromiso", significa **el reloj nunca corre** — el tipo no aparece en "Vencidos" ni en la cifra de la cola, así que el área deja de medirse sin que nadie lo note. Data Science se corrigió a 4 h; **Tesorería sigue en variable**. | `lib/tickets/sla.ts` · sin notificaciones |
| ~~**TKT-006**~~ | ~~Media~~ | ✅ **Resuelto 2026-08-01.** `ticket-list.tsx` (ahora client component) tiene filtros `Activos/Vencidos/Cerrados/Todos` con conteo y buscador sobre número, asunto, área y personas. Falta paginación — hoy se renderiza todo. | `components/tickets/ticket-list.tsx` |
| **TKT-007** | Baja | **A medias desde 2026-08-11.** TKT-043 entregó la *capacidad*: el flag `supervisa_tickets` deja ver y **tomar** tickets de cualquier cola sin ser admin del sistema, y `/tickets/area` gana un selector de área para quien lo tenga. Lo que falta es la pantalla `/admin/tickets` como tal (gestión y supervisión en un solo lugar); hoy se suple recorriendo colas. | mig. 70 · `app/(dashboard)/tickets/area/page.tsx` |
| **TKT-008** | **Media** | **Sin notas internas.** Todo mensaje es visible para el solicitante; no hay comentario privado entre agentes/admin. | `ticket_responses.tipo` sin tipo "interno" |
| ~~**TKT-009**~~ | ~~Baja~~ | ✅ **Resuelto 2026-08-10** por la cola por área: el ticket nace **sin responsable**, así que ya no existe el caso "se asigna al propio creador". `responsable_default_id` sigue en `problem_catalog` pero **ya no se usa** — limpiarlo cuando se toque el catálogo. *Texto original:* **Auto-asignación degenerada.** Si el catálogo no tiene `responsable_default_id`, el ticket se asigna al propio creador; el modelo de paridad colapsa y la "solicitud" no llega a nadie. | mig. 65 · `ticket-form.tsx` |
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
| **Cola/Bandeja de agente y de admin** | ✅ | ✅ (mios/asignados/cola del área + **supervisor que ve y toma de todas**), sin pantalla `/admin/tickets` | **Paridad funcional** (TKT-043; falta la pantalla) |
| **Notas internas (privadas)** | ✅ | ❌ | **Gap (TKT-008)** |
| Estados de ticket | ✅ | ✅ (explícitos, los controla el responsable) | **Paridad** |
| Flujo distinto por tipo de solicitud | A veces (planes altos) | ✅ (pausa con nombre propio o sin pausa, por tipo; presenciales cierran directo) | **Ventaja propia** |
| Cierre automático de inactivos | ✅ | ✅ (`resuelto` sin actividad 3 días → cerrado, vía `pg_cron`) | **Paridad** |
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

> **Estado al 2026-08-18:** de esa lista queda abierta **la seguridad de escritura** (SEC-001/RLS-*, punto 1b) — y solo eso. La cola global de admin (TKT-007) dejó de ser un gap funcional el 2026-08-11 con el supervisor de mesa; lo pendiente ahí es una pantalla, no una capacidad. El orden resultó bueno: los puntos 1-3 sí fueron los que cambiaron la naturaleza del módulo.
>
> **Y el patrón se repitió**: lo que la operación pidió después (§5.1.8) no fue ninguna de las capacidades del benchmark, sino **quitar flujo** (pausas que no aplicaban, confirmaciones de cierre que sobraban) y **arreglar que el correo saliera de la cuenta correcta**. La lista de un helpdesk genérico predijo bien la primera mitad del trabajo y nada de la segunda.

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

> **Nota (2026-08-18):** casi nada de esta validación se hizo. Los requisitos se construyeron igual y **acertaron** —la cola, los estados y las notificaciones sí eran lo que hacía falta—, pero lo que la operación pidió después (§5.1.8) no salió de esta lista: salió de mirar la mesa funcionando. El método sigue siendo bueno; el mocktest y las dos personas reales de `PLAN.md §0` son la forma barata de aplicarlo ahora.

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
   > ~~**Riesgo registrado:** las notificaciones las dispara cualquier usuario… la RPC `tkt_credencial_google` devuelve el `refresh_token` cifrado…~~ **Obsoleto desde el 2026-08-11.** La superficie se cerró del todo: la función se eliminó y el remitente vive en variables de entorno del servidor (§5.1.8, mig. 76). No hay RPC que llamar.

**Semántica del SLA (revisada).** El reloj corre mientras el área debe algo — `abierto` o `en_revision` — y se mide desde `created_at`. `programado` lo **pausa** a propósito: el trabajo ya se validó y espera a la siguiente tanda, así que la demora dejó de ser del técnico; `resuelto` también, porque ahí la pelota es del solicitante. **Las pausas no se acumulan**: un ticket reabierto vuelve a contar contra su hora original. Es la lectura estricta y defendible; acumular exige reconstruir desde `ticket_historial`, que es justo lo que la bitácora habilita.

> **Matiz agregado el 2026-08-11 (TKT-044):** la pausa dejó de llamarse siempre "Programado" — cada tipo de problema le pone su nombre (`etiqueta_pausa`) y quien no la necesita no la tiene. El cálculo no cambió: `lib/tickets/sla.ts` sigue parando el reloj en `programado`, solo que la UI lo llama como corresponda. Y **`sla_min = null` no es "sin compromiso" sino "el reloj nunca corre"** — ver TKT-005 en §5.1.2.

**El usuario no elige área.** `/tickets/nuevo` es un solo paso. La gente piensa en síntomas, no en organigramas, y el área siempre fue consecuencia del tipo de problema. Buscador insensible a acentos que indexa **también las opciones de los campos select** (ahí viven las frases reales: "instalar impresora"), tarjetas con ejemplos concretos tomados del catálogo, y atajos frecuentes anclados por fragmento de nombre para que renombrar un tipo nunca deje un link muerto.

**Deuda consciente:** las plantillas de correo y las frases frecuentes de tickets viven en el código, a diferencia de las de Reclutamiento, que se editan desde Ajustes. **Y los correos nunca se han enviado de verdad** — la ruta es la misma que Reclutamiento usa a diario, pero falta verlo llegar.

#### 5.1.8 Supervisión, flujo por tipo y remitente — arquitectura entregada (2026-08-11/12)

> **Documentado el 2026-08-18**, una semana tarde: el cierre del 11 de agosto solo alcanzó a registrar el pendiente de correos, así que estos siete tickets y sus ocho migraciones (70-77) quedaron fuera de ambos documentos. Reconstruido leyendo el SQL y el código.

**Qué cambió de fondo.** El modelo de equipo de §5.1.7 era correcto pero **uniforme**: la misma cola, el mismo flujo y la misma vista para los 11 tipos de problema. Operarlo de cerca reveló que ni el flujo ni la visibilidad podían ser iguales para todos, y destapó un bug de correo que llevaba meses latente.

**Decisiones cerradas (no re-litigar):**

1. **Supervisar es una capacidad, no un rol.** `profiles.supervisa_tickets` es un **flag**, no un valor nuevo del enum `rol`. Tres razones: es el patrón que el repo ya usa (`acceso_tickets`/`acceso_score`/`acceso_cartera`/`acceso_reclutamiento`, con su toggle en `/admin/usuarios`); `rol = 'admin'` ya otorga **más** (usuarios, catálogo, áreas, cartera) y meter un "superadmin" al enum dejaría dos nociones de admin compitiendo por `is_admin()`, que vive en media docena de políticas; y un flag es **ortogonal** — se puede supervisar la mesa sin poder tocar la configuración del sistema, que es justo lo que se quería. El supervisor también puede **tomar** de cualquier cola: ver una cola atascada sin poder destrabarla no sirve de nada.
2. **Un estado solo se justifica si alguien decide distinto al verlo.** El hallazgo que simplificó todo: *Programado*, *Esperando refacción* y *Esperando al usuario* **son la misma cosa** — el reloj se detiene porque la pelota dejó de ser del técnico. Solo cambia el nombre. Así que no se agregaron estados ni flujos paralelos: basta una **etiqueta por tipo** (`problem_catalog.etiqueta_pausa`) sobre el `programado` que ya existía, y `NULL` para quien no la necesita. Cinco de los seis tipos de Sistemas quedaron en dos clics: tomar → resolver. Si nadie va a filtrar por "esperando refacción", que el técnico lo escriba en el hilo.
3. **La confirmación de cierre depende de la modalidad, no del gusto.** Los tipos **presenciales** cierran directo al marcarse resueltos: si el técnico fue físicamente y lo arregló, el usuario ya vio que quedó, y pedirle que entre a confirmar es burocracia. En remotos la confirmación sí vale, porque nadie presenció el arreglo. Va en el trigger `handle_ticket_closure` y **no en la UI**, para que aplique venga por donde venga — composer, RPC o un update manual de admin.
4. **El limbo se cierra solo.** Un `resuelto` que nadie confirma se quedaba ahí para siempre: tickets ya atendidos que las métricas nunca cuentan como cerrados y una cola que deja de reflejar la realidad. `tkt_cerrar_resueltos_vencidos(3)` los cierra a los 3 días **medidos desde la última señal de vida del hilo**, no desde que se marcaron resueltos: si alguien escribió ayer, no se cierra hoy. Los `programado` **no se tocan** — ahí la espera es legítima. El cierre queda en la bitácora con actor `NULL`, que la UI muestra como "Sistema", distinguible de un cierre humano. El agendado va en **migración aparte** (73) para que, si el plan no trae `pg_cron`, falle sola sin arrastrar la lógica; el fallback es un cron externo.
5. **Cada módulo tiene su cuenta emisora.** Bug de diseño heredado: Reclutamiento y Tickets elegían credencial con `order by actualizado_at desc limit 1`, así que **conectar una cuenta para tickets le cambiaba en silencio el remitente a los correos de candidatos**. Se resolvió marcando para qué sirve cada credencial (`rec_credenciales_google.uso`, con `ambos` como default para no romper lo ya conectado).
6. **Un dato que se puede editar no es una garantía.** Mientras la credencial de tickets fue una fila de la BD, cualquiera con permisos podía reconectar y cambiar el remitente — **y pasó**: una conexión hecha con la sesión de Google abierta reemplazó la cuenta de plataforma por una personal, sin aviso. La cuenta emisora de la mesa pasó a variables de entorno (`TICKETS_GOOGLE_REFRESH_TOKEN` + `TICKETS_SENDER_EMAIL`): no hay pantalla que la toque, ni RLS que relajar, ni "última cuenta conectada" que gane. Reclutamiento se queda como estaba — ahí sí tiene sentido que el operador conecte la suya, porque esos correos salen de una persona.
   > **Consecuencia operativa:** el remitente ya no se configura desde la app. Cambiarlo exige regenerar el token con `scripts/google-token-plataforma.mjs` y **redesplegar** en Vercel; las variables nuevas no aplican a un deploy ya construido.
7. **Lo que falla en silencio necesita un lugar donde gritar.** El envío es best-effort por diseño, así que "no llegó el correo" puede ser falta de configuración, token inválido, rechazo de Gmail o simplemente que no había destinatarios — **y las cuatro se ven idénticas desde afuera**. `GET /api/tickets/probar-correo` (solo admin) recorre los cuatro pasos en orden y se detiene en el que falla, incluido el caso sutil de que el token sea de una cuenta distinta a la que declara `TICKETS_SENDER_EMAIL`.

**Estado de verificación.** Igual que el resto del módulo: **código entregado, nada probado contra la realidad.** No se ha visto llegar un correo, no se sabe si las 8 migraciones están en remoto ni si el cron quedó agendado, y el mocktest de `docs/mocktest-mesa-tickets.md` sigue con sus tres cubetas de hallazgos vacías.

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

**Lo que el ETL NO hacía** (gap del 2026-05-27, resuelto salvo el último punto):
- ~~No mapea todas las columnas~~ → ✅ **CART-001 (2026-05-30)**: `df_a_registros()` serializa 54 cols vía `EXCEL_TO_SCHEMA` + 7 derivadas, y **CART-016 (2026-06-17)** lo alineó al insumo real de Yunius (parcialidad fusionada, `"$ Último pago"`, detección de la fila de encabezado).
- ~~No autentica al caller~~ → ✅ **SEC-002 (2026-06-17)**: token compartido `INTERNAL_API_TOKEN` (Bearer + `compare_digest`, fail-closed).
- ❌ **No procesa amortizaciones** (`loan_amortizacion_individual` sigue vacía) — CART-003, el gap vivo.

#### 5.4.4 Plataforma — lo que tiene y lo que falta

> ⚠ **Escrita el 2026-05-27, antes de la capa de consulta y los dashboards.** El inventario de abajo describe el punto de partida, no el estado real; se conserva porque explica el orden en que se construyó. Para lo entregado, ver §4 y `PLAN.md §2.1` (fases Cartera-2 y Cartera-3).

**Tiene** (al 2026-05-27):
- `app/(dashboard)/cartera/cargar/page.tsx` + `components/cartera/upload-form.tsx` — UI drag-drop con polling.
- `app/api/cartera/upload/route.ts` — sube a Storage + crea `cartera_uploads`.
- `app/api/cartera/procesar/route.ts` — bridge al microservicio (valida `acceso_cartera`, llama POST).
- `app/api/cartera/uploads/route.ts` — lista uploads con auto-cleanup de timeouts >10 min.
- `app/(dashboard)/admin/cartera/page.tsx` — gestión admin de uploads.
- `app/(dashboard)/admin/usuarios/` con `cartera-accesos.tsx` — toggle `profiles.acceso_cartera`.

**Ya no falta** (entregado entre 2026-05-30 y 2026-06-15): los 5 RPCs de agregación (`cartera_resumen`, `por_coordinacion`, `por_recuperador`, `mora_operativa`, `cohort`), las 5 páginas de dashboard sobre ellos, y el asistente Gemini con tools. Los placeholders `/cartera/cobranza` y `/cartera/riesgo` se retiraron.

**Sigue faltando:**
- ❌ Endpoints GET `/api/cartera/*` que envuelvan los RPCs (CART-015) — hoy los consumen los Server Components directo.
- ❌ Drill-down crédito × cuotas y liquidación anticipada real — **bloqueados por `loan_amortizacion_individual` vacía** (CART-003), que es el único gap de datos que queda.
- ❌ Exportación Excel/CSV bajo demanda (CART-006 / DASH-013).
- ❌ Selector multi-corte (comparar fechas de corte) — DASH-012.
- ❌ Persistencia de las columnas de gestión de la bandeja de mora: hoy son **mock editable sin guardar**, con banner de "modo demostración". Es la feature que superaría al Excel (histórico de gestión entre cortes).

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

> Estado de la columna "Gap" actualizado al 2026-08-18 (la tabla original es del 2026-05-27, cuando nada de la capa de consulta existía).

| Vista del legacy | Equivalente en plataforma | Gap |
|------------------|---------------------------|-----|
| Excel completo con 12 hojas | — | No reemplazado como archivo — **por decisión**: la plataforma entrega dashboards, no un Excel mejor. Export bajo demanda = CART-006 / DASH-013 |
| `R_Completo` (74 cols) | tabla `stg_yunius_cartera_individual` | ✅ poblada completa (CART-001/016). Sin UI de listado crudo — nadie la ha pedido |
| Hoja con fecha del día | snapshot por `fecha_corte` | ✅ selector de fecha en todos los dashboards; la fecha de carga se fija sola al día anterior |
| Hojas mensuales (cohort por `Inicio ciclo`) | RPC `cartera_cohort` + `/cartera/cohort` | ✅ con frontera configurable (`fecha_inicio_ciclo` 100% poblado) |
| `X_Coordinación` (6 pivots) | RPC `cartera_por_coordinacion` + `/cartera/coordinacion` | ✅ tabla de riesgo + heatmap coord × 8 buckets |
| `X_Recuperador` | RPC `cartera_por_recuperador` + `/cartera/recuperador` | ✅ con filtro por coordinación. Falta "mi cartera" role-based (`profiles` sin `codigo_recuperador`) |
| `RECUPERADOR_000124` | filtro especial | Decisión pendiente del cliente: ya no se filtra al persistir |
| `Mora` + cols Call Center + Campo | RPC `cartera_mora_operativa` + `/cartera/mora` | ✅ la bandeja existe; **las columnas de gestión son mock sin persistir** — falta `cartera_seguimiento` |
| `Cuentas con saldo vencido` | filtro `saldo_vencido≥1 AND dias_mora≤0` | Query directa, falta UI. Nadie la ha pedido |
| `Liquidación anticipada` (VLOOKUP) | drill-down + cálculo | **Bloqueado por CART-003** (amortizaciones vacías) |
| `Cobranza`, `Asignación`, `Recuperación` (manuales) | módulo separado | Fuera de scope — fuentes externas al reporte que ingerimos |

**Conclusión (2026-08-18)**: de los tres faltantes originales —ETL completo, capa de consulta, capa de UI— **quedan cerrados los tres**. Lo único que sigue bloqueando paridad total es `loan_amortizacion_individual` vacía, que no depende de este repo sino de la fuente externa (CART-003).

#### 5.4.7 Decisiones de diseño confirmadas (sesión 2026-05-27)

- Legacy no se toca; queda como referente.
- Hojas mensuales = segmentación por `Inicio ciclo` (cohort), no por fecha de corte.
- Amortizaciones llegarán vía script externo TBD; no bloquean MVP de dashboards.
- Orden de dashboards: **snapshot ejecutivo → coord × PAR → recuperador → mora operativa → drill-down/liquidación**.
- Excel no se reemplaza con un Excel mejor: se reemplaza con dashboards interactivos. Si el usuario quiere Excel descargable, será derivable on-demand desde la UI.

#### 5.4.8 Riesgos y preguntas abiertas del módulo

| Tipo | Punto |
|------|-------|
| ~~Riesgo~~ | ~~ETL inserta solo 20/55 cols~~ ✅ cerrado (CART-001 + CART-016). |
| ~~Riesgo~~ | ~~Microservicio sin auth + sin deploy~~ ✅ cerrado (OPS-001 en Render + SEC-002 token compartido). |
| Riesgo | **Render Free duerme**: sin el wake-up de cron-job.org cada 10 min, la primera carga del día paga 30-60 s de cold start. Sigue pendiente del usuario. |
| Riesgo | Hojas mensuales del legacy dependen de hardcodes (`mes=4 año=2026`); la plataforma debe ser dinámica. ✅ resuelto con la frontera configurable de `cartera_cohort`. |
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

**Estado actual (2026-06-15, fase IA-A entregada — AI-001..004)**: **agente real**, ya no demo determinística.

- Gemini `gemini-2.5-flash` vía Vercel AI SDK, con **6 tools** sobre los RPCs de cartera (la de mora **seudonimizada**: código, saldos y días; sin nombres ni teléfonos).
- `lib/ai/knowledge-base.ts` — los 13 chunks de KB van completos en el system prompt (sin RAG vectorial: caben en contexto).
- **Widget flotante** (FAB + panel con modo pantalla completa, `Esc` para salir) en todas las páginas de cartera; `/cartera/chat` redirige a `/cartera` y el item se retiró del sidebar.
- Modo `AI_ASSISTANT_MOCK` para trabajar con datos sintéticos, y logging de tokens y costo estimado por pregunta.

> *Histórico:* la primera versión (PRO-004, 2026-06-04) fue una demo **determinística sin LLM** — retrieval por keyword overlap + plantillas de respuesta, con banner de "modo demo". Se sustituyó once días después.

**Decisiones 2026-06-09** (detalle en PLAN §4 "Asistente IA"):

- Stack: **Vercel AI SDK + Gemini API tier de pago** (nunca el tier gratuito de AI Studio — entrena con los datos). Escalado futuro a Vertex AI (ZDR + region pinning) = swap de provider.
- Fase A (PLAN §2.5): LLM + streaming + **tools que envuelven los 5 RPCs de cartera existentes** (los checks de permisos de los RPCs aplican al ejecutarse con la sesión del usuario). KB completa en el system prompt — sin RAG vectorial todavía.
- PII: tool de mora **seudonimizada** (códigos/saldos/días, sin nombres ni teléfonos) hasta visto bueno de cumplimiento (LFPDPPP / secreto financiero). El resto de tools son agregados sin PII.
- Guardrail: el agente nunca inventa cifras; todo número proviene de una tool y se cita con `fecha_corte`.

**Riesgos**: enviar PII a un tercero requiere validación de cumplimiento antes de habilitar el detalle de mora (AI-022); una API key creada sin billing cae en el tier gratuito (entrenamiento) — verificar tier antes de usar en producción.

### 5.6 Actividades *(alta 2026-08-18)*

**Alcance**: tablero directivo de **uso del tiempo** — en qué se le va el día al equipo, por dirección, gerencia, puesto, persona, categoría y actividad, más el bloque de "algo relevante" (positivo / contexto / fricción) con los comentarios que escribe la gente.

**Origen**: un Excel de 3 hojas (`tablas_uziel.xlsx`) y un tablero de Power BI hecho sobre él, entregado como `.pbix` por WhatsApp. El encargo fue portarlo a la plataforma "más ordenado".

**El hallazgo que definió la arquitectura**: el modelo del `.pbix` tiene **una sola tabla**, `MART_DIRECTIVO`, que es la hoja de hechos ya desnormalizada — los catálogos de empleados y puestos ni siquiera participaban del reporte. Todo lo que hacía DAX son sumas, conteos distintos y divisiones sobre una tabla plana. El módulo entra sin fricción en el patrón de cartera: **Server Component → RPC que devuelve el JSON agregado → filtros por `searchParams`**.

**Archivos clave**: `app/(dashboard)/actividades/*`, `components/actividades/{viz,filtros,carga-form}.tsx`, **`lib/actividades/{excel,periodo}.ts`** (puros), `app/api/actividades/cargar/route.ts`, migraciones **78-81**.

**Modelo de datos** (mig. `20260818130000`):

```
act_cargas (bitácora: qué archivo, qué periodos reemplazó, cuántas filas)
    └──< act_registros  (hechos: quién · qué actividad · cuántos minutos · periodo
                         + estructura organizacional desnormalizada
                         + bloque de motivo/comentario)
act_puestos ──< act_empleados   (catálogos, upsert; nunca se borran)
```

Tres decisiones de modelo que conviene no deshacer sin leer esto:

- **Las horas son columna generada** (`minutos / 60`). El Excel trae ambas y siempre coinciden; guardarlas por separado es programar el día en que dejen de hacerlo.
- **La estructura organizacional se guarda desnormalizada**, como viene en la hoja de hechos, en vez de resolverse por lookup contra `act_puestos`. Si alguien cambia de puesto, sus registros viejos deben seguir contando en el puesto que tenía cuando hizo el trabajo.
- **Los catálogos se conservan aunque el tablero no los use.** Son lo único que permite responder *quién no registró nada este periodo* — pregunta que la hoja de hechos no puede contestar y que dirección va a hacer.

**Las 8 medidas, verificadas contra el `.pbix` abierto antes de traducirlas.** Ancla: 452.50 h sin filtros / 239.33 h en agosto. Confirmadas: horas = `sum`; colaboradores y gerencias = `count(distinct)`; **% relevante y % fricción dividen entre las horas TOTALES**, no entre las relevantes (0.16 en agosto, no 0.37); participación = sobre el total visible; crecimiento = variación contra el periodo previo **con datos**.

**Dos defectos del original que se corrigieron a propósito** (documentados en el SQL para que nadie los "arregle" de vuelta):

1. Sin periodo seleccionado, el `.pbix` mostraba **1.12 de crecimiento** — comparaba julio+agosto contra junio+julio, y junio no existe. Un +112% inventado con apariencia de dato. Aquí el periodo siempre tiene valor y sin periodo previo el KPI es `null` → la UI pinta "—".
2. La matriz mostraba **"% Participación = 1.00" en las ocho direcciones**: el DAX dividía las horas de la dirección entre sí mismas. Una columna entera sin información. Ahora una dirección con 91.75 de 452.50 h se lee 20.3%.

**Color**: validado con herramienta, no elegido a ojo. Verde/rojo para positivo/fricción **se descartó** por dar ΔE 4.2 en deuteranopia; quedó azul `#1C5CAB` ↔ naranja `#D9531F`. Los colores crudos de marca **no funcionan como relleno de datos** — el navy `#0F1B3D` cae fuera de la banda de luminosidad y lee gris, el naranja `#F58220` no llega a 3:1 contra blanco — así que se usan pasos ajustados de esos matices. Las 12 categorías van a **heatmap secuencial de un matiz**, nunca a 12 colores.

**Seguridad**: bandera `profiles.acceso_actividades` (nace en `false`) + `has_actividades_access()` + guarda de módulo en el layout. Es el módulo que **más lo necesita**: muestra el tiempo de cada persona con nombre y apellido. Hoy quien ve también puede cargar; separar las dos cosas exige una segunda bandera y todavía no hay a quién dársela.

**Estado y deuda**:

- Los 120 registros cargados son **dummy** (`DUM0001…`, dos periodos, 30 de 80 empleados). Sirven para ver la forma, no para concluir nada.
- **`POST /api/actividades/cargar` no se ha ejercitado con sesión real** — los datos de prueba se insertaron por SQL directo. Es el único tramo de la cadena sin correr de punta a punta.
- La bandera no está dada a nadie: hoy el tablero solo lo ven los admin.

> **Lección transversal del 2026-08-18 (aplica a todo el repo).** El módulo salió a producción tronando en sus cuatro rutas: `etiquetaPeriodo` vivía en un archivo `'use client'` y las páginas de servidor la **llamaban**. En el App Router cada export de un módulo cliente es una referencia al cliente — renderizarla es válido, invocarla revienta. **`next build` no lo detecta**: las rutas dinámicas se compilan pero nunca se renderizan al construir. Regla: si una función la llaman los dos lados, no vive en un archivo con `'use client'`. Y pasar el build no es evidencia de que una página dinámica renderice.

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

- **CART-001 ✅ 2026-05-30** — ETL mapeaba solo 20 de ~55 campos. Resuelto con `EXCEL_TO_SCHEMA` (54 cols) + `DERIVED_TO_SCHEMA` (7), y afinado contra el insumo real en **CART-016 (2026-06-17)**.
- **CART-002 ✅** — `fecha_inicio_ciclo` se llena (verificado 100% poblado al validar `cartera_cohort`); habilitó la segmentación cohort.
- **CART-003 (Alta) — VIVO** — `loan_amortizacion_individual` vacía. Sin ella no hay drill-down de crédito ni liquidación anticipada real. **Es el único gap de datos que queda en cartera** y no depende de este repo: requiere la fuente externa del usuario (formato y disparador aún sin definir).
- **CART-004 ✅ 2026-06-02** — Capa de consulta entregada: 5 RPCs `security definer` con check de permisos. Falta solo envolverlos en endpoints GET (CART-015), que hoy no bloquea nada porque los consumen Server Components.
- **CART-005 (Baja)** — ~~`fecha_corte` se ingresa manualmente~~ → desde 2026-06-17 **se fija automáticamente al día anterior** (el insumo Yunius es el corte del día previo), lo que elimina el error de tecleo. Lo que sigue abierto es **validarla contra el contenido del Excel**.

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

- **OPS-001 ✅ 2026-05-30** — Microservicio desplegado en Render (Free + Docker + autoDeploy), smoke E2E productivo OK. Pendiente operativo del usuario: el wake-up de cron-job.org para evitar el cold start.
- **OPS-002 (Media)** — Parte 1 ✅ resuelta (2026-05-28): Supabase CLI v2.101 linkeado al proyecto, baseline de 22 migraciones repareadas, scripts `npm run db:new`/`db:push`/`db:status` operativos. Parte 2 pendiente: workflow GitHub Actions con `supabase db push` en CI.
- **OPS-003 (Baja) — parcial** — `.env.example` **sí existe** en la raíz, pero solo documenta 5 variables (Supabase, Gemini, microservicio). **Faltan las que hacen falta para desplegar**: `TICKETS_GOOGLE_REFRESH_TOKEN`, `TICKETS_SENDER_EMAIL`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_RECLUTAMIENTO_CLIENT_ID/SECRET`, `FACTORIAL_API_KEY`, `NEXT_PUBLIC_AUTH_EMAILS_EXTRA`, `SUPABASE_DB_PASSWORD`. Es la clase de hueco que muerde justo cuando urge (ver pendiente #1 de `PLAN.md §0`).

---

## 7. Deuda Técnica

> **Solo lo VIVO.** Lo cerrado se movió al bloque de abajo para que esta tabla se pueda leer como cola de trabajo y no como archivo histórico.

| ID | Tipo | Ubicación | Severidad | Recomendación |
|----|------|-----------|-----------|---------------|
| SEC-001 | Arquitectura | Mutaciones cliente en tickets/admin | **Alta** | Migrar `crearTicket`/`responderTicket` a Server Actions con Zod servidor. Bloqueante de PII real |
| RLS-001 | Seguridad | `ticket_attachments.insert` | **Alta** | Policy con `EXISTS` sobre participación en el ticket |
| RLS-005 | Seguridad | Storage `ticket-attachments` | **Alta** | Migración con políticas versionadas (hoy solo viven en el dashboard) |
| CART-003 | Datos | `loan_amortizacion_individual` | **Alta** | Integrar la fuente externa de amortizaciones. Único gap de datos vivo en cartera |
| RLS-002 | Seguridad | `profiles_select using (true)` | Media | Vista pública o restringir a admin |
| RLS-003 | Seguridad | Score historial/refs INSERT | Media | RPC única + validar capturador |
| RLS-004 | Seguridad | Responses en ticket cerrado | Media | Trigger `before insert` |
| DB-001/002 | Datos | Acreditado sin transacción | Media | RPC `upsert_acreditado` atómica |
| SEC-003 | Seguridad | Score editable vía API | Media | Trigger DB que recalcule `puntaje_total` |
| TYP-001 | Tipos | `database.types.ts` desfasado | Media | `npm run db:types` **después de cada `db push`** — nada lo importa, así que no truena al envejecer |
| OPS-002 | Operación | CLI local ✅, falta CI | Media | GitHub Action con `supabase db push` |
| OPS-003 | Operación | `.env.example` incompleto | Media | Documentar las 7 variables que faltan (ver §6) |
| API-001 | Arquitectura | `/api/cartera/procesar` síncrono | Media | Fire-and-forget al microservicio |
| DEB-001 | Tests | Sin framework | Media | Vitest + Playwright para los críticos |
| TKT-005 | Producto | SLA sin alertas ni escalación | Media | El SLA se ve y filtra, pero no avisa. Ojo: `sla_min = null` = el reloj nunca corre (Tesorería) |
| TKT-008 | Producto | Sin notas internas | Media | Todo mensaje del hilo lo ve el solicitante |
| CART-015 | API | Sin endpoints GET de cartera | Baja | Envolver los 5 RPCs. No bloquea: los consumen Server Components |
| CART-005 | Datos | `fecha_corte` no validada vs Excel | Baja | Validar al procesar (la fecha ya no se teclea a mano) |
| UI-003/004 | UX | `error=auth`, `error.tsx` faltantes | Baja | Añadir copy y boundaries |
| DB-003/004 | Datos | Diff espurio + mensajes RPC | Baja | Comparar refs y mapear errores |
| TKT-010 / UI-005 | Producto | Sin paginación en listados | Baja | Tickets y acreditados |

**Cerrados** (se conservan porque los IDs aparecen en commits y migraciones): `CART-001` ✅ 2026-05-30 · `CART-002` ✅ · `CART-004` ✅ 2026-06-02 · `CART-016` ✅ 2026-06-17 · `OPS-001` ✅ 2026-05-30 (Render) · `SEC-002` ✅ 2026-06-17 (token compartido, no HMAC) · `TKT-001/002/003/004/006/009` ✅ 2026-08-01/10 · `TKT-007` parcial ✅ 2026-08-11 (capacidad sí, pantalla no) · `UI-001/002` ✅ 2026-05-25.

---

## 8. Gaps y Features Pendientes

> **Sección retirada el 2026-08-18.** Era una **tercera** lista de pendientes que repetía §7 y `PLAN.md`, y para agosto ya listaba como pendientes 14 cosas entregadas entre mayo y junio (todo el ETL, los 5 dashboards, el deploy del microservicio, el agente IA). Tres listas que se contradicen no son tres fuentes: son cero.
>
> **Dónde vive cada cosa ahora:**
>
> - **Qué está roto o incompleto, con severidad** → §7 (deuda técnica), que se limpió a solo lo vivo.
> - **Qué se va a hacer y en qué orden** → `PLAN.md §0` (cola vigente) y `PLAN.md §2` (fases por módulo).
> - **Qué falta específicamente en tickets** → §5.1.2 y el benchmark de §5.1.3.
>
> Lo pendiente que no cabía en ninguna de las dos: **PRO-006** (dominio custom `tickets.financieracrediflexi.com`). **PRO-005** (Resend) quedó **descartado**: las notificaciones se resolvieron reusando Gmail (§5.1.7).

---

## 9. Recomendaciones Técnicas

> Reordenadas el 2026-08-18. Las tres primeras de la lista original (cartera primero, cerrar el ETL antes que los dashboards, HMAC contra el microservicio) **ya se ejecutaron o se descartaron a propósito** — se anotan al final para no perder el rastro.

1. **Verificar antes que construir.** Es la recomendación que manda. Tres módulos completos y ninguno probado end-to-end: el correo de tickets nunca se vio llegar, el smoke de reclutamiento nunca se corrió, el alta en Factorial sigue apagada. Cada semana de código nuevo agranda la superficie sin verificar. Los guiones existen (`docs/mocktest-mesa-tickets.md`); falta correrlos.
2. **Migrar tickets a Server Actions** progresivamente: empezar por `crear ticket` y `responder` (SEC-001). Es lo único de la lista de no-negociables de §5.1.4 que sigue abierto, y con PII real deja de ser opcional.
3. **Endurecer RLS de adjuntos y Storage en migración versionada** (RLS-001/005), no en el dashboard manual: lo que no está versionado no se puede revisar ni restaurar.
4. **`npm run db:types` después de cada `db push`**, y actualizar el inventario de §11 en el mismo movimiento. Los dos envejecen en silencio.
5. **`error.tsx` global + por sección** (tickets, score, cartera). Hoy un error de servidor es una pantalla blanca.
6. **Tests mínimos**: smoke E2E de login + crear ticket + crear acreditado + cargar cartera.
7. **Completar `.env.example`** con las 7 variables que faltan (§6, OPS-003). Sin secretos, solo los nombres — es lo que se consulta al desplegar.
8. **Poblar `loan_amortizacion_individual`** (CART-003): es lo único que separa a cartera de la paridad total con el legacy, y depende de una fuente externa, no de código.

*Ejecutadas o superadas:* cartera fue efectivamente el eje de mayo-junio y se cerró; el ETL sí se completó antes que los dashboards y el orden funcionó; el **HMAC se descartó a propósito** en favor de un token compartido (SEC-002) por sobre-ingeniería para tráfico interno server-to-server sobre HTTPS; las agregaciones de cartera ya viven en RPCs `security definer`, no en SELECT desde el cliente.

---

## 10. Preguntas Abiertas

> ~~1. ¿Dónde se desplegará el microservicio?~~ **Render**, desde 2026-05-30. · ~~3. ¿Qué LLM provider?~~ **Gemini de pago** vía Vercel AI SDK, decidido el 2026-06-09. · ~~4. ¿Notificaciones email antes de ampliar usuarios?~~ Sí, y ya están entregadas (falta verificarlas).

### Plataforma / transversales

1. ¿Las políticas Storage del bucket `ticket-attachments` en producción están abiertas o restringidas? (RLS-005 las quiere versionadas de todas formas)
2. ¿El algoritmo de score debe seguir replicando exactamente el GAS legacy o se puede iterar?
3. ¿Quién corre las migraciones SQL en producción (manualmente vs CI)? Hoy: a mano con `npm run db:push`.
4. **¿Tesorería quiere un compromiso de tiempo?** Sus dos tipos siguen con `sla_min = null`, lo que significa que **nunca vencen y no aparecen en las cifras de la cola**. Data Science ya se corrigió (4 h). Es una decisión de negocio, no técnica.
5. **¿Las tres pausas de "siguiente corte" comparten cadencia?** Tesorería y Data Science usan la misma etiqueta asumiendo que sus cortes coinciden. Nadie lo ha confirmado.
6. **¿Quién debe tener `supervisa_tickets`?** El flag existe y funciona; falta decidir a quién se le da (jefe de mesa, dirección) y dejarlo registrado.

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
| 69 | `20260810150100_tkt_notif_credencial.sql` | RPC `tkt_credencial_google` — refresh_token **cifrado** para que cualquier usuario dispare notificaciones *(función retirada en la 76)* |
| 70 | `20260811120000_tkt_supervisor_mesa.sql` | **Supervisor de la mesa**: `profiles.supervisa_tickets` + `supervisa_mesa()`; `select` de tickets/respuestas/adjuntos/historial y `tkt_tomar_ticket` lo admiten |
| 71 | `20260811150000_tkt_flujo_por_tipo.sql` | **Pausa por tipo**: `problem_catalog.etiqueta_pausa` (`NULL` = sin pausa) + `handle_ticket_closure` cierra directo los tipos **presenciales** + vista recreada con la etiqueta |
| 72 | `20260811170000_tkt_autocierre.sql` | `tkt_cerrar_resueltos_vencidos(dias)` — cierra los `resuelto` sin actividad en N días (default 3). Sin `execute` para `authenticated` |
| 73 | `20260811170100_tkt_autocierre_cron.sql` | Agenda el autocierre con **`pg_cron`** a las 3:00 UTC. **En archivo aparte a propósito**: si el plan no trae `pg_cron` falla sola y la 72 queda igual de aplicada |
| 74 | `20260811190000_tkt_credencial_por_uso.sql` | `rec_credenciales_google.uso` (`reclutamiento`/`tickets`/`ambos`) + índice único parcial; `tkt_credencial_google()` y `rec_credencial_google()` dejan de tomar "la más reciente" |
| 75 | `20260811210000_tkt_remitente_plataforma.sql` | `rec_credenciales_google.email` (validar remitente + header `From`); `tkt_credencial_google()` devuelve token **y** correo |
| 76 | `20260811230000_tkt_remitente_fuera_de_bd.sql` | **`drop function tkt_credencial_google()`** — el remitente de la mesa pasa a variables de entorno (`TICKETS_GOOGLE_REFRESH_TOKEN` + `TICKETS_SENDER_EMAIL`) |
| 77 | `20260812120000_tkt_data_science_sla.sql` | Data Science: `prioridad = 'alta'`, `sla_min = 240`. Con SLA nulo el reloj nunca corría y el área no se medía |

> **Estado 2026-08-18:** **77** migraciones locales. Las 69 primeras tenían par remoto al 2026-08-10; **las 8 de tickets del 11-12 de agosto no se verificaron contra remoto** — correr `npm run db:status` antes de asumir nada. Importa especialmente la **73**: si `pg_cron` no está en el plan, esa migración falla sola por diseño y el autocierre queda escrito pero nunca corre.
>
> **Este inventario se quedó desfasado 7 días** (decía 69 y afirmaba paridad total). Es exactamente el mismo modo de falla que el documento ya advertía para `database.types.ts`: un archivo que miente con cara de autoridad porque nada truena cuando se desactualiza. Actualizarlo es parte del cierre de cualquier sesión que toque `supabase/migrations/`.
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
| ¿Revisé las migraciones (al menos las críticas)? | Sí — eran 22 al escribir esto; hoy son **77** y el inventario §11 está completo (actualizado 2026-08-18). **Las 8 últimas no se han verificado contra remoto** |
| ¿Investigué el legacy y el microservicio? | Sí (README + research.md + plan.md del legacy, código del microservicio completo, schema Supabase) |
| ¿Distinguí "lo que existe" de "lo que se asume / hay que confirmar"? | Sí — §10 lista preguntas abiertas |
| ¿Documenté el estado real, no el aspirable? | Sí — Cartera marcada como ETL parcial + dashboards pendientes |
| ¿Identifiqué riesgos críticos? | Sí — RLS adjuntos, microservicio sin deploy, ETL incompleto |
| ¿IDs de tickets consistentes? | Sí — SEC, RLS, DB, UI, API, PERF, TYP, OPS, DEB, PRO, CART, DASH |

---

## 13. Módulo Reclutamiento *(S1..S9.5 + Sprint G implementados — 🚀 v1 en lanzamiento desde 2026-08-24)*

> Documentación de research del 4º módulo. **Estado 2026-08-04:** S1 (fundaciones), S2 (vacantes+candidatos), S3 (pipeline/DAG), **Sprint G (Google Workspace)**, **S4 (agendamiento masivo en cascada)**, **S5 (evaluaciones vía magic link)**, **S6 (comité + entrevistadores dinámicos + contratación)**, **S7 (`final_dg` + config de alta + correo interno de altas)**, **S7.5 (destinatarios editables + pipeline dinámico)**, **S9 (alta automática en Factorial HR — §13.9)** y **S9.5 (plantillas editables + bitácora de correos)** entregados. Todo el pipeline `postulado → … → contratado` está cubierto end-to-end y se opera desde el kanban.
>
> **Lo que falta no es código, es validación:** el smoke test end-to-end con correos de prueba nunca se corrió, y el alta en Factorial sigue apagada por interruptor. Pendiente **S10** (onboarding del candidato).
>
> **2026-08-24 — v1 en lanzamiento.** Se produjo el paquete de entrega en **`docs/reclutamiento/`** (manual de usuario, documentación funcional, runbook de operación, guion de pre-vuelo con criterio go/no-go, presentación y textos de anuncio). **Esa carpeta es la fuente de verdad operativa del módulo**; esta sección conserva el research y las decisiones de arquitectura. Factorial se lanza **apagado a propósito**; el anuncio va después del pre-vuelo, no antes.
> El plan de trabajo (modelo de datos, sprints, integraciones) vive en `PLAN.md §8`.

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
- ~~**`components/ui/*` es código muerto que rompe el build.**~~ **Borrado el 2026-08-18** junto con `components.json` y las 9 dependencias que solo él usaba. El diagnóstico era correcto y peor de lo que decía: el scaffolding importaba `@/lib/utils` (el helper `cn`, que nunca se creó) y `class-variance-authority` (que nunca se instaló), y `tailwind.config.ts` jamás tuvo los tokens CSS que shadcn necesita. Es decir, **no se rompió con el tiempo: nunca funcionó**, y en 265 commits nadie lo importó. Para diálogos se usan los primitivos de `@radix-ui/react-dialog` directamente, que es el único radix que quedó instalado. El repo entero usa Tailwind plano.

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
- **Design system de `context.md` inviolable** (naranja en 7 lugares, sin badges rellenos, tablas con divs+grid, Inter 400/500). El módulo reusa `components/layout/sidebar.tsx` (nueva sección gateada) y `header.tsx`. *(Corregido el 2026-08-18: esta línea decía que reusaba `components/ui/*`, y nunca fue cierto — ese scaffolding no tenía un solo import en todo el repo.)*
- **Reuso de Gemini**: el parsing de correos entrantes usa `@ai-sdk/google` (ya integrado en `app/api/ai/assistant/route.ts`) con un *structured output* (Zod) — **no web scraping** (ToS de OCC/LinkedIn/Computrabajo lo prohíben).

### 13.7 Integraciones externas (research)

| Integración | Scope / método | Estado | Nota |
|-------------|----------------|--------|------|
| **Gmail API** | OAuth de usuario (no service account / no DWD). Scopes `gmail.send` + `gmail.readonly`. Cuenta `reclutamiento@financieracrediflexi.com` | Greenfield | Refresh token encriptado en `rec_credenciales_google`. Setup 1 vez vía `/reclutamiento/admin/conectar-google` |
| **Calendar API** | Mismo proyecto OAuth, scope `calendar.events`. `attendees` = candidato + 3 entrevistadores; Meet vía `conferenceData.createRequest` | Greenfield | Eventos en el calendar personal de `reclutamiento@` por ahora; calendar compartido = v2 |
| **Parsing correos plataformas** | Polling Gmail `readonly` cada N min; identificar por sender/asunto (OCC/LinkedIn/Computrabajo); extraer con Gemini Flash + Zod → `rec_candidatos` | Greenfield | **NO scraping.** Webhook Pub/Sub solo si el polling no alcanza |
| **Factorial API** | Alta de empleado al contratar | ✅ **entregado 2026-07-31 (S9)** | API Key + SDK oficial. Detalle en §13.9 |
| **Google Cloud Console** | Nuevo proyecto o ampliar el de Gemini: habilitar Gmail + Calendar API, consent screen interno | Greenfield | **Validar al inicio del Sprint G**: si el Workspace restringe OAuth a apps externas, Manuel debe *whitelistear* el `client_id` una vez |

> ~~**Hoy el repo NO tiene integración con Google Workspace.** Gmail/Calendar son trabajo nuevo: el mayor riesgo/desconocido del módulo.~~
>
> **Obsoleto.** Era cierto al escribir esta sección (junio 2026). El Sprint G entregó la integración el **2026-07-07** (`lib/google/client.ts`, REST directo sin `googleapis`, `refresh_token` cifrado AES-256-GCM) y desde entonces manda correos en producción a diario. Tanto que **la mesa de tickets la reusó** en agosto en vez de agregar Resend — y ahí apareció el efecto secundario que nadie previó: los dos módulos se peleaban la misma credencial y el remitente se cambiaba solo (§5.1.8, decisiones 5-6). El riesgo del módulo no era construir la integración; era compartirla.

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
