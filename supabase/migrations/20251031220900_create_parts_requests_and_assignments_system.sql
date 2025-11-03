/*
  # Sistema de Solicitudes de Repuestos y Asignaciones

  ## Descripción
  Sistema completo para gestionar solicitudes de repuestos desde mantenimientos/emergencias
  y asignaciones de técnicos para llenar información de partes y piezas de ascensores.

  ## 1. Nuevas Tablas

  ### `part_requests` - Solicitudes de Repuestos
  Registra todas las solicitudes de repuestos que hacen los técnicos durante:
  - Mantenimientos preventivos/correctivos
  - Emergencias
  - Reparaciones

  Campos:
  - `id` (uuid, PK) - Identificador único
  - `elevator_id` (uuid, FK) - Ascensor relacionado
  - `client_id` (uuid, FK) - Cliente propietario
  - `technician_id` (uuid, FK) - Técnico que solicita
  - `request_type` (text) - Tipo: 'maintenance', 'emergency', 'repair'
  - `related_id` (uuid) - ID del mantenimiento/emergencia relacionado
  - `part_name` (text) - Nombre del repuesto
  - `part_type` (text) - Tipo de parte
  - `manufacturer` (text) - Fabricante
  - `model` (text) - Modelo
  - `specifications` (jsonb) - Especificaciones y medidas
  - `quantity_needed` (integer) - Cantidad necesaria
  - `urgency` (text) - Urgencia: 'low', 'medium', 'high', 'critical'
  - `photos` (text[]) - URLs de fotos del repuesto
  - `notes` (text) - Observaciones del técnico
  - `status` (text) - Estado: 'pending', 'quoted', 'approved', 'ordered', 'received', 'installed'
  - `quotation_id` (uuid) - Cotización generada
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de actualización

  ### `technician_assignments` - Asignaciones para Llenar Partes y Piezas
  Permite a técnicos autoasignarse o ser asignados para completar la información
  de partes y piezas de ascensores específicos.

  Campos:
  - `id` (uuid, PK) - Identificador único
  - `elevator_id` (uuid, FK) - Ascensor asignado
  - `technician_id` (uuid, FK) - Técnico asignado
  - `assigned_by` (uuid, FK) - Quién hizo la asignación (admin o auto)
  - `assignment_type` (text) - 'manual' o 'self_assigned'
  - `status` (text) - 'pending', 'in_progress', 'completed'
  - `progress_percentage` (integer) - Porcentaje de completitud (0-100)
  - `started_at` (timestamptz) - Cuándo empezó
  - `completed_at` (timestamptz) - Cuándo terminó
  - `notes` (text) - Notas del técnico
  - `created_at` (timestamptz) - Fecha de creación

  ## 2. Mejoras a Tabla Existente

  ### `elevator_specific_parts` - Agregar Campos para Trazabilidad
  Se agregan campos para mejorar la información de cada parte:
  - `photos` (text[]) - Array de URLs de fotos
  - `measurements` (jsonb) - Medidas detalladas
  - `installation_date` (date) - Fecha de instalación
  - `expected_lifetime_years` (integer) - Vida útil esperada en años
  - `last_maintenance_date` (date) - Última vez que se le dio mantenimiento
  - `replacement_history` (jsonb) - Historial de reemplazos
  - `supplier` (text) - Proveedor
  - `purchase_date` (date) - Fecha de compra
  - `warranty_months` (integer) - Meses de garantía
  - `condition_status` (text) - 'excellent', 'good', 'fair', 'poor', 'critical'

  ## 3. Seguridad (RLS)
  - Todas las tablas tienen RLS habilitado
  - Políticas restrictivas por rol
  - Técnicos solo ven sus propias asignaciones/solicitudes
  - Admins y developers ven todo

  ## 4. Índices
  - Índices en claves foráneas para mejor performance
  - Índices en campos de búsqueda frecuente
*/

-- =====================================================
-- 1. CREAR TABLA: part_requests
-- =====================================================

