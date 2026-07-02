-- REC-018 — Auditoría de cambios de etapa del candidato.
-- 1) Columnas de última actualización de etapa en rec_candidatos.
-- 2) Tabla rec_candidato_historial: bitácora de transiciones (auditable).
-- Las escrituras del historial las hace la RPC rec_transicion_etapa (REC-019,
-- security definer); aquí solo se abre SELECT por RLS para admin/acceso.

alter table rec_candidatos
  add column if not exists etapa_actualizada_at  timestamptz,
  add column if not exists etapa_actualizada_por uuid references profiles(id);

create table if not exists rec_candidato_historial (
  id              uuid primary key default gen_random_uuid(),
  candidato_id    uuid not null references rec_candidatos(id) on delete cascade,
  etapa_anterior  rec_etapa,
  etapa_nueva     rec_etapa not null,
  motivo_descarte rec_motivo_descarte,
  notas           text,
  actor_id        uuid references profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_rec_cand_hist_candidato on rec_candidato_historial(candidato_id);

alter table rec_candidato_historial enable row level security;

-- Solo lectura para admin o portadores del flag; la inserción va por la RPC.
create policy "rec_cand_hist_select" on rec_candidato_historial
  for select to authenticated
  using (has_reclutamiento_access() or exists (select 1 from profiles where id = auth.uid() and rol = 'admin'));
