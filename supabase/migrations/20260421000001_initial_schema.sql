-- Enums
create type user_role as enum ('admin', 'responsable', 'usuario');
create type response_type as enum ('mensaje', 'terminado_responsable', 'terminado_usuario');

-- Áreas de la empresa
create table areas (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique,
  activo  boolean not null default true
);

-- Perfiles de usuario (extiende auth.users)
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text not null unique,
  nombre_completo  text not null,
  rol              user_role not null default 'usuario',
  area_id          uuid references areas(id) on delete set null,
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Catálogo de tipos de problema
create table problem_catalog (
  id                      uuid primary key default gen_random_uuid(),
  area_id                 uuid not null references areas(id) on delete cascade,
  nombre                  text not null,
  leyenda                 text not null,
  responsable_default_id  uuid references profiles(id) on delete set null,
  requiere_grupo          boolean not null default false,
  requiere_cliente        boolean not null default false,
  requiere_ciclo          boolean not null default false,
  requiere_evidencia      boolean not null default false,
  activo                  boolean not null default true
);

-- Tickets
create table tickets (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigserial unique not null,
  problem_catalog_id  uuid not null references problem_catalog(id),
  levantado_por_id    uuid not null references profiles(id),
  responsable_id      uuid not null references profiles(id),
  grupo               text,
  cliente             text,
  ciclo_cliente       text,
  created_at          timestamptz not null default now(),
  closed_at           timestamptz
);

-- Respuestas de tickets
create table ticket_responses (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references tickets(id) on delete cascade,
  orden      int not null,
  autor_id   uuid not null references profiles(id),
  contenido  text not null,
  tipo       response_type not null default 'mensaje',
  created_at timestamptz not null default now(),
  unique(ticket_id, orden)
);

-- Adjuntos
create table ticket_attachments (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references tickets(id) on delete cascade,
  response_id      uuid references ticket_responses(id) on delete set null,
  storage_path     text not null,
  nombre_original  text not null,
  mime_type        text not null,
  size_bytes       bigint not null,
  uploaded_by_id   uuid not null references profiles(id),
  created_at       timestamptz not null default now()
);
