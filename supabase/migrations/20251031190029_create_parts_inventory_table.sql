/*
  # Crear Sistema de Inventario de Repuestos

  1. Nueva Tabla
    - `parts_inventory`
      - `id` (uuid, primary key)
      - `part_name` (text) - Nombre del repuesto
      - `part_type` (text) - Tipo de repuesto
      - `manufacturer` (text) - Fabricante
      - `model` (text) - Modelo
      - `specifications` (text) - Especificaciones técnicas
      - `quantity_in_stock` (integer) - Cantidad en stock
      - `minimum_quantity` (integer) - Cantidad mínima de alerta
      - `unit_price` (numeric) - Precio unitario
      - `location` (text) - Ubicación en bodega
      - `notes` (text) - Notas adicionales
      - `created_at` (timestamptz)
      - `last_updated` (timestamptz)
      - `created_by` (uuid) - Referencia a profiles
      
  2. Seguridad
    - Enable RLS on `parts_inventory` table
    - Add policies for developer and admin access
*/

-- Crear tabla de inventario de repuestos
CREATE TABLE IF NOT EXISTS parts_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_name text NOT NULL,
  part_type text NOT NULL,
  manufacturer text NOT NULL,
  model text NOT NULL,
  specifications text DEFAULT '',
  quantity_in_stock integer NOT NULL DEFAULT 0,
  minimum_quantity integer NOT NULL DEFAULT 0,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  location text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  last_updated timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Habilitar RLS
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;

-- Política: Desarrolladores y administradores pueden ver todos los repuestos
CREATE POLICY "Developers and admins can view all parts"
  ON parts_inventory
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- Política: Desarrolladores y administradores pueden insertar repuestos
CREATE POLICY "Developers and admins can insert parts"
  ON parts_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- Política: Desarrolladores y administradores pueden actualizar repuestos
CREATE POLICY "Developers and admins can update parts"
  ON parts_inventory
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- Política: Desarrolladores y administradores pueden eliminar repuestos
CREATE POLICY "Developers and admins can delete parts"
  ON parts_inventory
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- Función para actualizar last_updated automáticamente
CREATE OR REPLACE FUNCTION update_parts_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar last_updated
DROP TRIGGER IF EXISTS update_parts_inventory_timestamp_trigger ON parts_inventory;
CREATE TRIGGER update_parts_inventory_timestamp_trigger
  BEFORE UPDATE ON parts_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_inventory_timestamp();

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_parts_inventory_part_name ON parts_inventory(part_name);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_part_type ON parts_inventory(part_type);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_manufacturer ON parts_inventory(manufacturer);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_low_stock ON parts_inventory(quantity_in_stock) WHERE quantity_in_stock <= minimum_quantity;
