# Plan de cambios — catálogo dinámico, rechazo y onboarding

> Documento de planificación. **No** modifica nada todavía. Cada sección distingue entre **hechos verificados** en el código y **hipótesis / decisiones de diseño** sobre las que necesito tu visto bueno antes de implementar.

---

## 1. Estado actual (hechos verificados leyendo el código)

### 1.1 Esquema del catálogo y tickets

`supabase/migrations/20260421000001_initial_schema.sql`:

- `problem_catalog` tiene **4 banderas booleanas fijas**: `requiere_grupo`, `requiere_cliente`, `requiere_ciclo`, `requiere_evidencia`. No existe ningún sistema de campos dinámicos.
- `tickets` tiene **3 columnas fijas** ligadas a esas banderas: `grupo text`, `cliente text`, `ciclo_cliente text`. Todas son `null`-able.
- `tickets_with_status` (vista) expone esas tres columnas + `levantado_por_nombre` y `responsable_nombre`.

UI que depende de esas banderas/columnas hoy:

- `components/admin/catalogo-admin.tsx` — checkboxes en líneas 124-136.
- `components/tickets/ticket-form.tsx` — inputs condicionales líneas 172-203.
- `app/(dashboard)/tickets/[numero]/page.tsx` — bloque metadata líneas 66-84.
- `lib/supabase/types.ts` — tipos de fila/insert/update.
- `lib/schemas/ticket.ts` — schema Zod del nuevo ticket.

### 1.2 Estados y flujo del ticket

`supabase/migrations/20260421000004_triggers.sql` + view `tickets_with_status`:

- Enum `response_type` solo tiene **3 valores**: `mensaje`, `terminado_responsable`, `terminado_usuario`.
- Estado se deriva de `closed_at` y la última respuesta:
  - `cerrado` si `closed_at` o `tipo = terminado_usuario`.
  - `terminado` si `tipo = terminado_responsable`.
  - `abierto` si último orden es impar.
  - `contestado` si último orden es par.
- Trigger `validate_response_order`: aplica paridad estricta — orden impar = `levantado_por_id`, orden par = `responsable_id`. **Aplica a todos los tipos**, sin excepción.
- Trigger `handle_ticket_closure`: pone `closed_at = now()` cuando entra `terminado_usuario`.
- **No existe** ningún concepto de "rechazo" ni de cancelar la solicitud.

### 1.3 Visibilidad del solicitante (¿quién ve a quién?)

Esto es importante porque preguntas explícitamente. Esto es lo que **ya pasa hoy**:

| Lugar | Quién ve qué del solicitante |
|---|---|
| RLS `tickets_select` (mig. 002, líneas 54-60) | Solo `levantado_por_id`, `responsable_id` y admins pueden leer un ticket. |
| Vista `tickets_with_status` | Expone siempre `levantado_por_nombre` (nombre completo). |
| `/tickets/asignados` (responsable) → `TicketList` con `showResponsable={false}` | El responsable ve el **nombre completo** del solicitante en cada fila (`ticket-list.tsx` línea 71-78). |
| `/tickets/[numero]` detalle | El header **no** muestra "Levantado por: X" explícitamente. Pero el `TicketThread` muestra el nombre del autor en cada mensaje, así que el responsable ve quién levantó al leer el primer mensaje (`ticket-thread.tsx` líneas 67-78). |
| Storage de adjuntos | El nombre original se conserva, sin metadatos extra del subidor en la UI. |

**Conclusión de hecho**: hoy el responsable **sí ve** el nombre y correo del solicitante (vía la metadata del autor de la primera respuesta y la lista). No hay anonimato. Los administradores también ven todo.

### 1.4 Alta de usuarios (onboarding actual)

`supabase/migrations/20260421000004_triggers.sql` + `app/(auth)/auth/callback/route.ts`:

