`# Mesa de Ayuda — CrediFlexi`

 ``

`Sistema interno de tickets para gestión de incidencias operativas en Financiera CrediFlexi. Primer módulo de una plataforma de herramientas internas bajo el dominio corporativo.`

 ``

`---`

 ``

`## Objetivo del MVPya lo guarde`



 ``

`Tener una aplicación **funcional, pulida visualmente y lista para demo ejecutiva** en el menor tiempo posible. La prioridad es que Dupont (director de crédito) y el gerente de sistemas vean algo que parezca producto real, no prototipo.`

 ``

`**Criterio de éxito:** el demo debe sentirse como una app SaaS comercial — no como un proyecto de práctica.`

 ``

`## Ambición estratégica`

 ``

`Este proyecto no es solo una mesa de tickets. Es **el arranque de la plataforma digital moderna de CrediFlexi**:`

 ``

`1. **Primer módulo** de un conjunto de herramientas internas (simulador de crédito grupal, dashboards operativos, reportes, etc.)`

`2. **Design system base** que será reutilizado por todas las futuras apps internas`

`3. **Modelo de referencia** para eventualmente modernizar el sitio web corporativo`

`Toda decisión de arquitectura, componentes y estilo debe tomarse con esa visión en mente: lo que construimos aquí es reutilizable, extensible y representa la identidad visual de CrediFlexi hacia adelante.`

 ``

`---`

 ``

`## Stack`

 ``

`| Capa | Tecnología |`

`|------|-----------|`

`| Frontend + Backend | Next.js 14 (App Router, TypeScript) |`

`| Estilos | Tailwind CSS + shadcn/ui |`

`| DB + Auth + Storage | Supabase |`

`| Validación | Zod |`

`| Forms | React Hook Form |`

`| Deploy | Vercel |`

`| Dominio | tickets.financieracrediflexi.com |`

`| Notificaciones (Fase 2) | Resend |`

 ``

`**Razones:** control de acceso granular vía RLS de Supabase, deploy trivial en Vercel, auth corporativa por magic link con filtro de dominio, y la base de datos Postgres real (no un spreadsheet glorificado).`

 ``

`---`

 ``

`## Modelo de datos`

 ``

`### profiles`

`Extiende auth.users. Guarda rol, área, nombre visible.`

 ``

`| Campo | Tipo | Notas |`

`|-------|------|-------|`

`| id | uuid (PK, FK a auth.users) | |`

`| email | text unique | validado dominio @financieracrediflexi.com |`

`| nombre_completo | text | |`

`| rol | enum: admin, responsable, usuario | default usuario |`

`| area_id | uuid (FK areas) | nullable |`

`| activo | boolean | default true |`

`| created_at | timestamptz | |`

 ``

`### areas`

`Áreas de la empresa (Operaciones, Crédito, Sistemas, etc.)`

 ``

`| Campo | Tipo |`

`|-------|------|`

`| id | uuid PK |`

`| nombre | text unique |`

`| activo | boolean |`

 ``

`### problem_catalog`

`El catálogo central de tipos de problemas. **Core del sistema.**`

 ``

`| Campo | Tipo | Notas |`

`|-------|------|-------|`

`| id | uuid PK | |`

`| area_id | uuid FK | |`

`| nombre | text | ej: "Ticket no reflejado" |`

`| leyenda | text | explicación larga que se muestra al usuario al seleccionar |`

`| responsable_default_id | uuid FK profiles | quién atiende por default |`

`| requiere_grupo | boolean | qué campos pedir al levantar ticket |`

`| requiere_cliente | boolean | |`

`| requiere_ciclo | boolean | |`

`| requiere_evidencia | boolean | |`

`| activo | boolean | |`

 ``

`### tickets`

`| Campo | Tipo | Notas |`

`|-------|------|-------|`

`| id | uuid PK | |`

`| numero | bigserial unique | **incremental global visible (#1527)** |`

`| problem_catalog_id | uuid FK | |`

`| levantado_por_id | uuid FK profiles | |`

`| responsable_id | uuid FK profiles | copiado de catálogo al crear, mutable por admin |`

`| grupo | text | nullable |`

`| cliente | text | nullable |`

