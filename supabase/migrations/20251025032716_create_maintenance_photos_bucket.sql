/*
  # Crear bucket de Storage para fotos de mantenimiento

  ## Bucket
  - `maintenance-photos` - Para almacenar fotos del checklist

  ## Políticas
  - Técnicos pueden subir fotos
  - Todos los autenticados pueden ver fotos
*/

-- Crear el bucket (esto se hace mejor desde el Dashboard de Supabase)
-- Pero podemos crear las políticas para el bucket

-- Insertar bucket si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-photos', 'maintenance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir subir fotos (técnicos y admins)
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-photos');

-- Política para permitir ver fotos
CREATE POLICY "Authenticated users can view maintenance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'maintenance-photos');

-- Política para permitir actualizar fotos
CREATE POLICY "Authenticated users can update their photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'maintenance-photos');

-- Política para permitir eliminar fotos (solo admins)
CREATE POLICY "Admins can delete maintenance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-photos' AND
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'developer')
);
