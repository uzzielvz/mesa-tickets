-- Políticas RLS para el bucket 'cartera' en Supabase Storage
-- Solo usuarios autenticados con acceso_cartera o rol admin pueden subir/leer

CREATE POLICY "Subida autenticados con acceso cartera"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cartera'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (rol = 'admin' OR acceso_cartera = true)
    )
  )
);

CREATE POLICY "Lectura autenticados con acceso cartera"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cartera'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (rol = 'admin' OR acceso_cartera = true)
    )
  )
);