CREATE TABLE IF NOT EXISTS part_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elevator_id uuid NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('maintenance', 'emergency', 'repair', 'manual')),
  related_id uuid,
  part_name text NOT NULL,
  part_type text,
  manufacturer text,
  model text,
  specifications jsonb DEFAULT '{}'::jsonb,
  quantity_needed integer NOT NULL DEFAULT 1 CHECK (quantity_needed > 0),
  urgency text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  photos text[] DEFAULT ARRAY[]::text[],
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'approved', 'ordered', 'received', 'installed', 'cancelled')),
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para part_requests
CREATE INDEX IF NOT EXISTS idx_part_requests_elevator ON part_requests(elevator_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_client ON part_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_technician ON part_requests(technician_id);
CREATE INDEX IF NOT EXISTS idx_part_requests_status ON part_requests(status);
CREATE INDEX IF NOT EXISTS idx_part_requests_urgency ON part_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_part_requests_created ON part_requests(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_part_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_part_requests_timestamp
  BEFORE UPDATE ON part_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_part_requests_timestamp();

-- =====================================================
-- 2. CREAR TABLA: technician_assignments
-- =====================================================

CREATE TABLE IF NOT EXISTS technician_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elevator_id uuid NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assignment_type text NOT NULL DEFAULT 'manual' CHECK (assignment_type IN ('manual', 'self_assigned')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(elevator_id, technician_id, status)
);

-- Índices para technician_assignments
CREATE INDEX IF NOT EXISTS idx_tech_assignments_elevator ON technician_assignments(elevator_id);
CREATE INDEX IF NOT EXISTS idx_tech_assignments_technician ON technician_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_tech_assignments_status ON technician_assignments(status);

-- Trigger para actualizar updated_at
CREATE TRIGGER trigger_update_technician_assignments_timestamp
  BEFORE UPDATE ON technician_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_part_requests_timestamp();

-- =====================================================
-- 3. MEJORAR TABLA EXISTENTE: elevator_specific_parts
-- =====================================================

DO $$
BEGIN
  -- Agregar columna photos si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'photos'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN photos text[] DEFAULT ARRAY[]::text[];
  END IF;

  -- Agregar columna measurements si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'measurements'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN measurements jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Agregar columna installation_date si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'installation_date'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN installation_date date;
  END IF;

  -- Agregar columna expected_lifetime_years si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'expected_lifetime_years'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN expected_lifetime_years integer;
  END IF;

  -- Agregar columna last_maintenance_date si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'last_maintenance_date'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN last_maintenance_date date;
  END IF;

  -- Agregar columna replacement_history si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'replacement_history'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN replacement_history jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Agregar columna supplier si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'supplier'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN supplier text;
  END IF;

  -- Agregar columna purchase_date si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'purchase_date'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN purchase_date date;
  END IF;

  -- Agregar columna warranty_months si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'warranty_months'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN warranty_months integer;
  END IF;

  -- Agregar columna condition_status si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_specific_parts' AND column_name = 'condition_status'
  ) THEN
    ALTER TABLE elevator_specific_parts ADD COLUMN condition_status text DEFAULT 'good' CHECK (condition_status IN ('excellent', 'good', 'fair', 'poor', 'critical'));
  END IF;
END $$;

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en part_requests
ALTER TABLE part_requests ENABLE ROW LEVEL SECURITY;

-- Política: Developers ven todo
CREATE POLICY "Developers can view all part requests"
  ON part_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

-- Política: Admins ven todo
CREATE POLICY "Admins can view all part requests"
  ON part_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Técnicos ven sus propias solicitudes
CREATE POLICY "Technicians can view own part requests"
  ON part_requests FOR SELECT
  TO authenticated
  USING (technician_id = auth.uid());

-- Política: Técnicos pueden crear solicitudes
CREATE POLICY "Technicians can create part requests"
  ON part_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

-- Política: Técnicos pueden actualizar sus solicitudes
CREATE POLICY "Technicians can update own part requests"
  ON part_requests FOR UPDATE
  TO authenticated
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid());

-- Política: Admins y developers pueden actualizar cualquier solicitud
CREATE POLICY "Admins can update part requests"
  ON part_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- Habilitar RLS en technician_assignments
ALTER TABLE technician_assignments ENABLE ROW LEVEL SECURITY;

-- Política: Developers y admins ven todas las asignaciones
CREATE POLICY "Admins can view all assignments"
  ON technician_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- Política: Técnicos ven sus propias asignaciones
CREATE POLICY "Technicians can view own assignments"
  ON technician_assignments FOR SELECT
  TO authenticated
  USING (technician_id = auth.uid());

-- Política: Técnicos pueden autoasignarse
CREATE POLICY "Technicians can self-assign"
  ON technician_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    AND assignment_type = 'self_assigned'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'technician'
    )
  );

-- Política: Admins pueden crear asignaciones
CREATE POLICY "Admins can create assignments"
  ON technician_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- Política: Técnicos pueden actualizar sus asignaciones
CREATE POLICY "Technicians can update own assignments"
  ON technician_assignments FOR UPDATE
  TO authenticated
  USING (technician_id = auth.uid())
  WITH CHECK (technician_id = auth.uid());

-- Política: Admins pueden actualizar cualquier asignación
CREATE POLICY "Admins can update assignments"
  ON technician_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =====================================================
-- 5. FUNCIÓN: Registrar Actividad Automáticamente
-- =====================================================

-- Función para registrar solicitudes de repuestos en el historial
CREATE OR REPLACE FUNCTION log_part_request_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_elevator_name text;
  v_technician_name text;
BEGIN
  -- Obtener nombres para el log
  SELECT location_name INTO v_elevator_name FROM elevators WHERE id = NEW.elevator_id;
  SELECT full_name INTO v_technician_name FROM profiles WHERE id = NEW.technician_id;

  -- Registrar en activity_history
  INSERT INTO activity_history (
    user_id,
    action_type,
    entity_type,
    entity_id,
    details
  ) VALUES (
    NEW.technician_id,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
    END,
    'part_request',
    NEW.id,
    jsonb_build_object(
      'part_name', NEW.part_name,
      'elevator', v_elevator_name,
      'technician', v_technician_name,
      'request_type', NEW.request_type,
      'status', NEW.status,
      'urgency', NEW.urgency
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para log automático
CREATE TRIGGER trigger_log_part_request_activity
  AFTER INSERT OR UPDATE ON part_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_part_request_activity();
