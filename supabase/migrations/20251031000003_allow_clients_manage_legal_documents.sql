/*
  # Permitir a Clientes Gestionar sus Documentos Legales

  1. Cambios
    - Agregar política para que clientes puedan insertar documentos en su carpeta
    - Agregar política para que clientes puedan actualizar sus propios documentos
    - Agregar política para que clientes puedan eliminar sus propios documentos

  2. Seguridad
    - Los clientes solo pueden gestionar documentos de su propio client_id
    - Verificación mediante la tabla clients y profile_id
*/

-- Política para INSERT: Clientes pueden subir documentos a su carpeta
CREATE POLICY "Clients can insert own legal documents"
  ON legal_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

-- Política para UPDATE: Clientes pueden actualizar sus propios documentos
CREATE POLICY "Clients can update own legal documents"
  ON legal_documents
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

-- Política para DELETE: Clientes pueden eliminar sus propios documentos
CREATE POLICY "Clients can delete own legal documents"
  ON legal_documents
  FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

-- =====================================================
-- POLÍTICAS DE STORAGE PARA CLIENTES
-- =====================================================

-- Política para INSERT: Clientes pueden subir archivos a su carpeta
CREATE POLICY "Clients can insert own legal document files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'legal-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM clients WHERE profile_id = auth.uid()
    )
  );

-- Política para UPDATE: Clientes pueden actualizar sus archivos
CREATE POLICY "Clients can update own legal document files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'legal-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM clients WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'legal-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM clients WHERE profile_id = auth.uid()
    )
  );

-- Política para DELETE: Clientes pueden eliminar sus archivos
CREATE POLICY "Clients can delete own legal document files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'legal-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM clients WHERE profile_id = auth.uid()
    )
  );
