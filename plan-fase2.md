# Plan Fase 2 — Auth + Layout

## Objetivo
Tener la app protegida, con login funcional por magic link y el shell visual completo (sidebar + header) listo para montar pantallas encima.

---

## Iteración 1 — Página de login

### Qué se construye
- `app/(auth)/login/page.tsx` — formulario con input de correo y botón de envío
- Validación en cliente: solo acepta `@financieracrediflexi.com`
- Al enviar llama a `supabase.auth.signInWithOtp()`
- Estado "enviado" — mensaje de confirmación en la misma pantalla

### Cómo se ve
```
┌─────────────────────────────┐
│  ● CrediFlexi / Tickets     │
│                             │
│  Acceder                    │
│  Te enviaremos un enlace... │
│                             │
│  Correo corporativo         │
│  [______________________]   │
│                             │
│  [Enviar enlace de acceso]  │
└─────────────────────────────┘
```

### Prueba
> Yo verifico: que el formulario aparezca bien, que el error de dominio salga,
> y que el correo de magic link llegue a mi bandeja.

---

## Iteración 2 — Callback de auth

### Qué se construye
- `app/(auth)/auth/callback/route.ts` — Route Handler que intercepta el magic link
- Intercambia el `code` por sesión con Supabase
- Redirige a `/dashboard` si todo está bien, a `/login` si hay error

### Prueba
> Yo verifico: hacer click en el magic link del correo y que aterrice en `/dashboard`
> (aunque todavía esté vacío).

---

## Iteración 3 — Layout del dashboard (sidebar + header)

### Qué se construye
- `app/(dashboard)/layout.tsx` — wrapper que verifica sesión activa, carga el profile del usuario
- `components/layout/sidebar.tsx` — navegación completa según el spec visual
- `components/layout/header.tsx` — título de página + subtítulo con metadata
- `components/brand/wordmark.tsx` — puntito naranja + "CrediFlexi / Tickets"

### Anatomía del sidebar
```
● CrediFlexi / Tickets

  Dashboard
  Mis tickets          3
  Asignados a mí       (solo si rol = responsable)

  ADMINISTRACIÓN       (solo si rol = admin)
  Catálogo
  Áreas
  Usuarios
  Métricas

────────────────────
  Avatar  Nombre
          Rol
```

### Reglas visuales aplicadas
- Sin iconos en nav — solo texto
- Item activo: fondo blanco, borde 0.5px, texto navy 500
- Item inactivo: transparente, texto #6B6B6B
- Contadores: muted por default, naranja solo si es el item activo con atención pendiente
- Sección "ADMINISTRACIÓN": 10.5px uppercase, solo visible para admin

### Prueba
> Yo verifico: que el sidebar se vea bien con mi usuario, que los items de admin
> aparezcan o no según el rol, y que el item activo se marque correctamente
> al navegar entre rutas.

---

## Iteración 4 — User menu + logout

### Qué se construye
- `components/layout/user-menu.tsx` — card en la parte baja del sidebar con avatar, nombre y rol
- Dropdown al hacer click: opción "Cerrar sesión"
- Server Action de logout que llama a `supabase.auth.signOut()` y redirige a `/login`

### Prueba
> Yo verifico: que mi nombre y rol aparezcan bien, que el logout funcione
> y me mande al login.

---

## Iteración 5 — Guards de ruta

### Qué se construye
- `middleware.ts` (ya existe) — revisar que protege correctamente todas las rutas
- `app/(dashboard)/admin/layout.tsx` — guard adicional que bloquea acceso a `/admin/*` si rol ≠ admin, redirige a `/dashboard`
- Página temporal `/dashboard/page.tsx` — placeholder "Bienvenido" para poder probar la navegación

### Prueba
> Yo verifico:
> - Entrar a la app sin sesión → redirige a `/login`
> - Entrar a `/admin/catalogo` con rol `usuario` → redirige a `/dashboard`
> - Entrar a `/admin/catalogo` con rol `admin` → permite el acceso

---

## Orden de ejecución

```
Iter 1 → tu confirmación
Iter 2 → tu confirmación
Iter 3 → tu confirmación
Iter 4 → tu confirmación
Iter 5 → tu confirmación
→ commit + push de toda la fase
```

Cada iteración termina con una vista clara de qué probar antes de continuar.
No avanzo a la siguiente sin tu OK.

---

## Archivos que se crearán

```
app/
  (auth)/
    login/page.tsx
    auth/callback/route.ts
  (dashboard)/
    layout.tsx
    dashboard/page.tsx       ← placeholder temporal
    admin/layout.tsx         ← guard de rol admin

components/
  brand/
    wordmark.tsx
  layout/
    sidebar.tsx
    header.tsx
    user-menu.tsx
```

## Lo que NO se hace en esta fase
- Nada de datos reales en el dashboard (eso es Fase 4)
- Nada de formularios de tickets (Fase 3)
- Nada de notificaciones
