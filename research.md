# Research Consolidado - mea-tickets (CrediFlexi)

**(Generado 2026-05-19 · Fase 1 + Fase 2 · workspace `mea-tickets`)**

> **Nota de alcance:** El brief de Fase 2 mencionaba **Viogi** (e-commerce, 6 `actions.ts`, `lib/products.ts`, visual search, Gemini, cart Zustand, Stripe/MercadoPago). **Ese código no existe en este repositorio.** Este documento es el Single Source of Truth del proyecto **real** abierto en Cursor: **mesa-tickets** — Mesa de Ayuda + Score Crediticio para Financiera CrediFlexi.

---

## 1. Resumen Ejecutivo

**mea-tickets** es una app interna Next.js 14 + Supabase en estado **usable en producción** para tickets operativos y captura/evaluación de acreditados (Score). El núcleo (auth corporativa, RLS base, flujos ticket/responsable, rechazo, onboarding, operadores Score con preset) está implementado y desplegado en `https://mesa-tickets.vercel.app`.

Los **riesgos principales** son de seguridad y UX operativa, no de “falta de app”: RLS permisivo en adjuntos y tablas auxiliares de score, mutaciones de tickets casi todas en **cliente** Supabase (superficie amplia si falla RLS), adjuntos iniciales invisibles en el hilo, errores silenciosos al crear tickets, y ausencia de `error.tsx` global. **No hay** pagos, carrito, catálogo público ni búsqueda visual — no aplican gaps de e-commerce.

**Prioridad inmediata recomendada:** (1) endurecer RLS de `ticket_attachments` y referencias/historial score, (2) feedback de errores en `ticket-form`, (3) mostrar/descargar adjuntos con `response_id` null, (4) mantener tipos Supabase al día con RPCs/migraciones.

---

## 2. Contexto del Proyecto - Descubierto

### Identidad

| Campo | Valor |
|-------|--------|
| Nombre npm | `mesa-tickets` v0.1.0 |
| Producto | Mesa de ayuda interna + **Score Crediticio** |
| Organización | Financiera CrediFlexi |
| Auth | Google OAuth + magic link; dominio `@financieracrediflexi.com` |
| Producción | `https://mesa-tickets.vercel.app` |
| Repo remoto | `github.com/uzzielvz/mesa-tickets` |

### Stack

- **Next.js 14.2.35** — App Router, React 18, TypeScript 5
- **Supabase** — Auth, Postgres, RLS, Storage (`ticket-attachments`)
- **UI** — Tailwind, Radix/shadcn, Sonner, Zod 4, react-hook-form (formulario score; tickets en su mayoría controlado)
- **Sin:** Stripe, MercadoPago, Gemini, embeddings, Zustand cart, carpeta `hooks/`, `app/api/*` de negocio (solo `auth/callback`)

### Estructura de carpetas

```
app/
  layout.tsx, page.tsx, globals.css, not-found.tsx
  (auth)/login/, auth/callback/route.ts
  onboarding/page.tsx
  (dashboard)/
    layout.tsx, dashboard/
    tickets/ (mios, asignados, nuevo, [numero])
    score/ (acreditados, nuevo, [numero]/editar)
    admin/ (catalogo, areas, usuarios, metricas, score/metricas)
components/
  tickets/, score/, admin/, onboarding/, layout/, brand/, ui/
lib/
  actions/acreditados.ts     ← única server actions de dominio (4 funciones)
  supabase/ (client, server, types)
  scoring/ (modelo.ts, types)
  schemas/, utils/
supabase/migrations/         ← 20260421* base + 20260424 scoring + 20260514* features
scripts/                     ← import SQL, verificar-setup, presets
middleware.ts
```

### Archivos críticos

