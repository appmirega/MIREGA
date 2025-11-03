/*
  # Sistema de Partes Específicas por Ascensor

  1. Nueva Tabla
    - `elevator_specific_parts`
      - `id` (uuid, primary key)
      - `elevator_id` (uuid) - Referencia al ascensor
      - `part_type` (text) - Tipo de parte (Motor, Tarjeta, etc)
      - `part_name` (text) - Nombre de la parte
      - `manufacturer` (text) - Fabricante
      - `model` (text) - Modelo
      - `specifications` (text) - Especificaciones
      - `quantity_needed` (integer) - Cantidad necesaria para este ascensor
      - `source` (text) - 'manual' o 'auto_request' (de dónde vino el registro)
      - `notes` (text) - Notas adicionales
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - Referencia a profiles
      
  2. Función Trigger
    - Cuando se crea una solicitud de repuesto en `parts_requests_history`,
      automáticamente se registra en `elevator_specific_parts`
      
  3. Seguridad
    - Enable RLS
    - Policies for developer, admin, and technician access
*/

-- Crear tabla de partes específicas por ascensor
CREATE TABLE IF NOT EXISTS elevator_specific_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elevator_id uuid NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  part_type text NOT NULL,
  part_name text NOT NULL,
  manufacturer text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  specifications text DEFAULT '',
  quantity_needed integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_request')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_elevator_specific_parts_elevator ON elevator_specific_parts(elevator_id);
CREATE INDEX IF NOT EXISTS idx_elevator_specific_parts_type ON elevator_specific_parts(part_type);

-- Habilitar RLS
ALTER TABLE elevator_specific_parts ENABLE ROW LEVEL SECURITY;

-- Políticas: Ver partes de ascensores
CREATE POLICY "Authenticated users can view elevator parts"
  ON elevator_specific_parts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

-- Políticas: Insertar partes
CREATE POLICY "Authorized users can insert elevator parts"
  ON elevator_specific_parts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

-- Políticas: Actualizar partes
CREATE POLICY "Authorized users can update elevator parts"
  ON elevator_specific_parts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

-- Políticas: Eliminar partes
CREATE POLICY "Authorized users can delete elevator parts"
  ON elevator_specific_parts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_elevator_specific_parts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_elevator_specific_parts_timestamp_trigger ON elevator_specific_parts;
CREATE TRIGGER update_elevator_specific_parts_timestamp_trigger
  BEFORE UPDATE ON elevator_specific_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_elevator_specific_parts_timestamp();

-- Función para registrar automáticamente partes cuando se hace una solicitud
CREATE OR REPLACE FUNCTION auto_register_elevator_part_from_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Insertar en elevator_specific_parts si no existe ya
  INSERT INTO elevator_specific_parts (
    elevator_id,
    part_type,
    part_name,
    manufacturer,
    model,
    specifications,
    quantity_needed,
    source,
    created_by
  )
  SELECT
    NEW.elevator_id,
    COALESCE(NEW.part_type, 'No especificado'),
    NEW.part_name,
    '',
    COALESCE(NEW.model, ''),
    COALESCE(NEW.notes, ''),
    COALESCE(NEW.quantity, 1),
    'auto_request',
    NEW.requested_by
  WHERE NOT EXISTS (
    SELECT 1 FROM elevator_specific_parts
    WHERE elevator_id = NEW.elevator_id
    AND part_name = NEW.part_name
    AND part_type = COALESCE(NEW.part_type, 'No especificado')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar partes automáticamente desde solicitudes
DROP TRIGGER IF EXISTS auto_register_part_trigger ON parts_requests_history;
CREATE TRIGGER auto_register_part_trigger
  AFTER INSERT ON parts_requests_history
  FOR EACH ROW
  EXECUTE FUNCTION auto_register_elevator_part_from_request();