`| ciclo_cliente | text | nullable |`

`| created_at | timestamptz | |`

`| closed_at | timestamptz | null = no cerrado |`

 ``

`### ticket_responses`

`Hilo de respuestas. La regla par/impar aquí es crítica.`

 ``

`| Campo | Tipo | Notas |`

`|-------|------|-------|`

`| id | uuid PK | |`

`| ticket_id | uuid FK | |`

`| orden | int | 1-indexed, incremental por ticket |`

`| autor_id | uuid FK profiles | |`

`| contenido | text | |`

`| tipo | enum: mensaje, terminado_responsable, terminado_usuario | |`

`| created_at | timestamptz | |`

 ``

`**Restricción:** orden impar debe ser del levantado_por_id, par del responsable_id. Se valida en trigger.`

 ``

`### ticket_attachments`

`| Campo | Tipo |`

`|-------|------|`

`| id | uuid PK |`

`| ticket_id | uuid FK |`

`| response_id | uuid FK nullable |`

`| storage_path | text |`

`| nombre_original | text |`

`| mime_type | text |`

`| size_bytes | bigint |`

`| uploaded_by_id | uuid FK |`

`| created_at | timestamptz |`

 ``

`### Estatus derivado (view)`

 ``

`No se guarda en columna. Se calcula vía vista SQL tickets_with_status:`

 ``

````sql`

`CASE`

  `WHEN closed_at IS NOT NULL THEN 'cerrado'`

  `WHEN ultima_respuesta.tipo = 'terminado_usuario' THEN 'cerrado'`

  `WHEN ultima_respuesta.tipo = 'terminado_responsable' THEN 'terminado'`

  `WHEN ultima_respuesta.orden IS NULL THEN 'abierto' -- ticket recién creado, sin respuestas`

  `WHEN ultima_respuesta.orden % 2 = 1 THEN 'abierto'`

  `WHEN ultima_respuesta.orden % 2 = 0 THEN 'contestado'`

`END`

`````

 ``

`---`

 ``

`## Row Level Security (RLS)`

 ``

`**Todas las tablas con RLS activo.** Policies:`

 ``

`### tickets`

`- SELECT: auth.uid() = levantado_por_id OR auth.uid() = responsable_id OR is_admin(auth.uid())`

`- INSERT: cualquier usuario autenticado (como levantado_por_id = auth.uid())`

`- UPDATE: solo admin puede modificar campos estructurales (responsable, etc.)`

`### ticket_responses`

`- SELECT: heredada — si puedes ver el ticket, puedes ver sus respuestas`

`- INSERT: solo levantado_por_id o responsable_id del ticket, validando paridad del orden`

`- UPDATEDELETE: nunca (los hilos son inmutables)`

`### problem_catalog, areas, profiles`

`- SELECT: todos los autenticados (necesario para dropdowns)`

`- INSERTUPDATEDELETE: solo admin`

`### Helper function`

````sql`

`create function is_admin(user_id uuid) returns boolean`

`as $$ select exists(select 1 from profiles where id = user_id and rol = 'admin') $$`

`language sql security definer stable;`

`````

 ``

`---`

 ``

`## Autenticación`

 ``

`- **Magic link** a correo corporativo`

`- **Hook de validación de dominio:** rechaza cualquier email que no termine en @financieracrediflexi.com`

`- Al primer login, se crea automáticamente un profile con rol = 'usuario'`

`- El admin promueve a responsable o admin desde el panel de administración`

`---`

 ``

`## Rutas y pantallas`

 ``

`### Autenticación`

`- /login — input de correo + botón "Enviar magic link"`

`- /auth/callback — handler del magic link`

`### Dashboard (autenticado)`

`- / — redirige a /dashboard`

`- /dashboard — resumen: cards con contadores (mis tickets abiertos, asignados pendientes, contestados esperando mi respuesta)`

`- /tickets/nuevo — formulario de levantamiento`

`- /tickets/mios — tickets que levanté`

`- /tickets/asignados — tickets que me asignaron (solo si rol = responsable)`

`- /tickets/[numero] — detalle con hilo completo y composer de respuesta`

`### Admin (solo rol admin)`

