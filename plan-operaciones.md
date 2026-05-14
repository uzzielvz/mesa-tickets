# Plan — CrediFlexi / Operaciones
## Migración de scoring + unificación de plataforma

---

## Contexto y decisiones de arquitectura

### La app pasa de "Mesa de Ayuda" a "CrediFlexi / Operaciones"
Plataforma unificada con dos módulos:
1. **Mesa de tickets** — ya construido, se reorganiza en el sidebar
2. **Score Crediticio** — se migra desde AppSheets + AppScript

### Sidebar final (Opción B aprobada)
```
● CrediFlexi / Operaciones

  Dashboard                        ← unificado (tickets + score)

  ▼ Mesa de tickets
      Mis tickets          [N]
      Asignados a mí       [N]     ← solo responsable/admin
      — solo admin —
      Catálogo
      Áreas

  ▼ Score Crediticio
      Acreditados
      Nuevo registro
      — solo admin —
      Métricas de score            ← distribución A/B/C/D, promedios

  ADMINISTRACIÓN                   ← solo admin
      Usuarios
      Métricas generales           ← tabs: tickets + score
```

### Roles sin cambios
- `usuario` → captura tickets y acreditados, ve solo los suyos
- `responsable` → promotor: evalúa acreditados + atiende tickets asignados
- `admin` → acceso total + panel admin

---

## Iteración 1 — Rebrand + sidebar restructurado

### Objetivo
Cambiar el nombre visual y reorganizar el sidebar con la nueva estructura antes de agregar el módulo de score.

### 1.1 — Wordmark
**Archivo:** `components/brand/wordmark.tsx`
Cambiar `/ Tickets` → `/ Operaciones`

También en la página de login `app/(auth)/login/page.tsx`.

### 1.2 — Sidebar con dos secciones colapsables + admin por sección

**Archivo:** `components/layout/sidebar.tsx`

Nueva estructura visual:
```
Dashboard

▼ Mesa de tickets
    Mis tickets [N]
    Asignados a mí [N]
    (si admin:)
    Catálogo
    Áreas

▼ Score Crediticio
    Acreditados
    Nuevo registro
    (si admin:)
    Métricas de score

ADMINISTRACIÓN (si admin)
    Usuarios
    Métricas generales
```

Cambios de código:
- Reemplazar la nav plana actual por dos secciones con header clickeable
- Las secciones empiezan **abiertas por defecto**
- El admin ve los sub-items de admin dentro de cada sección
- La sección de administración global queda solo con Usuarios + Métricas
- Estado de colapso por sección guardado en `useState` local (no persiste — abre siempre)

### 1.3 — Rutas del sidebar
Los links de admin de tickets quedan igual:
- `/admin/catalogo` → sin cambio
- `/admin/areas` → sin cambio

Nuevos links (placeholders hasta Iteración 4):
- `/score/acreditados` → lista de acreditados
- `/score/acreditados/nuevo` → formulario
- `/admin/score/metricas` → métricas de score

### 1.4 — Dashboard unificado (estructura, sin datos de score aún)
**Archivo:** `app/(dashboard)/dashboard/page.tsx`

Agregar sección "Score Crediticio" con counters en 0 hasta que existan las tablas.
Usar un patrón donde el dashboard intenta obtener stats de scoring y si las tablas no existen, muestra 0 (se resolverá en Iteración 3).

### Commit
`feat(rebrand): renombrar a Operaciones, sidebar con secciones Mesa de tickets y Score Crediticio`

---

## Iteración 2 — Base de datos para scoring

### Objetivo
Crear las 3 tablas en Supabase y configurar RLS. El usuario corre el SQL manualmente.

### 2.1 — Migration SQL

**Archivo nuevo:** `supabase/migrations/20260424000001_scoring_schema.sql`