- Login es Google OAuth o magic link, restringido al dominio `@financieracrediflexi.com`.
- Trigger `handle_new_user` crea automáticamente el `profiles` con:
  - `nombre_completo = raw_user_meta_data->>'full_name'` (Google lo trae) **o** `split_part(email, '@', 1)` como fallback (ej. `uzziel.valdez`).
  - `rol = 'usuario'`, `area_id = null`, `acceso_score = false`.
- **No existe** ninguna pantalla de onboarding. El nuevo usuario aterriza en `/dashboard` con `area_id = null` y, si vino por magic link, con un nombre tipo `uzziel.valdez`.
- RLS `profiles_update_admin` (mig. 002 línea 23-25): **solo admins** pueden hacer UPDATE en profiles. Un usuario normal hoy **no puede** editar su propio nombre o área desde la app aunque quiera.

---

## 2. Cambios propuestos

### 2.1 Cambio A — Campos dinámicos por tipo de problema

**Objetivo**: en `Editar tipo` (catálogo), reemplazar los 4 checkboxes fijos por un mini-builder de campos. Cada tipo de problema define su propia lista ordenada de campos. El formulario de "Nuevo ticket" los renderiza dinámicamente.

#### Diseño de datos (decisión de diseño — pido confirmación)

Dos opciones:

| Opción | Pros | Contras |
|---|---|---|
| **A) JSONB en `problem_catalog.campos`** y `tickets.datos` | 1 query menos, fácil de renderizar, atómico al guardar el catálogo | Validación más flexible; tipos más débiles |
| B) Tablas relacionales (`problem_catalog_fields`, `ticket_field_values`) | Más normalizado, queries SQL puras | Mucho más boilerplate, más migraciones, más joins |

**Recomendación: opción A (JSONB)**. Es lo que se adapta mejor a un mini-form-builder y a Next + Supabase.

#### Forma propuesta del JSONB

`problem_catalog.campos` (`jsonb not null default '[]'`):

```json
[
  {
    "key": "id_grupo",
    "label": "ID del grupo",
    "type": "text",
    "required": true,
    "placeholder": "Ej: G-1042"
  },
  {
    "key": "ciclo_grupo",
    "label": "Ciclo del grupo",
    "type": "text",
    "required": true
  },
  {
    "key": "descripcion",
    "label": "Descripción del problema",
    "type": "textarea",
    "required": true
  }
]
```

Tipos soportados (acotado a propósito, escalable después): `text`, `textarea`, `number`, `select` (con `options: string[]`), `date`. **Nunca** dejamos texto libre como tipo para no abrir la puerta a inputs raros.

`tickets.datos` (`jsonb not null default '{}'`): `{ "id_grupo": "G-1042", "ciclo_grupo": "12", "descripcion": "..." }`.

#### Compatibilidad con datos existentes (importantísimo, no romper nada)

- **Mantener** las columnas `tickets.grupo`, `tickets.cliente`, `tickets.ciclo_cliente` y las banderas `problem_catalog.requiere_*`. Son históricos de tickets ya creados.
- Migración inicial: para cada fila de `problem_catalog` con banderas activas, generar el JSON `campos` equivalente con keys reservadas `grupo`, `cliente`, `ciclo_cliente`. Así los catálogos existentes se siguen viendo igual sin tocar.
- Tickets viejos: el detalle sigue mostrando la metadata desde las columnas legacy si `datos` está vacío; muestra `datos` si tiene contenido. Una sola función helper en TS centraliza esto.
- Tickets nuevos: solo se escribe en `datos`. Las columnas legacy quedan en `null` (no rompen nada porque ya son `null`-ables).
- **Comentario de evidencia**: la bandera `requiere_evidencia` no se traduce a un campo del form-builder — los adjuntos se manejan aparte (sección de archivos), igual que hoy. Se queda como bandera o se muestra como un toggle aparte en el editor del catálogo. **Mi recomendación: dejarla como toggle aparte (no es un "campo" de texto)**.