| Archivo | Rol |
|---------|-----|
| `middleware.ts` | Sesión Supabase; `/login` y `/auth` públicos; resto exige usuario |
| `app/(auth)/auth/callback/route.ts` | OAuth code exchange + filtro dominio |
| `app/(dashboard)/layout.tsx` | Sidebar, redirect si `!area_id` → onboarding |
| `app/(dashboard)/admin/layout.tsx` | Solo `rol = admin` |
| `app/(dashboard)/score/layout.tsx` | `acceso_score` o admin |
| `lib/actions/acreditados.ts` | crear / actualizar / evaluar / eliminar acreditado |
| `lib/scoring/modelo.ts` | Algoritmo score HM (réplica GAS) |
| `components/tickets/ticket-form.tsx` | Crear ticket (cliente Supabase) |
| `components/tickets/response-composer.tsx` | Respuestas, rechazo, cierre |
| `supabase/migrations/*.sql` | Schema, RLS, vistas, triggers, RPCs |

### Documentación existente

| Archivo | Contenido |
|---------|-----------|
| `context.md` | Spec amplia MVP, diseño, fases |
| `plan-fase2.md`, `plan-fase5.md`, `plan-operaciones.md` | Planes por fase |
| `supabase/migrations/GUIA-SQL-SUPABASE.md` | Orden manual de migraciones |
| `README.md` | Plantilla create-next-app (poco útil) |
| **`research.md`** | Este documento |

### Integraciones

| Integración | Estado |
|-------------|--------|
| Supabase Auth + Postgres + RLS | Sí |
| Storage `ticket-attachments` | Usado en UI; políticas Storage no en repo |
| Vercel | Sí |
| Resend / notificaciones | Planificado en docs, no en código |
| Pagos / webhooks | No |

### Server Actions (real: 1 archivo, 4 exportaciones)

**No hay 6 archivos `actions.ts`.** Solo `lib/actions/acreditados.ts`:

1. `crearAcreditado`
2. `actualizarAcreditado`
3. `guardarEvaluacion` → RPC `guardar_evaluacion_promotor`
4. `eliminarAcreditado`

**Tickets y admin** mutan datos vía **cliente** `createClient()` en componentes, no Server Actions.

### Route Handlers (real: 1)

- `app/(auth)/auth/callback/route.ts` — **No existe** `visual-search` ni otros API routes.

---

## 3. Mapa de Arquitectura

### Módulos y estado

| Módulo | Tecnología | Estado | Notas |
|--------|------------|--------|-------|
| Auth + dominio corporativo | Supabase Auth + middleware | **Completo** | `error=auth` sin mensaje en login |
| Onboarding | RPC `complete_onboarding` + página | **Completo** | Layout fuerza si `!area_id` |
| Login presets (operadores Score) | `login_presets` + `handle_new_user` | **Completo** | Migración 09–10; RLS en presets |
| Mesa de tickets | Client Supabase + RLS + triggers | **Parcial** | Funcional; bugs UX/seguridad |
| Catálogo dinámico | `problem_catalog.campos` + `tickets.datos` | **Completo** | Admin + formulario |
| Rechazo responsable | enum + triggers + vista | **Completo** | Estado `rechazado` en vista |
| Score Crediticio | Server actions + RLS + modelo | **Parcial** | Producción OK; RLS/historial débil |
| Admin usuarios/áreas/catálogo | Client + RLS admin | **Completo** | Panel `/admin/usuarios` |
| Métricas tickets/score | Páginas admin | **Parcial** | Score métricas admin; sin `rechazado` en dashboard |
| Notificaciones email | — | **Pendiente** | En planes, no código |
| Pagos / checkout | — | **N/A** | No es e-commerce |

### Diagrama de flujos principales

```
[Usuario no autenticado]
    → /login (Google | magic link @financieracrediflexi.com)
    → /auth/callback (valida dominio)
    → si !profile.area_id → /onboarding (RPC complete_onboarding)
    → /dashboard

[Usuario estándar]
    → Mis tickets / Nuevo ticket (ticket-form → tickets + responses + storage)
    → Detalle ticket (hilo, response-composer)

[Responsable / Admin]
    → Asignados a mí, responder, terminar, rechazar

[Operador Score (usuario + acceso_score, sin admin)]
    → Dashboard solo Score (UI)
    → Acreditados CRUD + evaluación promotor (RPC)
    → Sin admin ni mesa tickets en menú

[Admin]
    → Todo lo anterior + Admin (usuarios, áreas, catálogo, métricas)
```

