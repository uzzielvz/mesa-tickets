-- Agrega columna storage_path a cartera_uploads para guardar la ruta en Supabase Storage
ALTER TABLE cartera_uploads
  ADD COLUMN IF NOT EXISTS storage_path text;
