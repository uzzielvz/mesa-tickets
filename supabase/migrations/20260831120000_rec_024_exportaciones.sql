-- REC-024 — Bitácora de exportaciones de Reclutamiento.
--
-- Un CSV de candidatos saca nombre, correo y teléfono de personas que NO fueron
-- contratadas fuera de la plataforma, a un archivo donde ya no hay RLS que valga.
-- La política de retención de datos de candidatos (LFPDPPP / CNBV) sigue abierta
-- y sin dueño — riesgo R-1 del runbook. Exportar no crea ese riesgo, pero sí lo
-- amplifica: pasa de "dato en una base con RLS" a "archivo en la laptop de
-- alguien". Como mínimo tiene que quedar registrado quién sacó qué y cuándo.
--
-- Append-only a propósito: no se crean políticas de UPDATE ni de DELETE. Una
-- bitácora que se puede editar no es una bitácora. Mismo criterio que inv_cargas.

create table if not exists rec_exportaciones (
  id            uuid primary key default gen_random_uuid(),
  recurso       text not null check (recurso in ('candidatos', 'correos')),
  -- Los filtros aplicados (vacante, etapa, estado). Sin esto la bitácora dice
  -- "exportó candidatos" sin decir cuáles, que es casi no decir nada.
  filtros       jsonb not null default '{}'::jsonb,
  filas         int not null default 0,
  exportado_por uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists idx_rec_export_created
  on rec_exportaciones(created_at desc);

alter table rec_exportaciones enable row level security;

create policy "rec_export_select" on rec_exportaciones
  for select to authenticated
  using (has_reclutamiento_access() or is_admin(auth.uid()));

-- `exportado_por = auth.uid()`: nadie puede registrar una exportación a nombre
-- de otra persona. Sin esa condición la bitácora es falsificable por quien la
-- escribe, que es justo de quien hay que dejar rastro.
create policy "rec_export_insert" on rec_exportaciones
  for insert to authenticated
  with check (
    (has_reclutamiento_access() or is_admin(auth.uid()))
    and exportado_por = auth.uid()
  );
