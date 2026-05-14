# Plan Fase 5 — Performance, Bugs y Pulido

## Contexto

Diagnóstico completo del codebase terminado. Este plan absorbe:
- Pendientes de Fase 5 original (toasts, skeletons, 404, favicon)
- Todos los hallazgos del diagnóstico, priorizados por impacto

Orden de ejecución: de lo más crítico a lo cosmético.
Cada iteración es un commit separado.

---

## Iteración 1 — Performance crítico (P0)

**3 problemas que hacen la app lenta de raíz. Sin esto, todo lo demás es cosmético.**

### 1.1 — Eliminar `getUser()` duplicado en todas las pages

**Problema:** Middleware, layout y cada page hacen `supabase.auth.getUser()` por separado.
Para `/dashboard` eso son ~8 llamadas a Supabase antes de pintar nada.

**Fix:** Las pages del dashboard NO deben llamar `getUser()` por su cuenta.
El layout ya lo hace y pasa el perfil; las pages deben recibir el `userId` o hacer
una sola query directamente a la tabla, sin volver a autenticar.

Solución concreta: en cada page que hoy hace `getUser()` + query de perfil,
eliminar el `getUser()` y confiar en que si llegan aquí, el middleware ya validó la sesión.
Para obtener el userId dentro de la page, usar `(await supabase.auth.getUser()).data.user`
una sola vez solo si se necesita para un filtro de query — o mejor, pasar el userId
desde el layout como searchParam/cookie. En la práctica, el costo ya lo paga el middleware;
la segunda llamada en el layout es inevitable para obtener el perfil; pero la TERCERA
en cada page individual se puede eliminar.

**Archivos afectados:**
- `app/(dashboard)/dashboard/page.tsx` — eliminar `getUser()` y `profiles.select(rol, nombre_completo)`, usar los datos que ya están en el contexto de Supabase (la sesión ya está en la cookie)
- `app/(dashboard)/tickets/mios/page.tsx` — eliminar `getUser()` redundante
- `app/(dashboard)/tickets/asignados/page.tsx` — eliminar `getUser()` redundante
- `app/(dashboard)/tickets/[numero]/page.tsx` — eliminar `getUser()` redundante
- `app/(dashboard)/tickets/nuevo/page.tsx` — eliminar `getUser()` redundante
- `app/(dashboard)/admin/metricas/page.tsx` — eliminar `getUser()` redundante

Nota: la llamada del layout NO se puede eliminar porque necesita el perfil para el sidebar.
La del admin/layout tampoco porque necesita verificar el rol.

### 1.2 — Dashboard: dos queries filtradas en lugar de `select('*')` completo

**Problema:** `dashboard/page.tsx` descarga todos los tickets del sistema y filtra en JS.

**Fix:**
```ts
// En lugar de esto:
const { data: rawTickets } = await supabase.from('tickets_with_status').select('*')
const misTickets = tickets.filter(t => t.levantado_por_id === user.id)
const asignados = tickets.filter(t => t.responsable_id === user.id)

// Dos queries paralelas con filtro en DB:
const [{ data: rawMios }, { data: rawAsignados }] = await Promise.all([
  supabase.from('tickets_with_status').select('status').eq('levantado_por_id', user.id),
  supabase.from('tickets_with_status').select('status').eq('responsable_id', user.id),
])
```

Solo se necesita `status` para contar — no todos los campos.

### 1.3 — Crear ticket: eliminar segunda query

**Problema:** `ticket-form.tsx` inserta el ticket, obtiene `numero`, luego hace otra
query por `id`. Dos roundtrips donde debería ser uno.

**Fix:**
```ts
// Cambiar de:
.insert({...}).select('numero').single()
// Y luego buscar id por numero...

// A:
.insert({...}).select('id, numero').single()
// ticket.id y ticket.numero disponibles de una vez
```

**Archivos afectados:**
- `components/tickets/ticket-form.tsx:68-93`

### Commit de esta iteración
`perf: eliminar queries redundantes en dashboard y creación de tickets`

---

## Iteración 2 — Bugs funcionales (P1)

### 2.1 — Nombre real del usuario desde email

**Problema:** Usuarios cuyo trigger falló (o cuyo `nombre_completo` quedó vacío/como email)
se ven como "uzziel.valdez" en vez de "Uzziel Valdez".

**Fix:** Función `formatName` en `lib/utils/format.ts`:
```ts
export function formatName(nombreCompleto: string, email: string): string {
  const name = nombreCompleto?.trim()
  // Si tiene nombre real (con espacio, sin @) -> usarlo
  if (name && !name.includes('@') && name.includes(' ')) return name
  // Derivar del email o del nombre si parece username
  const username = (name && !name.includes('@') ? name : email.split('@')[0])
  return username
    .split('.')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}
// "uzziel.valdez" -> "Uzziel Valdez"
// "f.matus"       -> "F. Matus"
// "felix"         -> "Felix"
```