**No aplica:** Tienda → Cart → Checkout → Visual Search (Viogi).

---

## 4. Inventario de Features

| Feature | Estado | Observaciones | Criterios de completitud |
|---------|--------|---------------|---------------------------|
| Login Google + OTP | Completo | `hd` Google; logout `select_account` | Dominio filtrado en callback y cliente |
| Onboarding nombre+área | Completo | RPC security definer | `area_id` obligatorio para dashboard |
| Preset login operadores | Completo | `login_presets` | Rol + `acceso_score` al registrarse |
| Listar/crear tickets | Parcial | Sin toast si falla insert | RLS insert OK |
| Hilo y respuestas | Parcial | Paridad orden en DB; rechazo excepción | Triggers validan orden |
| Adjuntos tickets | Parcial | Suben a Storage; no se ven iniciales | Evidencia en creación |
| Rechazo con motivo | Completo | UI + enum + vista | — |
| Campos dinámicos catálogo | Completo | JSON `campos` + `datos` | Migración 04 |
| Score captura + cálculo | Completo | `modelo.ts` + persistencia | Zod + preview form |
| Evaluación promotor | Completo | RPC + UI | Justificación ≥10 chars |
| Editar/eliminar acreditado | Completo | RLS 08 + UI permisos | Operador score: todos |
| Admin usuarios/roles/score toggle | Completo | `usuarios-admin.tsx` | Solo admin layout |
| Admin catálogo/áreas | Completo | RLS mutate admin | — |
| Métricas admin score | Completo | `/admin/score/metricas` | Solo admin |
| Import masivo Excel | Parcial | Script `import-base-clientes.mjs` | Manual SQL |
| Notificaciones | Pendiente | En `context.md` | — |
| error.tsx por ruta | Pendiente | 0 archivos `error.tsx` | — |
| Tests automatizados | Pendiente | No en package.json | — |

---

## 5. Problemas Técnicos y Bugs Detectados

### App Router / Server vs Client

- **Tickets y admin en cliente:** `ticket-form.tsx`, `response-composer.tsx`, `catalogo-admin.tsx`, `usuarios-admin.tsx` usan `createClient()` del browser. La seguridad depende **100%** de RLS; no hay capa server centralizada ni validación Zod en servidor para tickets.
- **Middleware no valida onboarding:** Solo comprueba sesión; `area_id` se valida en `dashboard/layout.tsx`. Rutas bajo `(dashboard)` sin layout padre unificado para onboarding en todas las subrutas — score layout no revalida onboarding explícitamente (hereda del padre si misma árbol).

### Server Actions (`lib/actions/acreditados.ts`)

- **`crearAcreditado`:** Si insert de referencias falla, el acreditado **ya quedó creado** (sin transacción).
- **`actualizarAcreditado`:** `DELETE` referencias luego `INSERT`; si insert falla tras delete, registro sin referencias. Historial insert **sin comprobar error**. `contador_ediciones` incrementa aunque no haya cambios en campos comparados (solo excluye refs/score del diff).
- **`guardarEvaluacion`:** Mapeo parcial de errores RPC (`calificacion_invalida`, `no_auth` no traducidos).
- **Score manipulable:** `puntaje_total` y `clasificacion_modelo` se escriben desde action; usuario con `acceso_score` podría actualizar vía API directa sin recalcular (no hay trigger DB).

### RLS y Supabase

```114:116:supabase/migrations/20260421000002_rls_policies.sql
create policy "attachments_insert" on ticket_attachments
  for insert to authenticated
  with check (uploaded_by_id = auth.uid());
```