`- /admin/catalogo — CRUD del catálogo de problemas`

`- /admin/areas — CRUD de áreas`

`- /admin/usuarios — gestión de roles y áreas`

`- /admin/metricas — dashboard simple: volumen, tiempo promedio de respuesta, tickets por área`

`---`

 ``

`## Flujos principales`

 ``

`### Levantar ticket`

`1. Usuario entra a /tickets/nuevo`

`2. Dropdown de **área** → filtra`

`3. Dropdown de **tipo de problema** (del catálogo, filtrado por área)`

`4. Al seleccionar tipo, **aparece la leyenda** en un card destacado`

`5. Se muestran solo los campos requeridos por ese tipo (grupo, cliente, ciclo)`

`6. Campo de **comentario inicial** (obligatorio)`

`7. Uploader de **evidencia** (imágenes, opcional o requerido según el tipo)`

`8. Submit → se crea ticket + primera respuesta (orden 1, tipo mensaje) + attachments`

`9. Redirige a /tickets/[numero] con toast de confirmación`

`### Responder ticket`

`1. Desde /tickets/[numero] se ve el hilo en formato conversación`

`2. Si eres el que levantó o el responsable, ves el composer abajo`

`3. Escribes respuesta + adjuntos opcionales`

`4. Al enviar, el backend determina automáticamente el siguiente orden y valida que corresponde a tu rol`

`### Cierre doble`

`1. Responsable, después de responder, ve botón "**Marcar como Terminado**"`

`2. Al hacer click, se inserta una respuesta especial con tipo = 'terminado_responsable'`

`3. El usuario que levantó ve el ticket como "Terminado" y tiene dos botones:`

`- "**Confirmar cierre**" → inserta tipo = 'terminado_usuario', actualiza closed_at`

`- "**Reabrir**" → inserta una respuesta normal (orden impar), el estatus vuelve a "abierto"`

`---`

 ``

`## Diseño visual — aprobado y no negociable`

 ``

`Esta sección define el sistema visual exacto. **Claude Code debe seguirlo al pie de la letra.** El estilo aprobado es minimalista, casi ascético — inspirado en Linear, Vercel Dashboard, Stripe Docs. El color es escaso e intencional, nunca decorativo.`

 ``

`### Principio rector`

 ``

`> **El color entra solo cuando agrega información. Nunca como decoración.**`

 ``

`Si una interfaz se ve "incompleta" sin color, falta jerarquía tipográfica. La solución nunca es agregar más color — es mejorar el contraste de pesos, tamaños y grises.`

 ``

`### Tokens de color — source of truth`

 ``

````css`

`/* Brand */`

`--color-navy: #0F1B3D;              /* Títulos, IDs, identidad CrediFlexi, avatar usuario */`

`--color-orange: #F58220;            /* ÚNICO acento de marca — uso ESTRICTAMENTE limitado */`

 ``

`/* Backgrounds */`

`--color-bg-primary: #FFFFFF;        /* Área principal */`

`--color-bg-sidebar: #FAFAF9;        /* Sidebar — levemente distinto del main */`

`--color-bg-hover: #F5F5F5;          /* Hover sutil en filas y elementos interactivos */`

 ``

`/* Texto */`

`--color-text-primary: #111111;      /* Texto fuerte — títulos de filas, datos clave */`

`--color-text-body: #4A4A4A;         /* Texto medio — contenido tabular */`

`--color-text-secondary: #6B6B6B;    /* Navegación inactiva, labels */`

`--color-text-muted: #9B9B9B;        /* Timestamps, subtítulos, metadatos */`

 ``

`/* Bordes */`

`--color-border: #ECECEC;            /* Divisores principales, bordes de cards */`

`--color-border-subtle: #F5F5F5;     /* Divisores entre filas de tabla */`

 ``

`/* Estatus — solo los puntitos (●), nunca fondos rellenos */`

`--status-abierto: #2563EB;          /* Azul */`

`--status-contestado: #C88A04;       /* Ámbar */`

`--status-terminado: #F58220;        /* Naranja (coincide con brand) */`

`--status-cerrado: #15803D;          /* Verde */`

 ``

`/* Feedback (usar con extrema moderación) */`