#### Cambios concretos por archivo

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20260514000001_dynamic_fields.sql` *(nuevo)* | `alter table problem_catalog add column campos jsonb not null default '[]'`; `alter table tickets add column datos jsonb not null default '{}'`; backfill de `campos` desde banderas existentes; recreate vista `tickets_with_status` (no cambia columnas, pero se hace `create or replace` por seguridad). |
| `lib/supabase/types.ts` | Agregar `campos: ProblemField[]` y `datos: Record<string,string>`; tipo `ProblemField` exportado. |
| `lib/schemas/ticket.ts` | `newTicketSchema` deja de tener campos fijos; valida `datos: Record<string,string>` con un builder dinámico que construye Zod a partir de `campos[]`. |
| `components/admin/catalogo-admin.tsx` | Reemplazar bloque de checkboxes (124-136) por componente `<FieldsBuilder value={form.campos} onChange={...} />` (nuevo). Mantener `requiere_evidencia` como toggle aparte. |
| `components/admin/fields-builder.tsx` *(nuevo)* | UI: lista ordenable (drag opcional, primero solo botones ↑/↓), agregar/eliminar, key auto-generada desde label (slug), tipo selector, required toggle, placeholder. |
| `components/tickets/ticket-form.tsx` | Reemplazar bloques 172-203 por loop sobre `selectedProblem.campos` que renderiza el input correcto. Mantener bloque de adjuntos. Calcular `datos` con todos los valores y enviarlo al insert. |
| `app/(dashboard)/tickets/[numero]/page.tsx` | El bloque metadata (66-84) cambia a renderizar pares `label: valor` desde `datos` (con fallback a las columnas legacy si `datos` está vacío). |

#### Riesgo identificado

- **Si edito el catálogo y agrego/quito un campo**, los tickets viejos del mismo tipo siguen mostrando los campos que tenían en `datos` (no se rompen). Los nuevos usan la nueva forma. Esto es el comportamiento natural de un JSONB y es lo deseable.
- **Si renombro un `key`**, los tickets viejos perderían el label bonito. Mitigación: en el builder, **el `key` es inmutable una vez creado** (solo `label`/`required`/`placeholder` se pueden editar). Esto se puede hacer en cliente; documentar en el UI.

---

### 2.2 Cambio B — Rechazo de solicitud por el responsable

**Objetivo**: el responsable puede rechazar un ticket cuando algo falta o es un error del solicitante, **obligado a explicar por qué**. El ticket queda en estado `rechazado` y se cierra (no se reabre).

#### Decisión de diseño (pido confirmación)

Dos caminos:

| Opción | Pros | Contras |
|---|---|---|
| **A) Extender `response_type` con `rechazo_responsable`** | Encaja con el modelo append-only del hilo. Se ve igual que un mensaje del sistema. | Requiere `alter type ... add value`, ajustar trigger de paridad y el `case` del estado. |
| B) Columnas `rejected_at`, `rejected_reason` + bool `rejected_by_id` | Estado más explícito en `tickets`. | Rompe el modelo "todo es respuesta" del hilo, duplica lógica. |

**Recomendación: opción A**.

#### Cambios concretos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20260514000002_rechazo.sql` *(nuevo)* | `alter type response_type add value 'rechazo_responsable'`; `create or replace function validate_response_order` para permitir `rechazo_responsable` desde el responsable en cualquier orden par o impar (no fuerza paridad para este tipo); `create or replace function handle_ticket_closure` para también cerrar (`closed_at = now()`) cuando entra `rechazo_responsable`; `create or replace view tickets_with_status` con un `case when last_resp.tipo = 'rechazo_responsable' then 'rechazado'` antes del check de `closed_at`. |
| `lib/supabase/types.ts` | Agregar `'rechazado'` a `TicketStatus`; agregar `'rechazo_responsable'` a `ResponseType`. |
| `components/tickets/status-badge.tsx` | Nueva entrada `rechazado: { color: '#DC2626', label: 'Rechazado' }`. |
| `components/tickets/response-composer.tsx` | Agregar botón "Rechazar solicitud" visible solo si `esResponsable && !isTerminado`, que abre un mini-confirm con textarea obligatorio (mín 10 chars), envía respuesta tipo `rechazo_responsable` con el motivo en `contenido`. |
| `components/tickets/ticket-thread.tsx` | Agregar `rechazo_responsable` a `TIPO_LABEL` con texto "Rechazó la solicitud" y mostrar el motivo (`contenido`) debajo del separador, no como mensaje normal. |
| `app/(dashboard)/tickets/[numero]/page.tsx` | Tratar `rechazado` como cerrado (no mostrar composer). Mostrar banner explicativo arriba del hilo. |