- **Adjuntos:** Cualquier autenticado puede insertar adjunto a **cualquier** `ticket_id` conocido (no valida participación en ticket).
- **`profiles_select` using (true):** Todos ven email/nombre/rol de todos los perfiles.
- **`acreditado_referencias` / `acreditado_historial` INSERT:** Solo `has_score_access()` — puede contaminar registros ajenos (migración 08 arregló update/delete acreditados, no insert historial).
- **Storage:** Sin políticas en migraciones del repo.
- **`ticket_responses` INSERT:** No bloquea si `tickets.closed_at` ya está definido (salvo lógica UI).

### Validación (Zod)

- **Score:** `acreditadoSchema` / `evaluacionSchema` en server actions.
- **Tickets:** `lib/schemas/ticket.ts` con `buildDatosSchema` **no usado** en `ticket-form` (validación manual duplicada).
- **Admin:** Validación mínima en cliente.

### Errores y loading

```132:134:components/tickets/ticket-form.tsx
    if (ticketError || !ticket) {
      setLoading(false)
      return
    }
```

- **Crear ticket:** Fallo silencioso (sin toast).
- **Login:** `?error=auth` no tiene copy (solo `error=domain`).
- **Sin `error.tsx`** en todo el proyecto.
- **Loading:** Varios `loading.tsx` en tickets/score; no en `tickets/nuevo`, admin, onboarding.

### Imágenes y Storage

- Subida a `ticket-attachments/{ticketId}/...`.
- **Hilo no muestra adjuntos sin `response_id`:**

```47:47:components/tickets/ticket-thread.tsx
        const respAttachments = attachments.filter(a => a.response_id === resp.id)
```

- Sin URLs firmadas / descarga en UI (solo nombre).

### Auth y sesiones

- Dominio validado en callback y login cliente (defensa en profundidad OK).
- **Middleware** redirige autenticados desde `/login` a `/dashboard` sin comprobar onboarding.
- **Operador solo Score:** UI oculta tickets; rutas `/tickets/*` siguen accesibles si conocen URL (RLS limita datos).

### Referencias y score (confusión de negocio, no bug)

- Referencias afectan solo variable **“Referencias personales”** (máx 5 pts, 3 escalones). Cambios frecuentes **no mueven** la letra A–D del modelo.
- **Evaluación promotor** es independiente (manual).

### Triggers y rechazo

- Migración `20260514000003` / `07`: `rechazo_responsable` **exento** de paridad impar/par en `validate_response_order`.
- `handle_ticket_closure` actualizado para cerrar en `rechazo_responsable` (migración 03/07).

### Performance

- Dashboard hace varias queries en server component (aceptable).
- `acreditado-form` recalcula score en `useMemo` (OK).
- Lista acreditados sin paginación.

### Código muerto / duplicado

- Migraciones `03` y `07` solapan funciones de vista (intencional para fix 42P16).
- `README.md` genérico vs `context.md` real.

### Items del brief Viogi — no aplican

| Buscado en brief | En repo |
|------------------|---------|
| 6× `actions.ts` | 1 archivo, 4 funciones |
| `lib/products.ts` | No existe |
| `visual-search` route | No existe |
| `ADMIN_SECRET` | No existe |
| Gemini / embeddings | No existe |
| cartStore / Zustand | No existe |
| i18n middleware | No existe |

---

## 6. Deuda Técnica

| Tipo | Ubicación | Severidad | Impacto | Recomendación |
|------|-----------|-----------|---------|---------------|
| Seguridad RLS | `ticket_attachments` insert | Alta | Adjuntos a tickets ajenos | Policy con EXISTS en ticket participante |
| Seguridad RLS | `profiles_select` | Media | Exposición PII interna | Restringir select |
| Seguridad RLS | score historial/refs insert | Media | Auditoría corrupta | Atar a capturador o RPC única |
| UX | `ticket-form` errores | Alta | Usuario no sabe si falló | toast + mensaje Supabase |
| UX | `ticket-thread` adjuntos | Alta | Evidencia inicial invisible | Sección `response_id IS NULL` |
| Arquitectura | Tickets vía cliente | Media | Superficie si RLS falla | Server Actions o RPC |
| Datos | `crearAcreditado` sin transacción | Media | Huérfanos sin refs | RPC única o compensación |
| Tipos | `lib/supabase/types.ts` | Baja | RPC sin tipar | `supabase gen types` |
| Docs | README vs context | Baja | Onboarding devs | README operativo |
| Tests | — | Media | Regresiones | Vitest/Playwright críticos |
| Storage policies | Supabase dashboard | Alta | Bucket abierto/errático | Migrar políticas Storage |

