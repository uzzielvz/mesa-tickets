-- REC-009 — Bucket 'reclutamiento' para CVs + políticas de Storage.
-- Bucket privado; solo PDF/DOC/DOCX; máx. 10 MB.
-- Acceso: admin o portadores del flag acceso_reclutamiento (mismo predicado que rec_*).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reclutamiento',
  'reclutamiento',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public              = excluded.public,
  file_size_limit     = excluded.file_size_limit,
  allowed_mime_types  = excluded.allowed_mime_types;

-- Predicado reutilizado en las 4 políticas: admin o acceso_reclutamiento.
create policy "rec_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reclutamiento'
    and exists (
      select 1 from profiles
      where id = auth.uid() and (rol = 'admin' or acceso_reclutamiento = true)
    )
  );

create policy "rec_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reclutamiento'
    and exists (
      select 1 from profiles
      where id = auth.uid() and (rol = 'admin' or acceso_reclutamiento = true)
    )
  );

create policy "rec_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'reclutamiento'
    and exists (
      select 1 from profiles
      where id = auth.uid() and (rol = 'admin' or acceso_reclutamiento = true)
    )
  )
  with check (
    bucket_id = 'reclutamiento'
    and exists (
      select 1 from profiles
      where id = auth.uid() and (rol = 'admin' or acceso_reclutamiento = true)
    )
  );

create policy "rec_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'reclutamiento'
    and exists (
      select 1 from profiles
      where id = auth.uid() and (rol = 'admin' or acceso_reclutamiento = true)
    )
  );