`--color-danger: #DC2626;`

`--color-success: #15803D;`

`````

 ``

`### Reglas ESTRICTAS de uso del naranja`

 ``

`El naranja #F58220 es la firma de la marca. **Solo puede aparecer en los siguientes lugares**, nunca en otros:`

 ``

`1. Puntito de 6px al lado del wordmark "CrediFlexi" en el sidebar`

`2. Contador del item activo en sidebar cuando hay atención pendiente (ej: "8")`

`3. Fragmento accionable en subtítulos (ej: "8 requieren tu atención")`

`4. Botón primario de acción (uno por pantalla máximo)`

`5. Underline de 1.5px en la tab activa de filtros`

`6. Puntito (●) del estatus "Terminado" en tablas`

`7. Focus ring de inputs (naranja a 40% opacity)`

`**Prohibido:** backgrounds rellenos naranjas, gradientes, iconos naranjas, texto decorativo naranja, borders naranjas (excepto focus), badges con fondo naranja.`

 ``

`### Tipografía — Inter, dos pesos`

 ``

`**Fuente única:** Inter (self-hosted vía next/font/google). Fallback: -apple-system, system-ui, sans-serif.`

 ``

`| Elemento | Tamaño | Peso | Color | Notas |`

`|----------|--------|------|-------|-------|`

`| h1 (título de página) | 22px | 600 | navy | letter-spacing: -0.4px |`

`| h2 (secciones) | 16px | 600 | navy | letter-spacing: -0.2px |`

`| Label de navegación activo | 13px | 500 | navy | — |`

`| Label de navegación inactivo | 13px | 400 | text-secondary | — |`

`| Columna headers (TICKET, ASUNTO) | 11px | 500 | text-muted | uppercase, letter-spacing: 0.3px |`

`| Título de fila (asunto ticket) | 13px | 500 | text-primary | — |`

`| Subtítulo de fila (metadata) | 11.5px | 400 | text-muted | — |`

`| ID de ticket (#1527) | 12px | 500 | navy | font-mono |`

`| Responsable | 12.5px | 400 | text-body | — |`

`| Timestamp | 12px | 400 | text-muted | — |`

`| Estatus | 12px | 500 | text-primary | con puntito de color |`

`| Botón primario | 12.5px | 500 | white | sobre naranja |`

`| Texto de sistema secundario | 11px | 400 | text-muted | empty states, footers |`

 ``

`**Reglas:**`

`- Dos pesos únicamente: 400 y 500. Nunca 600 excepto en h1/h2.`

`- Nunca uppercase excepto column headers y labels de sección del sidebar.`

`- Nunca italic.`

`- Line-height por default: 1.4 (data) / 1.5 (prosa).`

`### Iconografía — reducida al mínimo`

 ``

`La interfaz aprobada **NO usa iconos en el sidebar**. Jerarquía por tipografía y espaciado.`

 ``

`Iconos permitidos (todos de Lucide, stroke 1.5, 14-16px):`

`- Breadcrumb separator: ChevronRight en gris claro`

`- Dropdown caret: ChevronDown`

`- Upload/download: Upload, Download (solo en contextos de archivo)`

`- Adjuntar: Paperclip (en composer)`

`- Cerrar: X (en modales)`

`- Búsqueda: Search (en input de buscar)`

`**Prohibido:** iconos decorativos en navegación, iconos en botones primarios, iconos en headers de columna, iconos de estado (usar puntitos en su lugar).`

 ``

`### Componentes — anatomía exacta`

 ``

`#### Sidebar (220px fijo)`

`- Background: #FAFAF9`

`- Border-right: 0.5px solid #ECECEC`

`- Padding: 20px 14px`

`- **Branding arriba:** puntito naranja 6px + "CrediFlexi" (15px/600/navy) + "/ Tickets" (11px/400/muted)`

`- **Nav items:** padding 6px 10px, border-radius 5px, font-size 13px`

`- **Item activo:** background blanco, border 0.5px solid #ECECEC, texto navy peso 500`

`- **Item inactivo:** background transparente, texto #6B6B6B peso 400`

`- **Contadores a la derecha:** 11px, muted por default, naranja solo si es el item activo y hay atención pendiente`

