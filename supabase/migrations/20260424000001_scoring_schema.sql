-- ================================================================
-- SCORING SCHEMA — CrediFlexi / Operaciones
-- Correr en Supabase SQL Editor antes de usar el módulo de score
-- ================================================================

-- 1. Acceso al módulo en profiles
alter table profiles add column if not exists acceso_score boolean default false;

-- 2. Tabla principal de acreditados
create table if not exists acreditados (
  id                     uuid primary key default gen_random_uuid(),
  numero                 serial unique,
  clave                  varchar(6) not null,
  nombre_completo        text not null,
  ciclo                  varchar(2) not null,
  fecha_nacimiento       date not null,
  tiempo_residencia      numeric not null,
  antiguedad_negocio     numeric not null,
  dependientes           integer not null,
  antiguedad_telefono    numeric not null,
  cuenta_banco           numeric not null,
  casa_habitacion        text not null,       -- Propia / Familiar / Rentada
  estado_civil           text not null,       -- Casado / Union libre / Viudo / Soltero / Divorciado
  negocio_domicilio      boolean not null,
  destino_credito        text not null,       -- Capital de trabajo / Activo fijo / Bienes y servicios de consumo
  automovil_propio       boolean not null,
  buro_credito           text not null,       -- Excelente / Buena / Regular
  tipo_garantia          text not null,       -- Equipo de transporte / Ninguna / Avales
  tipo_negocio           text not null,       -- Fijo / Semifijo
  genero                 text not null,       -- Masculino / Femenino
  -- Score calculado en servidor
  puntaje_total          numeric,
  clasificacion_modelo   char(1),             -- A / B / C / D
  -- Evaluación del promotor
  calificacion_promotor  char(1),
  justificacion_promotor text,
  promotor_id            uuid references profiles(id),
  -- Auditoría
  capturado_por_id       uuid references profiles(id) not null,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  contador_ediciones     integer default 0
);

-- 3. Referencias personales (N por acreditado)
create table if not exists acreditado_referencias (
  id                uuid primary key default gen_random_uuid(),
  acreditado_id     uuid references acreditados(id) on delete cascade not null,
  nombre_referencia text,
  calidad           text not null,  -- Excelente / Buena / Regular
  created_at        timestamptz default now()
);

-- 4. Historial de cambios campo por campo
create table if not exists acreditado_historial (
  id              uuid primary key default gen_random_uuid(),
  acreditado_id   uuid references acreditados(id) on delete cascade not null,
  editado_por_id  uuid references profiles(id) not null,
  campo           text not null,
  valor_antes     text,
  valor_despues   text,
  created_at      timestamptz default now()
);

-- ================================================================
-- RLS
-- ================================================================

alter table acreditados enable row level security;
alter table acreditado_referencias enable row level security;
alter table acreditado_historial enable row level security;

-- Helper: tiene acceso al módulo de score
create or replace function has_score_access()
returns boolean
language sql security definer
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and (acceso_score = true or rol = 'admin')
  );
$$;

-- Políticas acreditados: solo quienes tienen acceso_score o son admin
create policy "acreditados_select"
  on acreditados for select
  using (has_score_access());

create policy "acreditados_insert"
  on acreditados for insert
  with check (has_score_access() and auth.uid() = capturado_por_id);

create policy "acreditados_update"
  on acreditados for update
  using (
    has_score_access() and (
      capturado_por_id = auth.uid() or is_admin(auth.uid())
    )
  );

-- Políticas referencias
create policy "referencias_select"
  on acreditado_referencias for select
  using (has_score_access());

create policy "referencias_insert"
  on acreditado_referencias for insert
  with check (has_score_access());

-- Políticas historial
create policy "historial_select"
  on acreditado_historial for select
  using (has_score_access());

create policy "historial_insert"
  on acreditado_historial for insert
  with check (has_score_access());

-- ================================================================
-- Trigger: actualizar updated_at en acreditados
-- ================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_acreditados_updated_at
  before update on acreditados
  for each row execute function set_updated_at();