Aplicar en:
- `components/layout/user-menu.tsx` — nombre e iniciales del avatar
- `app/(dashboard)/dashboard/page.tsx` — "Hola, {nombre}"
- `components/tickets/ticket-thread.tsx` — autor de cada mensaje e iniciales

También se necesita un SQL en Supabase para corregir registros existentes con nombre vacío:
```sql
UPDATE profiles
SET nombre_completo = initcap(replace(split_part(email, '@', 1), '.', ' '))
WHERE nombre_completo IS NULL
   OR nombre_completo = ''
   OR nombre_completo = email;
```
(Se documenta aquí; el usuario lo corre en Supabase manualmente)

### 2.2 — Validar `requiere_evidencia` en submit

**Problema:** Si el tipo de problema requiere evidencia, el asterisco aparece pero el
ticket se crea sin adjunto sin ningún error.

**Fix** en `ticket-form.tsx:59-63`, agregar después de las validaciones existentes:
```ts
if (selectedProblem.requiere_evidencia && (!files || files.length === 0)) {
  setEvidenciaError('Debes adjuntar al menos un archivo')
  return
}
```
Y mostrar `evidenciaError` debajo del input de archivo.

### 2.3 — Upload paralelo de adjuntos

**Problema:** Los archivos se suben en serie (cada upload bloquea al siguiente).

**Fix** en `ticket-form.tsx` y `response-composer.tsx`:
```ts
// Cambiar el for...of await por Promise.all
await Promise.all(Array.from(files).map(async (file) => {
  const path = `${ticketId}/${Date.now()}-${file.name}`
  const { data: upload } = await supabase.storage.from('ticket-attachments').upload(path, file)
  if (upload) {
    await supabase.from('ticket_attachments').insert({ ... })
  }
}))
```

### 2.4 — Fix orden del composer en estado `terminado`

**Problema:** El textarea de "Reabrir" aparece después de los botones — confuso en mobile.

**Fix** en `response-composer.tsx:84-116`: reordenar JSX para que el textarea
esté antes de los botones cuando `isTerminado && esLevantador`.

### 2.5 — Métricas: filtrar por ID de área, no por nombre

**Problema:** `metricas/page.tsx` usa `t.area_nombre === area.nombre` — frágil si cambia el nombre.

**Fix:** La vista `tickets_with_status` tiene `problem_catalog_id` pero no `area_id` directo.
Solución: incluir `area_id` en la vista (requiere SQL), o hacer un join adicional.
Alternativa inmediata: mantener el filtro por nombre pero hacerlo case-insensitive y trim.
Alternativa correcta: agregar `area_id` a la vista `tickets_with_status` en Supabase.

Se documenta el SQL necesario y se aplica el filtro por nombre como solución provisional.

### Commit de esta iteración
`fix: nombre de usuario, validación de evidencia, uploads paralelos, orden del composer`

---

## Iteración 3 — Toasts y feedback de acciones (Fase 5)

**`sonner` ya está instalado. Solo falta configurarlo y usarlo.**

### 3.1 — Agregar `<Toaster />` al root layout

**Archivo:** `app/layout.tsx`
Importar `Toaster` de `sonner` y agregarlo al body. Una sola línea.

### 3.2 — Toast en `response-composer.tsx`

- Éxito al enviar respuesta: `toast.success('Respuesta enviada')`
- Error: `toast.error('Error al enviar. Intenta de nuevo.')`
- Éxito al marcar terminado: `toast.success('Ticket marcado como terminado')`
- Éxito al confirmar cierre: `toast.success('Ticket cerrado')`

### 3.3 — Toast en `areas-admin.tsx`

- Éxito al crear área: `toast.success('Área creada')`
- Error: `toast.error('No se pudo crear el área')`
- Toggle activo: `toast.success(area.activo ? 'Área desactivada' : 'Área activada')`

### 3.4 — Toast en `catalogo-admin.tsx`

- Éxito al guardar: `toast.success(editing ? 'Tipo actualizado' : 'Tipo creado')`
- Error silencioso actual → `toast.error('Error al guardar')`

### 3.5 — Toast en `usuarios-admin.tsx`

- Cambio de rol: `toast.success('Rol actualizado')`
- Cambio de área: `toast.success('Área actualizada')`
- Error: `toast.error('Error al guardar')`

### Commit de esta iteración
`feat(ux): toasts de feedback en todas las acciones con sonner`

---

## Iteración 4 — Loading states / Skeletons (Fase 5)

**Añadir `loading.tsx` en las rutas más pesadas para eliminar la pantalla en blanco.**

Next.js App Router: un `loading.tsx` al lado de `page.tsx` se muestra automáticamente
mientras la page hace sus queries (Suspense automático).

### 4.1 — Skeleton para listas de tickets

Archivo nuevo: `components/tickets/ticket-list-skeleton.tsx`
Muestra 5 filas de skeleton animado con `animate-pulse` en las mismas dimensiones
que `TicketList`.

### 4.2 — `loading.tsx` en las rutas principales