```sql
-- Tabla principal de acreditados
create table acreditados (
  id                    uuid primary key default gen_random_uuid(),
  numero                serial unique,
  clave                 varchar(6) not null,           -- ID de negocio "ABC123"
  nombre_completo       text not null,
  ciclo                 varchar(2) not null,
  fecha_nacimiento      date not null,
  tiempo_residencia     numeric not null,
  antiguedad_negocio    numeric not null,
  dependientes          integer not null,
  antiguedad_telefono   numeric not null,
  cuenta_banco          numeric not null,
  casa_habitacion       text not null,                 -- Propia/Familiar/Rentada
  estado_civil          text not null,
  negocio_domicilio     boolean not null,
  destino_credito       text not null,
  automovil_propio      boolean not null,
  buro_credito          text not null,                 -- Excelente/Buena/Regular
  tipo_garantia         text not null,
  tipo_negocio          text not null,                 -- Fijo/Semifijo
  genero                text not null,
  -- Scoring calculado (server-side, nunca el cliente)
  puntaje_total         numeric,
  clasificacion_modelo  char(1),                       -- A/B/C/D
  -- Evaluación del promotor
  calificacion_promotor char(1),
  justificacion_promotor text,
  promotor_id           uuid references profiles(id),
  -- Auditoría
  capturado_por_id      uuid references profiles(id) not null,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  contador_ediciones    integer default 0
);

-- Referencias personales (N por acreditado)
create table acreditado_referencias (
  id               uuid primary key default gen_random_uuid(),
  acreditado_id    uuid references acreditados(id) on delete cascade not null,
  nombre_referencia text,                              -- opcional
  calidad          text not null,                     -- Excelente/Buena/Regular
  created_at       timestamptz default now()
);

-- Historial de cambios por campo
create table acreditado_historial (
  id              uuid primary key default gen_random_uuid(),
  acreditado_id   uuid references acreditados(id) on delete cascade not null,
  editado_por_id  uuid references profiles(id) not null,
  campo           text not null,
  valor_antes     text,
  valor_despues   text,
  created_at      timestamptz default now()
);

-- RLS
alter table acreditados enable row level security;
alter table acreditado_referencias enable row level security;
alter table acreditado_historial enable row level security;

-- Políticas acreditados
create policy "Usuarios ven sus propios acreditados"
  on acreditados for select
  using (capturado_por_id = auth.uid() or is_admin(auth.uid()));

create policy "Responsables y admin ven todos"
  on acreditados for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and rol in ('responsable', 'admin')
    )
  );

create policy "Usuarios autenticados pueden insertar"
  on acreditados for insert
  with check (auth.uid() is not null);

create policy "Solo quien capturó o admin puede actualizar"
  on acreditados for update
  using (capturado_por_id = auth.uid() or is_admin(auth.uid()));

-- Políticas referencias (heredan del acreditado)
create policy "Referencias visibles según acreditado"
  on acreditado_referencias for select
  using (
    exists (
      select 1 from acreditados a
      where a.id = acreditado_id
      and (a.capturado_por_id = auth.uid() or is_admin(auth.uid()))
    )
  );

create policy "Insertar referencias autenticado"
  on acreditado_referencias for insert
  with check (auth.uid() is not null);

-- Políticas historial
create policy "Historial visible para responsable y admin"
  on acreditado_historial for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and rol in ('responsable', 'admin')
    )
  );

create policy "Insertar historial autenticado"
  on acreditado_historial for insert
  with check (auth.uid() is not null);
```

### 2.2 — Tipos TypeScript

**Archivo:** `lib/supabase/types.ts` (agregar a los tipos existentes)

Agregar interfaces `Acreditado`, `AcreditadoReferencia`, `AcreditadoHistorial`.

### Commit
`feat(scoring): schema SQL para acreditados, referencias e historial`
*(El usuario corre el SQL en Supabase manualmente antes de continuar)*

---

## Iteración 3 — Algoritmo de scoring en TypeScript

### Objetivo
Migrar la lógica de `calcularScore_()` y `clasificar_()` de Google Apps Script a TypeScript puro.
Este es el corazón del sistema.

### 3.1 — Modelo de scoring

**Archivo nuevo:** `lib/scoring/modelo.ts`