`- **Sección header ("ADMINISTRACIÓN"):** 10.5px, uppercase, letter-spacing 0.4px, padding-top 20px`

`- **User card abajo:** avatar 28px circular navy + nombre + rol, separado por border-top sutil`

`#### Header de página`

`- Padding: 36px 36px 24px`

`- h1 + subtítulo con metadata accionable (naranja solo en el fragmento de atención pendiente)`

`- Sin breadcrumb visible en MVP (está implícito en el sidebar activo)`

`#### Tabs de filtros`

`- Underline style — NO pills, NO backgrounds, NO borders`

`- Activa: texto navy 500, border-bottom: 1.5px solid #F58220`

`- Inactivas: texto #6B6B6B 400, sin border`

`- Contadores en gris muted al lado de cada label`

`#### Tabla`

`- **Sin card envolvente.** Solo divisores horizontales.`

`- Grid CSS con columnas fijas definidas en el layout`

`- Column headers: 11px uppercase muted con letter-spacing 0.3px`

`- Filas: padding vertical 14px, border-bottom 0.5px solid #F5F5F5`

`- Última fila: sin border-bottom`

`- Hover en fila: background #FAFAF9 (muy sutil)`

`- Click en fila: navega al detalle del ticket`

`- **NO usar table HTML, usar <div> con CSS grid** — más flexible con shadcn`

`#### Estatus (en tabla)`

`Formato: <puntito color> <texto> — ambos inline, mismo tamaño.`

````html`

`<span><span style="color:#2563EB">●</span> Abierto</span>`

`````

`- Abierto: puntito azul, texto primary`

`- Contestado: puntito ámbar, texto primary`

`- Terminado: puntito naranja, texto primary`

`- Cerrado: puntito verde, texto **muted** (señal visual de "cerrado/archivado")`

`#### Botón primario`

`- Background: #F58220`

`- Color: #FFFFFF`

`- Padding: 7px 14px`

`- Border-radius: 6px`

`- Font: 12.5px/500`

`- **Sin sombra, sin borde, sin gradiente.**`

`- Hover: background #D66A10 (pressed/dark)`

`- Uno solo por pantalla.`

`#### Botón secundario`

`- Background: transparent`

`- Border: 0.5px solid #ECECEC`

`- Color: #111111`

`- Mismo padding/radius/font que primario`

`- Hover: background #F5F5F5`

`#### Inputs`

`- Background: #FFFFFF`

`- Border: 0.5px solid #ECECEC`

`- Border-radius: 6px`

`- Padding: 7px 12px`

`- Font: 13px`

`- Focus: border naranja + ring rgba(245,130,32,0.15) de 3px`

`#### Footer de tabla`

`- Padding: 20px 36px 28px`

`- Texto 12px muted`

`- Botones "Anterior" / "Siguiente" sin border, solo color (muted / navy 500)`

`### Layout general`

 ``

`````

`┌─────────────────────────────────────────────────┐`

`│  CrediFlexi · Tickets                           │`

`├─────────┬───────────────────────────────────────┤`

`│ Sidebar │  Header (36px padding)                │`

`│ 220px   │  ─────────────────────────────────    │`

`│ #FAFAF9 │  Tabs filtros │ [Nuevo ticket →]      │`

`│         │  ─── divider 0.5px ─────────────      │`

`│ Nav     │                                       │`

`│         │  Tabla (sin card, solo divisores)     │`

`│         │                                       │`

`│ ────    │                                       │`

`│ User    │  Footer: 6 de 24 · Anterior/Siguiente │`

`└─────────┴───────────────────────────────────────┘`

`````

 ``

`### Configuración Tailwind`

 ``

````typescript`

`// tailwind.config.ts`

`import type { Config } from 'tailwindcss'`

 ``