---

## 7. Gaps y Features Pendientes

**Prioridad alta (producto actual)**

1. Mostrar y descargar adjuntos (incl. creación).
2. Errores visibles en creación de ticket y login `error=auth`.
3. Endurecer RLS adjuntos + storage documentado en repo.
4. Bloquear respuestas en tickets cerrados (trigger o policy).

**Prioridad media**

5. Transacción/RPC para acreditado + referencias.
6. Paginación y búsqueda segura en lista acreditados (escapar PostgREST).
7. Dashboard/métricas con estado `rechazado`.
8. `error.tsx` y loading en rutas faltantes.
9. Regenerar tipos Supabase.

**Prioridad baja / roadmap (`context.md`)**

10. Notificaciones Resend.
11. Dominio custom `tickets.financieracrediflexi.com`.
12. Tests E2E flujos ticket y score.

**No aplican (Viogi / e-commerce):** pagos, checkout, orders, carrito, catálogo público, visual search.

---

## 8. Recomendaciones Técnicas

1. **RLS `attachments_insert`** + políticas Storage en migración versionada.
2. **`ticket-form`:** toast en error; rollback lógico si fallan responses/storage.
3. **`ticket-thread`:** bloque “Evidencia inicial” para `response_id === null` + signed URLs.
4. **Trigger:** prohibir `INSERT` en `ticket_responses` si `closed_at IS NOT NULL`.
5. **RPC `upsert_acreditado`** con transacción para fila + referencias + historial.
6. **Tipos:** incluir `complete_onboarding`, `guardar_evaluacion_promotor`, enums en `Database`.
7. **README** operativo: env, migraciones, URL producción, roles.
8. Mantener **`scripts/verificar-setup.sql`** tras cada release de migraciones.

---

## 9. Preguntas Abiertas

1. ¿Políticas de **Supabase Storage** actuales en producción (público vs autenticado)?
2. ¿Dominio custom `tickets.financieracrediflexi.com` ya apunta a Vercel?
3. ¿Notificaciones email son requisito antes de ampliar usuarios de tickets?
4. ¿Operadores Score deben poder abrir tickets por URL o bloqueo en middleware?
5. ¿El algoritmo score debe coincidir exactamente con Excel/GAS legacy (escalones referencias)?
6. **¿Existe otro repositorio Viogi** para documentar por separado?

---

## Auto-chequeo final (Fase 2)

| Pregunta | Respuesta |
|----------|-----------|
| ¿Leí todas las funciones clave? | Sí: `acreditados.ts` completo; `modelo.ts` completo; `middleware`, `auth/callback`, layouts score/admin/dashboard; `ticket-form`, `response-composer` (parcial+grep); RLS base + migraciones 05–10; triggers originales y rechazo. |
| ¿Seguí cadenas de llamadas? | Score: form → actions → Supabase/RPC; detalle → `calcularScore` UI. Tickets: form → client insert → storage → thread/composer. Auth: login → callback → layout onboarding. |
| ¿Validé RLS? | Sí en `20260421000002` + scoring + 06–08–10; gaps documentados. |
| ¿Inventé Viogi? | **No** — se documentó ausencia y se mapeó mea-tickets. |
| ¿Brief Viogi (6 actions, visual search)? | **No encontrado en repo** — no afirmado. |

---

*Fin del research consolidado.*