Contiene (traducción exacta del Code.gs):
- `calcularEdad(fechaNac: Date): number`
- `promedioReferencias(refs: Referencia[]): number` → factor 0-1
- `calcularScore(datos: DatosAcreditado, refFactor: number): ScoreResult`
  - 16 variables, pesos exactos del modelo original
  - Retorna `{ puntaje: number, desglose: DesgloseLine[] }`
- `clasificar(puntaje: number): Clasificacion`
  - A: 80-100, B: 70-79, C: 50-69, D: 0-49

**Archivo nuevo:** `lib/scoring/types.ts`

Interfaces:
```ts
interface DatosAcreditado { ... }    // 18 campos
interface Referencia { calidad: string; nombre?: string }
interface DesgloseLine { variable: string; puntos: number; maximo: number }
interface ScoreResult { puntaje: number; desglose: DesgloseLine[] }
interface Clasificacion { letra: 'A'|'B'|'C'|'D'; label: string; color: string }
```

### 3.2 — Server Actions para scoring

**Archivo nuevo:** `lib/actions/acreditados.ts`

```ts
// Crear nuevo acreditado
export async function crearAcreditado(formData: FormData): Promise<ActionResult>

// Actualizar acreditado con historial de cambios
export async function actualizarAcreditado(id: string, formData: FormData): Promise<ActionResult>

// Guardar evaluación del promotor
export async function guardarEvaluacion(id: string, calificacion: string, justificacion: string): Promise<ActionResult>
```

Cada Server Action:
1. Valida con Zod
2. Calcula score en servidor (nunca en cliente)
3. Guarda en Supabase
4. Revalida la ruta con `revalidatePath`

### 3.3 — Schema Zod para el formulario

**Archivo nuevo:** `lib/schemas/acreditado.ts`

Validaciones:
- `clave`: exactamente 6 alfanuméricos (regex `/^[A-Za-z0-9]{6}$/`)
- `nombre_completo`: 2-120 chars, solo letras y espacios
- `ciclo`: exactamente 2 dígitos
- Campos numéricos: number ≥ 0
- Campos select: enum de valores válidos
- `referencias`: array mínimo de 1 elemento con calidad definida

### Commit
`feat(scoring): algoritmo de score en TypeScript y Server Actions`

---

## Iteración 4 — Páginas y componentes de Score Crediticio

### Objetivo
Construir toda la UI del módulo de scoring.

### 4.1 — Lista de acreditados (equivalente al Dashboard + Buscar del original)

**Archivo nuevo:** `app/(dashboard)/score/acreditados/page.tsx`

Server Component que:
- Acepta `?q=` como searchParam para búsqueda
- Fetches `acreditados` filtrado por `ilike('nombre_completo', '%q%')` o `eq('clave', q)`
- Renderiza `AcreditadoList` component
- Header con botón "Nuevo registro"

**Archivo nuevo:** `components/score/acreditado-list.tsx`

Tabla/grid de acreditados:
- Columnas: Nombre, Clave, Ciclo, Score (con barra visual), Clasificación (badge A/B/C/D), Evaluación promotor, Fecha
- Click en fila → `/score/acreditados/[numero]`
- Responsivo (mobile stack, desktop grid)
- Búsqueda: input cliente que modifica el searchParam de la URL (sin full reload)

### 4.2 — Formulario de nuevo registro

**Archivo nuevo:** `app/(dashboard)/score/acreditados/nuevo/page.tsx`

Server Component simple — renders `AcreditadoForm` sin datos iniciales.

**Archivo nuevo:** `components/score/acreditado-form.tsx`

Client Component con:
- 18 campos del formulario (igual al original)
- Sección de referencias dinámicas (useState para array)
  - Cada referencia: select calidad + input nombre (opcional)
  - Botón "Agregar referencia"
  - Mínimo 1 referencia requerida
- **Preview del score en tiempo real** mientras el usuario llena (novedad vs el original)
  - Usa `calcularScore` directamente en el cliente (función pura)
  - Muestra puntaje provisional y clasificación mientras escribe
- Validación con Zod + react-hook-form
- Submit → Server Action `crearAcreditado`
- Loading state con toast de éxito → redirect a detalle

### 4.3 — Detalle del acreditado

**Archivo nuevo:** `app/(dashboard)/score/acreditados/[numero]/page.tsx`