`const config: Config = {`

  `content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],`

  `theme: {`

    `extend: {`

      `colors: {`

        `navy: '#0F1B3D',`

        `orange: {`

          `DEFAULT: '#F58220',`

          `dark: '#D66A10',`

        `},`

        `ink: {`

          `900: '#111111',`

          `700: '#4A4A4A',`

          `500: '#6B6B6B',`

          `400: '#9B9B9B',`

        `},`

        `border: {`

          `DEFAULT: '#ECECEC',`

          `subtle: '#F5F5F5',`

        `},`

        `surface: {`

          `DEFAULT: '#FFFFFF',`

          `sidebar: '#FAFAF9',`

          `hover: '#F5F5F5',`

        `},`

        `status: {`

          `abierto: '#2563EB',`

          `contestado: '#C88A04',`

          `terminado: '#F58220',`

          `cerrado: '#15803D',`

        `},`

      `},`

      `fontFamily: {`

        `sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],`

        `mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],`

      `},`

      `fontSize: {`

        `// Defaults override para que 13px sea base de UI`

      `},`

      `borderWidth: {`

        `DEFAULT: '0.5px',`

      `},`

      `borderRadius: {`

        `sm: '5px',`

        `DEFAULT: '6px',`

        `md: '8px',`

        `lg: '10px',`

      `},`

    `},`

  `},`

`}`

 ``

`export default config`

`````

 ``

`### Configuración shadcn/ui`

 ``

`Mapear los CSS variables de shadcn a los tokens brand en app/globals.css:`

 ``

````css`

`@layer base {`

  `:root {`

    `--background: 0 0% 100%;`

    `--foreground: 0 0% 7%;`

    `--muted: 0 0% 96%;`

    `--muted-foreground: 0 0% 42%;`

    `--border: 0 0% 93%;`

    `--input: 0 0% 93%;`

    `--primary: 222 62% 15%;        /* navy */`

    `--primary-foreground: 0 0% 100%;`

    `--accent: 27 91% 54%;           /* orange */`

    `--accent-foreground: 0 0% 100%;`

    `--ring: 27 91% 54%;`

    `--radius: 0.375rem;`

  `}`

`}`

`````

 ``

`Componentes shadcn a instalar (nada más):`

`button, input, label, dialog, dropdown-menu, select, textarea, toast (Sonner), avatar, tabs, tooltip, skeleton, table (opcional, usar divs con grid en su lugar).`

 ``

`### Checklist visual anti-desviación`

 ``

`Antes de dar por terminada cualquier vista, Claude Code debe verificar:`

 ``

`- [ ] ¿El naranja aparece solo en los 7 lugares permitidos?`

`- [ ] ¿Hay algún icono decorativo que pueda eliminarse? (respuesta default: sí, elimínalo)`

`- [ ] ¿Las métricas están en cards grandes con iconos? (si sí, rediseñar — ver preview aprobado)`

`- [ ] ¿Los estatus usan badges con fondo relleno? (si sí, cambiar a puntitos)`

`- [ ] ¿El sidebar tiene iconos al lado de cada nav item? (si sí, eliminarlos)`

`- [ ] ¿Todos los divisores son 0.5px, no 1px?`

`- [ ] ¿Todos los backgrounds son blanco o #FAFAF9, sin grises intermedios?`

`- [ ] ¿Los pesos de fuente son solo 400 y 500 (excepto h1/h2)?`

`Si alguno falla, rediseñar antes de continuar.`

 ``

`---`

 ``

`## Este módulo como base de design system`

 ``

`El sistema visual que se construye aquí servirá para:`

 ``

`1. **Futuras herramientas internas** — simulador de crédito grupal, dashboards, reportes`

`2. **Sitio web corporativo modernizado** — reutilizar tokens y componentes base`

`**Implicaciones técnicas:**`

`- Tokens centralizados en tailwind.config.ts — fuente única de verdad`

`- Componentes de layout (Sidebar, PageHeader, DataTable) genéricos y extraíbles`

`- Directorio /components/brand/ con Logo/Wordmark para reutilizar`

`- Directorio /components/layout/ con piezas reutilizables entre apps internas`

`- Nombrado consistente en inglés para facilitar portabilidad`

`**Cada decisión de UI se toma pensando en reutilización entre apps internas.**`

 ``

`---`

 ``

`## Estructura del proyecto`

 ``

`````

`crediflexi-tickets/`

`├── app/`

`│   ├── (auth)/`

`│   │   ├── login/page.tsx`

`│   │   └── auth/callback/route.ts`

`│   ├── (dashboard)/`

`│   │   ├── layout.tsx          # sidebar + header wrapper`

