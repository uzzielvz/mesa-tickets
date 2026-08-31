-- INV-003 — Bucket 'inversiones' para los .xlsx originales + políticas.
--
-- ⚠ POR QUÉ ESTA MIGRACIÓN IMPORTA MÁS DE LO QUE PARECE
--
-- Toda la RLS de INV-002 no sirve de nada si el archivo original es descargable
-- por cualquier autenticado: **ese .xlsx trae la CLABE de todos los fondeadores,
-- con su nombre completo, su banco y sus montos**. La tabla puede estar blindada
-- y el dato salir por Storage.
--
-- Bucket PRIVADO, y la separación de audiencias se aplica AQUÍ TAMBIÉN, no solo
-- en las pantallas. El prefijo de la ruta lleva el tipo de reporte
-- (`calendario/…` o `tablero/…`) precisamente para que la política pueda
-- distinguirlos: quien solo tiene acceso a pagos no puede bajar el tablero de
-- desempeño, y al revés.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inversiones',
  'inversiones',
  false,
  26214400,                                -- 25 MB; el tablero pesa ~350 KB y crecerá
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Lectura: por audiencia, según el prefijo de la ruta ───────────────────────
create policy "inv_storage_select_calendario" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inversiones'
    and name like 'calendario/%'
    and public.has_inversiones_pagos()
  );

create policy "inv_storage_select_tablero" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inversiones'
    and name like 'tablero/%'
    and public.has_inversiones_desempeno()
  );

-- ── Escritura: solo quien carga ──────────────────────────────────────────────
-- Un cargador no necesita poder LEER lo que subió; por eso no hay política de
-- select para él. Felix sube; Tesorería y Dirección leen lo suyo.
create policy "inv_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inversiones'
    and (name like 'calendario/%' or name like 'tablero/%')
    and public.has_inversiones_carga()
  );

create policy "inv_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'inversiones' and public.has_inversiones_carga())
  with check (bucket_id = 'inversiones' and public.has_inversiones_carga());

-- Sin política de DELETE, igual que inv_cargas: el histórico es el requisito.