Server Component que fetches:
- Acreditado por numero
- Referencias
- Historial de cambios

Renderiza en orden:
1. `ScoreCard` — puntaje grande + barra + clasificación
2. `ScoreDesglose` — tabla colapsable con las 16 variables
3. `AcreditadoMetadata` — todos los campos del registro
4. `EvaluacionPromotor` — solo visible para responsable/admin
5. `AcreditadoHistorial` — solo visible para responsable/admin

**Componentes nuevos:**

`components/score/score-card.tsx`
- Número grande del puntaje (ej: "78")
- Badge de clasificación (A/B/C/D con color)
- Etiqueta de riesgo ("Bajo riesgo", "Riesgo moderado", etc.)
- Barra de progreso (ancho = puntaje%)
- Consistent con el design system existente

`components/score/score-desglose.tsx`
- Tabla colapsable (toggle show/hide)
- 16 filas: variable | puntos obtenidos | máximo
- Barra mini de progreso por variable
- Total al final

`components/score/evaluacion-promotor.tsx`
- Client Component
- Select A/B/C/D + textarea de justificación
- Solo visible si `rol === 'responsable' || rol === 'admin'`
- Si ya tiene evaluación → muestra la existente con opción de modificar
- Submit → Server Action `guardarEvaluacion` → toast

`components/score/acreditado-historial.tsx`
- Tabla de cambios (campo | antes | después | quién | cuándo)
- Si no hay cambios → "Sin ediciones registradas"

### 4.4 — Edición del acreditado

**Archivo nuevo:** `app/(dashboard)/score/acreditados/[numero]/editar/page.tsx`

Server Component que pre-fetches el acreditado + referencias → renders `AcreditadoForm` con datos iniciales.

El mismo componente `AcreditadoForm` acepta `initialData` prop:
- Si existe → modo edición (título "Editar registro", botón "Guardar cambios")
- Si no → modo creación (título "Nuevo registro", botón "Registrar")

Submit en modo edición → Server Action `actualizarAcreditado`:
1. Lee registro actual de DB
2. Compara campo por campo
3. Inserta en `acreditado_historial` solo los que cambiaron
4. Recalcula score
5. Actualiza registro + incrementa `contador_ediciones`

### 4.5 — Loading states para score

- `app/(dashboard)/score/acreditados/loading.tsx` — skeleton de lista
- `app/(dashboard)/score/acreditados/[numero]/loading.tsx` — skeleton de detalle

### Commit
`feat(scoring): páginas y componentes del módulo Score Crediticio`

---

## Iteración 5 — Dashboard unificado

### Objetivo
El dashboard muestra stats de ambos módulos según el rol del usuario.

**Archivo modificado:** `app/(dashboard)/dashboard/page.tsx`

Nueva estructura de secciones:

```
Hola, {nombre}
Esto es lo que está pasando hoy.

[MESA DE TICKETS]
  Mis tickets abiertos | Contestados | Total | Cerrados

[SCORE CREDITICIO]                 ← nuevo
  Registros capturados | Pendientes evaluación | Total | Esta semana

[ASIGNADOS A MÍ]                   ← solo responsable/admin
  Pendientes | Terminados | Total | Cerrados

[ACCESO RÁPIDO]
  Levantar ticket | Nuevo acreditado
```

La sección de score hace dos queries paralelas:
- `acreditados` filtrados por `capturado_por_id = user.id` (o todos si admin)
- Cuenta pendientes de evaluación (sin `calificacion_promotor`)

### Commit
`feat(dashboard): dashboard unificado con stats de tickets y score crediticio`

---

## Iteración 6 — Métricas generales unificadas

### Objetivo
La página de métricas admin tiene dos tabs: una por módulo.

**Archivo modificado:** `app/(dashboard)/admin/metricas/page.tsx`

Dos tabs (Client Component para el toggle):
- **Tab "Mesa de tickets"** — lo que ya existe (totales por status, por área)
- **Tab "Score Crediticio"** — nuevo:
  - Distribución por clasificación (A/B/C/D) con contadores
  - Score promedio general
  - Acreditados sin evaluación del promotor
  - Top ciclos con más registros