`│   │   ├── dashboard/page.tsx`

`│   │   ├── tickets/`

`│   │   │   ├── nuevo/page.tsx`

`│   │   │   ├── mios/page.tsx`

`│   │   │   ├── asignados/page.tsx`

`│   │   │   └── [numero]/page.tsx`

`│   │   └── admin/`

`│   │       ├── layout.tsx      # guard de rol admin`

`│   │       ├── catalogo/page.tsx`

`│   │       ├── areas/page.tsx`

`│   │       ├── usuarios/page.tsx`

`│   │       └── metricas/page.tsx`

`│   ├── api/`

`│   │   └── notifications/route.ts`

`│   ├── layout.tsx`

`│   └── globals.css`

`├── components/`

`│   ├── ui/                     # shadcn components`

`│   ├── tickets/`

`│   │   ├── ticket-form.tsx`

`│   │   ├── ticket-list.tsx`

`│   │   ├── ticket-thread.tsx`

`│   │   ├── response-composer.tsx`

`│   │   ├── status-badge.tsx`

`│   │   └── attachment-uploader.tsx`

`│   ├── admin/`

`│   │   ├── catalog-table.tsx`

`│   │   ├── catalog-form.tsx`

`│   │   └── ...`

`│   └── layout/`

`│       ├── sidebar.tsx`

`│       ├── header.tsx`

`│       └── user-menu.tsx`

`├── lib/`

`│   ├── supabase/`

`│   │   ├── client.ts           # browser client`

`│   │   ├── server.ts           # server client con cookies`

`│   │   └── middleware.ts       # auth middleware`

`│   ├── schemas/                # Zod schemas`

`│   │   ├── ticket.ts`

`│   │   ├── catalog.ts`

`│   │   └── profile.ts`

`│   ├── hooks/`

`│   ├── utils/`

`│   └── constants.ts`

`├── supabase/`

`│   ├── migrations/`

`│   │   ├── 20260421000001_initial_schema.sql`

`│   │   ├── 20260421000002_rls_policies.sql`

`│   │   ├── 20260421000003_views_and_functions.sql`

`│   │   └── 20260421000004_triggers.sql`

`│   └── seed.sql`

`├── middleware.ts               # protección de rutas`

`├── .env.local`

`├── next.config.js`

`├── tailwind.config.ts`

`├── tsconfig.json`

`└── package.json`

`````

 ``

`---`

 ``

`## Plan de implementación por fases`

 ``

`### Fase 0 — Setup (medio día)`

`- [ ] Crear proyecto en Supabase (anotar URL y anon key)`

`- [ ] Crear proyecto en Vercel, conectar a repo de GitHub`

`- [ ] Inicializar Next.js 14 con TypeScript, Tailwind, ESLint`

`- [ ] Instalar shadcn/ui con tema personalizado`

`- [ ] Configurar Supabase clients (browser + server)`

`- [ ] Configurar middleware de auth`

`- [ ] Variables de entorno (.env.local, .env.example)`

`### Fase 1 — Base de datos (1 día)`

`- [ ] Migración 1: schema completo con todas las tablas y enums`

`- [ ] Migración 2: RLS policies`

`- [ ] Migración 3: vista tickets_with_status, función is_admin, función next_response_order`

`- [ ] Migración 4: trigger de validación de paridad en ticket_responses`

`- [ ] Seed: 3 áreas, 4 tipos de problema con leyendas reales, 1 usuario admin (yo)`

`- [ ] Bucket de storage ticket-attachments con policies`

`### Fase 2 — Auth + Layout (medio día)`

`- [ ] Página de login con magic link`

`- [ ] Callback handler`

`- [ ] Hook de filtro de dominio corporativo`

`- [ ] Creación automática de profile en primer login`

`- [ ] Layout del dashboard (sidebar + header)`

`- [ ] User menu con logout`

`- [ ] Guards de ruta (autenticado + rol admin)`

`### Fase 3 — Flujos de ticket (2 días)`

`- [ ] /tickets/nuevo — formulario completo con leyenda dinámica + uploader`

