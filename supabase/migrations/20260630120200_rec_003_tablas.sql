-- REC-003 — Tablas del módulo Reclutamiento (prefijo rec_).
-- Ver PLAN.md §8.2. RLS se habilita en REC-004.

-- Vacante a cubrir (MVP: Gerente/Ejecutivo de Inversiones).
create table rec_vacantes (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  area          text,
  descripcion   text,
  estado        text not null default 'abierta' check (estado in ('abierta','cerrada')),
  creada_por_id uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- Candidato/postulante. MVP: 1 candidato ↔ 1 vacante (vacante_id FK directa).
create table rec_candidatos (
  id              uuid primary key default gen_random_uuid(),
  vacante_id      uuid not null references rec_vacantes(id) on delete cascade,
  nombre          text not null,
  email           text,
  telefono        text,
  fuente          rec_fuente,
  etapa           rec_etapa not null default 'postulado',
  revision_cv     rec_revision_cv,
  viabilidad      rec_viabilidad,
  motivo_descarte rec_motivo_descarte,
  cv_storage_path text,
  notas           text,
  created_at      timestamptz not null default now()
);

-- Bloque de entrevistas de una fase (ej. Fase 2 de cierto día).
create table rec_sesiones_entrevistas (
  id            uuid primary key default gen_random_uuid(),
  vacante_id    uuid not null references rec_vacantes(id) on delete cascade,
  fase          smallint not null default 2,
  fecha         date,
  descripcion   text,
  creada_por_id uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- Cita candidato × sesión. gcal_event_id se llena al crear el evento de Calendar.
create table rec_entrevistas (
  id            uuid primary key default gen_random_uuid(),
  sesion_id     uuid not null references rec_sesiones_entrevistas(id) on delete cascade,
  candidato_id  uuid not null references rec_candidatos(id) on delete cascade,
  fecha_hora    timestamptz,
  estado        rec_entrevista_estado not null default 'programada',
  gcal_event_id text,
  created_at    timestamptz not null default now()
);

-- Evaluación de un entrevistador sobre una entrevista.
-- entrevistador_id → profiles.id (los entrevistadores son colaboradores con profile).
create table rec_evaluaciones (
  id              uuid primary key default gen_random_uuid(),
  entrevista_id   uuid not null references rec_entrevistas(id) on delete cascade,
  entrevistador_id uuid not null references profiles(id),
  puntaje         smallint,
  comentarios     text,
  recomendacion   rec_viabilidad,
  enviada_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (entrevista_id, entrevistador_id)
);

-- Token público de acceso del entrevistador a sus evaluaciones de una sesión.
-- Consolidado por (sesión × entrevistador): 1 token = 1 correo.
create table rec_magic_links (
  id              uuid primary key default gen_random_uuid(),
  sesion_id       uuid not null references rec_sesiones_entrevistas(id) on delete cascade,
  entrevistador_id uuid not null references profiles(id),
  token           text not null unique,
  expira_at       timestamptz,
  usado_at        timestamptz,
  created_at      timestamptz not null default now(),
  unique (sesion_id, entrevistador_id)
);

-- Plantillas de correo editables. '{{magic_link}}' solo aplica a notificacion_entrevistador.
create table rec_plantillas_correo (
  id      uuid primary key default gen_random_uuid(),
  codigo  rec_plantilla_codigo not null unique,
  asunto  text not null,
  cuerpo  text not null,
  activa  boolean not null default true
);

-- Bitácora de correos enviados (vía Gmail API).
create table rec_correos_enviados (
  id               uuid primary key default gen_random_uuid(),
  candidato_id     uuid references rec_candidatos(id) on delete set null,
  plantilla_codigo rec_plantilla_codigo,
  to_email         text not null,
  enviado_at       timestamptz not null default now(),
  estado           text not null default 'enviado' check (estado in ('enviado','error')),
  error            text,
  gmail_message_id text,
  gmail_thread_id  text
);

-- Credenciales OAuth de Google del reclutador (reclutamiento@). refresh_token cifrado.
create table rec_credenciales_google (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id),
  refresh_token text not null,
  scope         text,
  actualizado_at timestamptz not null default now(),
  unique (profile_id)
);

-- Índices de consulta frecuente.
create index idx_rec_candidatos_vacante on rec_candidatos(vacante_id);
create index idx_rec_candidatos_etapa   on rec_candidatos(etapa);
create index idx_rec_sesiones_vacante   on rec_sesiones_entrevistas(vacante_id);
create index idx_rec_entrevistas_sesion on rec_entrevistas(sesion_id);
create index idx_rec_entrevistas_cand   on rec_entrevistas(candidato_id);
create index idx_rec_evaluaciones_entr  on rec_evaluaciones(entrevista_id);
create index idx_rec_magic_links_sesion on rec_magic_links(sesion_id);
create index idx_rec_correos_candidato  on rec_correos_enviados(candidato_id);