**Archivo nuevo:** `app/(dashboard)/admin/score/metricas/page.tsx`
(El link del sidebar de Score va a esta página)

Misma data que el tab de score, pero como página standalone si el admin navega desde el sidebar de Score Crediticio.

### Commit
`feat(admin): métricas unificadas con tabs por módulo`

---

## Iteración 7 — Ajustes finales y pulido

### 7.1 — Loading para nuevas rutas
- `app/(dashboard)/score/acreditados/nuevo/loading.tsx`
- `app/(dashboard)/score/acreditados/[numero]/editar/loading.tsx`

### 7.2 — 404 en score
Si `/score/acreditados/[numero]` no existe → `notFound()`

### 7.3 — Metadata por sección
Cada sección con su propio `metadata` export o `generateMetadata`.

### 7.4 — Tipos actualizados
Actualizar `lib/supabase/types.ts` con las tres nuevas tablas.

### 7.5 — SQL para nombres de acreditados en historial
El historial guarda solo el ID del editor. Para mostrar el nombre:
- En la query del historial, hacer join con profiles: `.select('*, profiles(nombre_completo, email)')`

### 7.6 — Sidebar: contar acreditados pendientes de evaluación
El sidebar ya muestra contadores de tickets. Agregar el contador de acreditados
pendientes de evaluación para promotores/admin en la sección de Score.

### Commit
`feat: ajustes finales, loading states y metadata del módulo de score`

---

## Resumen de archivos nuevos/modificados

### Nuevos
```
lib/
  scoring/
    modelo.ts                    ← algoritmo de score (corazón del sistema)
    types.ts                     ← interfaces del modelo
  schemas/
    acreditado.ts                ← validación Zod del formulario
  actions/
    acreditados.ts               ← Server Actions (crear, actualizar, evaluar)

app/(dashboard)/
  score/
    acreditados/
      page.tsx                   ← lista + búsqueda
      loading.tsx
      nuevo/
        page.tsx
        loading.tsx
      [numero]/
        page.tsx                 ← detalle
        loading.tsx
        editar/
          page.tsx
          loading.tsx
  admin/
    score/
      metricas/page.tsx          ← métricas de score standalone

components/score/
  acreditado-form.tsx            ← formulario (nuevo + edición)
  acreditado-list.tsx            ← tabla de acreditados
  score-card.tsx                 ← puntaje + badge + barra
  score-desglose.tsx             ← tabla de 16 variables colapsable
  evaluacion-promotor.tsx        ← form de evaluación del promotor
  acreditado-historial.tsx       ← tabla de cambios

supabase/migrations/
  20260424000001_scoring_schema.sql
```

### Modificados
```
components/
  brand/wordmark.tsx             ← "/ Operaciones"
  layout/sidebar.tsx             ← nuevo sidebar con dos secciones
app/(dashboard)/
  dashboard/page.tsx             ← stats unificados
  admin/metricas/page.tsx        ← tabs por módulo
app/(auth)/login/page.tsx        ← wordmark actualizado
lib/supabase/types.ts            ← nuevas interfaces
```

---

## Orden de ejecución

```
Iter 1: Rebrand + sidebar restructurado         → verificar navegación
Iter 2: SQL en Supabase (manual) + tipos TS     → verificar tablas en DB
Iter 3: Algoritmo de score + Server Actions     → probar lógica
Iter 4: Páginas y componentes de score          → flujo completo de captura
Iter 5: Dashboard unificado                     → stats de ambos módulos
Iter 6: Métricas admin con tabs                 → reportes
Iter 7: Pulido final                            → production-ready
```

Cada iteración termina con un commit. El usuario puede probar en local entre iteraciones.

---

## Lo que NO se hace en este plan
- Email notifications (post-demo, Fase 7)
- Exportación a PDF/Excel del score (post-demo)
- Búsqueda avanzada con filtros múltiples (post-demo)
- Gráficas/charts en métricas (post-demo, requiere librería)
- Comparación de scores entre ciclos del mismo acreditado (post-demo)