Rutas que necesitan loading (ordenadas por impacto):
- `app/(dashboard)/dashboard/loading.tsx` — 4 cards skeleton
- `app/(dashboard)/tickets/mios/loading.tsx` — usa `TicketListSkeleton`
- `app/(dashboard)/tickets/asignados/loading.tsx` — usa `TicketListSkeleton`
- `app/(dashboard)/tickets/[numero]/loading.tsx` — thread skeleton (3 mensajes)

Las rutas de admin son menos críticas pero también se benefician:
- `app/(dashboard)/admin/metricas/loading.tsx` — 5 stat cards skeleton

### Commit de esta iteración
`feat(ux): loading skeletons en dashboard, listas y detalle de ticket`

---

## Iteración 5 — Pulido final (Fase 5 + Fase 6 prep)

### 5.1 — Página 404 personalizada

Archivo: `app/not-found.tsx`
Diseño consistente: wordmark, mensaje "Página no encontrada", link a `/dashboard`.

### 5.2 — Favicon

Archivo: `app/favicon.ico` o `app/icon.tsx` (generado con Next.js Image Metadata).
Opción simple: un círculo naranja SVG como `app/icon.svg`.

### 5.3 — Metadata actualizada

`app/layout.tsx` ya tiene title y description básicos.
Agregar:
- `viewport` meta (ya lo hace Next.js por default en 14)
- `themeColor: '#F58220'` para mobile browsers
- `openGraph` básico (para cuando se comparta el link)

### 5.4 — Transición en drawer mobile

`components/layout/sidebar.tsx`: el drawer aparece sin animación.
Fix: usar `transition-transform` + `translate-x` en lugar de montaje condicional,
o agregar clases de Tailwind `animate-in slide-in-from-left` si el proyecto usa
`tailwindcss-animate` (que shadcn instala).

### 5.5 — Confirmación al cambiar rol de admin

`usuarios-admin.tsx`: interceptar cuando el nuevo rol es diferente al actual
y el perfil tiene rol `admin`. Mostrar confirmación nativa (`confirm()`) antes de guardar.
Simple y sin dependencias.

### 5.6 — Eliminar query `getNextOrder` con solución de DB

El orden de las respuestas actualmente requiere una query extra.
Alternativa: en lugar de numerar, usar `created_at` para ordenar.
O simplemente usar `count(*) + 1` embebido en la query de insert.
Solución más limpia: hacer que el número de orden lo calcule Supabase con un trigger
(documentado, el usuario lo aplica opcionalmente).

### Commit de esta iteración
`feat: 404 personalizado, favicon, metadata, transición drawer, confirmación de rol`

---

## Iteración 6 — Deploy y dominio (Fase 6)

### 6.1 — Verificación en Vercel

- Confirmar que todas las iteraciones anteriores desplegaron sin errores
- Revisar logs de build en Vercel
- Probar el flujo completo: login → dashboard → nuevo ticket → respuesta → cierre

### 6.2 — Dominio personalizado

Si el cliente tiene control de DNS de `financieracrediflexi.com`:
- Agregar dominio en Vercel: `tickets.financieracrediflexi.com`
- Agregar registro CNAME en el proveedor de DNS
- Actualizar en Supabase: agregar el nuevo dominio a Redirect URLs
- Actualizar en Google Cloud Console: agregar el nuevo dominio a Authorized redirect URIs

### 6.3 — SQL pendiente en Supabase (aplica el usuario)

```sql
-- Corregir nombres de usuarios con nombre vacío o igual al email
UPDATE profiles
SET nombre_completo = initcap(replace(split_part(email, '@', 1), '.', ' '))
WHERE nombre_completo IS NULL
   OR nombre_completo = ''
   OR nombre_completo = email;
```

No requiere cambios de código — solo ejecutar en el SQL editor de Supabase.

---

## Resumen de iteraciones

| # | Qué | Commit message | Impacto |
|---|-----|----------------|---------|
| 1 | Eliminar queries redundantes, dashboard filtrado en DB | `perf: eliminar queries redundantes en dashboard y creación de tickets` | Velocidad real |
| 2 | Nombre usuario, evidencia obligatoria, uploads paralelos, orden composer | `fix: nombre de usuario, validación de evidencia, uploads paralelos, orden del composer` | Bugs funcionales |
| 3 | Toasts en todas las acciones | `feat(ux): toasts de feedback en todas las acciones con sonner` | UX |
| 4 | Skeletons y loading states | `feat(ux): loading skeletons en dashboard, listas y detalle de ticket` | UX |
| 5 | 404, favicon, metadata, drawer, confirmación rol | `feat: 404 personalizado, favicon, metadata, transición drawer, confirmación de rol` | Pulido |
| 6 | Deploy verificación + dominio | — | Producción |

---

## Lo que NO se hace en este plan

- Notificaciones por email (Fase 7 post-demo con Resend)
- Paginación de tickets (el volumen esperado no lo requiere para el demo)
- Búsqueda global de tickets
- Tipos de Supabase generados automáticamente (`supabase gen types`) — se deja el cast manual hasta estabilizar el schema
- Modo oscuro