#### Riesgo identificado

- `alter type ... add value` no se puede ejecutar dentro de una transacción en algunas versiones de Postgres si hay otras operaciones DDL. La migración se hará en su propio archivo y como `commit` independiente para evitar problemas.
- Una vez agregado el valor al enum, **no se puede quitar**. Asumimos que el nombre `rechazo_responsable` es el definitivo.

---

### 2.3 Cambio C — Visibilidad del solicitante (clarificación, no funcionalidad nueva)

Como confirmé en la sección 1.3, **el responsable ya ve hoy** el nombre completo del solicitante en la lista de "Asignados a mí" y en el primer mensaje del hilo. RLS deja ver el ticket solo a esos tres roles.

**Recomendación**: hacer esto explícito en el header del detalle, agregando "Levantado por: X" justo al lado de "Responsable: Y" en `app/(dashboard)/tickets/[numero]/page.tsx` línea 60. Cambio de 1 línea, sin migración.

**Pregunta abierta para ti**: ¿quieres que algún rol **no** vea quién levantó (anonimato del solicitante)? Hoy **no es así**. Si lo quieres, hay que cambiar RLS y la vista para no exponer `levantado_por_nombre`/`levantado_por_id` al responsable. Es un cambio mayor; no lo asumo.

---

### 2.4 Cambio D — Onboarding al primer login

**Objetivo**: cuando alguien entra por primera vez, se le pide nombre, apellido y área antes de poder usar la app. Hoy esto no existe; el trigger pone un nombre fallback y `area_id = null`.

#### Decisión de diseño

Detectar "primera vez" por:

- **Recomendación**: `area_id is null` como señal. Limpio, sin columnas extra. Riesgo: si un admin alguna vez quita el área a un usuario, lo vuelve a mandar a onboarding. Aceptable y de hecho útil.
- Alternativa: nueva columna `onboarded boolean default false`. Más explícita pero agrega ruido.

Opto por `area_id is null`. Si después aparece el caso del admin que quiere reasignar, agregamos la columna.

#### Permisos (esto es lo no trivial)

Hoy `profiles_update_admin` impide al usuario actualizar su propio perfil. Necesitamos dejarlo escribir **solo** `nombre_completo` y `area_id`, no `rol` ni `acceso_score` ni `activo`.

**Recomendación**: función `security definer` en lugar de relajar RLS. Más seguro y más sencillo de razonar.

```sql
create or replace function complete_onboarding(p_nombre text, p_area_id uuid)
returns void
language plpgsql security definer
as $$
begin
  if auth.uid() is null then raise exception 'no auth'; end if;
  if length(coalesce(p_nombre,'')) < 3 then raise exception 'nombre inválido'; end if;
  if not exists (select 1 from areas where id = p_area_id and activo) then
    raise exception 'área inválida';
  end if;
  update profiles
    set nombre_completo = p_nombre,
        area_id = p_area_id
    where id = auth.uid();
end;
$$;
```

Así el usuario solo puede tocar esos dos campos vía esta RPC. Nada de RLS abierto.