`- [ ] /tickets/mios — tabla con filtros y paginación`

`- [ ] /tickets/asignados — misma tabla, filtro distinto`

`- [ ] /tickets/[numero] — detalle + hilo + composer`

`- [ ] Respuestas con validación de paridad`

`- [ ] Cierre doble (terminado_responsable → terminado_usuario)`

`- [ ] Subida de adjuntos a Supabase Storage`

`- [ ] Status badges y timestamps relativos`

`### Fase 4 — Dashboard y admin (1 día)`

`- [ ] Dashboard principal con cards de contadores`

`- [ ] /admin/catalogo CRUD completo`

`- [ ] /admin/areas CRUD`

`- [ ] /admin/usuarios — cambiar rol y área de usuarios existentes`

`- [ ] /admin/metricas — métricas básicas (conteos, tiempo promedio)`

`### Fase 5 — Pulido visual (1 día)`

`- [ ] Empty states ilustrados`

`- [ ] Skeletons en todas las rutas con data`

`- [ ] Toast notifications en todas las acciones`

`- [ ] Keyboard shortcuts básicos`

`- [ ] Dark mode toggle`

`- [ ] Responsive (asegurar que funcione en móvil)`

`- [ ] Favicon y metadata`

`- [ ] Página 404 custom`

`### Fase 6 — Deploy (medio día)`

`- [ ] Deploy a Vercel`

`- [ ] Configurar variables de entorno en Vercel`

`- [ ] Pedir CNAME a sistemas de CrediFlexi`

`- [ ] Configurar dominio custom en Vercel`

`- [ ] Verificar HTTPS automático`

`- [ ] Prueba end-to-end con 2 usuarios distintos`

`### Fase 7 (post-demo) — Notificaciones`

`- [ ] Integrar Resend`

`- [ ] Database webhook en Supabase para eventos de ticket`

`- [ ] Templates de correo (nuevo ticket, nueva respuesta, cierre)`

`---`

 ``

`## Notas para Claude Code`

 ``

`**Convenciones:**`

`- TypeScript estricto — sin any`

`- Server Components por defecto, Client Components solo cuando se necesita interactividad`

`- Server Actions para mutaciones (nada de API routes para CRUD)`

`- Zod schemas compartidos entre cliente y servidor`

`- Nombres de archivos en kebab-case, componentes en PascalCase`

`- Comentarios en español, código en inglés (nombres de variables, funciones)`

`- Spanish UI copy (todo lo visible al usuario final)`

`**Orden de construcción sugerido:**`

`Seguir las fases estrictamente en orden. No empezar la fase siguiente hasta que la anterior esté funcionando. Después de cada fase, hacer commit y deploy a Vercel para verificar que nada se rompió en producción.`

 ``

`**Lo que NO hay que hacer en este MVP:**`

`- No implementar notificaciones todavía (fase post-demo)`

`- No integrar Google Drive (se queda todo en Supabase Storage por ahora)`

`- No hacer sistema de comentarios anidados — el hilo es lineal`

`- No permitir edición de mensajes (auditoría inmutable)`

`- No implementar búsqueda full-text (llega con filtros simples)`

`- No agregar analytics complejos — solo conteos básicos en la primera versión`

`**Priorizar siempre:**`

`1. Que funcione end-to-end`

`2. Que se vea profesional`

`3. Features adicionales`

`---`

 ``

`## Contexto de negocio (para Claude Code)`

 ``

`CrediFlexi es una financiera mexicana que opera crédito grupal. El equipo interno (operaciones, crédito, sistemas) necesita un canal estructurado para reportar incidencias operativas — actualmente se manejan por WhatsApp, correo y Google Sheets, lo que genera duplicación, pérdida de información y sin trazabilidad.`

 ``

`El usuario final de esta app son empleados de CrediFlexi, no clientes externos. Todos tienen correo @financieracrediflexi.com. La app estará bajo tickets.financieracrediflexi.com, primer módulo de una plataforma más amplia de herramientas internas.`

 ``

`El demo a Dupont (director de crédito) es el hito de validación. Si le gusta, se aprueba la migración completa del stack interno y se convierte en un proyecto con presupuesto y prioridad.`