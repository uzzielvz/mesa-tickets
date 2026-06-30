-- REC-001 — Flag de acceso al módulo Reclutamiento en profiles.
-- Paridad con acceso_score / acceso_cartera. En MVP solo Héctor lo tendrá en true.
alter table profiles
  add column if not exists acceso_reclutamiento boolean not null default false;