#### Cambios concretos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20260514000003_onboarding.sql` *(nuevo)* | Función `complete_onboarding(text, uuid)` como arriba. (Opcional: ajustar `handle_new_user` para que `nombre_completo` sea `''` cuando no haya `full_name` de Google, en lugar de poner el slug del email — así el campo sale vacío en la pantalla de onboarding, no preconrellenado con `uzziel.valdez`. **Ojo**: esto solo afecta a usuarios futuros, no rompe los existentes.) |
| `app/(dashboard)/onboarding/page.tsx` *(nuevo)* | Server component que carga `areas` y muestra el form. |
| `components/onboarding/onboarding-form.tsx` *(nuevo)* | Client component con nombre, apellido, select de área. Llama a `supabase.rpc('complete_onboarding', { p_nombre, p_area_id })`. Después `router.push('/dashboard')`. |
| `app/(dashboard)/layout.tsx` | Justo después de cargar `profile`: `if (!profile.area_id) redirect('/onboarding')`. La página de onboarding hace su propio redirect inverso si ya tiene área. |
| `lib/utils/format.ts` | `formatName` ya hace fallback al email; queda igual. |

#### Riesgo identificado

- El usuario puede entrar por OAuth Google con `full_name` ya correcto, en cuyo caso el form se debe **prerrellenar** con su nombre y solo tendría que elegir área. El form-builder lo contempla.
- Si separamos "nombre" y "apellido" en el UI, hay que decidir cómo mapear a `nombre_completo` (recomendación: `${nombre} ${apellidos}` simple). No vamos a partir el campo en la DB; mantenemos la columna única.
- Edge case: el dashboard cuenta tickets en el layout; si alguien sin área pasa por onboarding antes, el layout redirige primero, así que no se ejecutan queries innecesarias. Bien.

---

## 3. Orden de implementación propuesto

Cada paso es independiente y se puede mergear por separado. Si paramos a la mitad, lo anterior no rompe nada.

1. **Onboarding** (Cambio D) — el más aislado, no toca el flujo de tickets.
2. **Visibilidad explícita** (Cambio C) — 1 línea de UI, riesgo cero.
3. **Rechazo** (Cambio B) — agrega valor al enum y un botón. Estado `rechazado` se trata como `cerrado` en lo que ya existe.
4. **Campos dinámicos** (Cambio A) — el más invasivo. Hacerlo al final con todo lo demás estable.

---

## 4. Cosas que **no** voy a tocar (para que no haya sorpresas)

- Módulo `Score Crediticio` completo (no relacionado).
- RLS de `tickets`, `ticket_responses`, `ticket_attachments` salvo lo estrictamente necesario para rechazo.
- Estructura de Storage para adjuntos.
- Login / OAuth / dominio permitido.
- Vista `tickets_with_status` (solo se le agrega el estado `rechazado` al `case`, no cambian columnas).
- Trigger `handle_new_user` salvo, opcionalmente, el nombre fallback.

---

## 5. Preguntas para ti antes de implementar

1. **Catálogo dinámico**: ¿confirmamos opción A (JSONB)? ¿Te parecen suficientes los tipos `text`, `textarea`, `number`, `select`, `date`? ¿Quieres también `checkbox` y `multi-select`?
2. **Rechazo**: ¿el ticket rechazado debe **cerrarse inmediatamente** (no reabrible) o quieres que el solicitante pueda corregir y reintentar dentro del mismo ticket?
3. **Visibilidad**: ¿confirmas que está bien que el responsable y los admins vean el nombre del solicitante? (Como vimos, hoy ya es así.)
4. **Onboarding**: ¿partimos el campo nombre en "nombre" + "apellidos" en la pantalla, o un solo input "nombre completo"? Mi sugerencia: un solo input, más simple.
5. **Onboarding existentes**: hay usuarios que ya entraron y tienen `area_id = null`. ¿Está bien que al siguiente login los mande a onboarding también? (Recomiendo que sí.)

Una vez me confirmes, escribo las migraciones y los componentes en el orden de la sección 3.
