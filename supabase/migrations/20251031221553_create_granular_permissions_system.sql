/*
  # Sistema de Permisos Granulares para Partes y Piezas

  ## Descripción
  Sistema de permisos que permite a Developers y Admins controlar el acceso
  a funcionalidades específicas de partes y piezas de forma jerárquica:
  Developer → Admin → Técnico → Cliente

  ## 1. Nueva Tabla: feature_permissions

  Esta tabla almacena los permisos por característica (feature) y rol.

  Campos:
  - `id` (uuid, PK) - Identificador único
  - `feature_name` (text) - Nombre de la característica (ej: 'parts_management')
  - `role` (text) - Rol afectado
  - `is_enabled` (boolean) - Si está habilitado o no
  - `controlled_by` (text) - Quién puede controlar este permiso
  - `updated_by` (uuid) - Usuario que hizo el último cambio
  - `updated_at` (timestamptz) - Fecha de última actualización
  - `created_at` (timestamptz) - Fecha de creación

  ## 2. Características (Features) Disponibles

  - `parts_management_view` - Vista de gestión de partes y piezas
  - `parts_self_assignment` - Autoasignación de técnicos
  - `parts_request_create` - Crear solicitudes de repuestos
  - `parts_request_approve` - Aprobar solicitudes de repuestos

  ## 3. Jerarquía de Permisos

  - **Developer**: Puede habilitar/deshabilitar para Admin y Técnico
  - **Admin**: Puede habilitar/deshabilitar para Técnico y Cliente
  - **Técnico**: No puede modificar permisos
  - **Cliente**: No puede modificar permisos

  ## 4. Políticas RLS

  - Developers y Admins pueden ver todos los permisos
  - Developers pueden modificar permisos de Admin y Técnico
  - Admins pueden modificar permisos de Técnico y Cliente
  - Técnicos y Clientes solo pueden leer sus permisos
*/

-- =====================================================
-- 1. CREAR TABLA: feature_permissions
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('developer', 'admin', 'technician', 'client')),
  is_enabled boolean NOT NULL DEFAULT true,
  controlled_by text NOT NULL CHECK (controlled_by IN ('developer', 'admin')),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(feature_name, role)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_feature_permissions_feature ON feature_permissions(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_permissions_role ON feature_permissions(role);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_feature_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feature_permissions_timestamp
  BEFORE UPDATE ON feature_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_permissions_timestamp();

-- =====================================================
-- 2. INSERTAR PERMISOS POR DEFECTO
-- =====================================================

-- Todos habilitados por defecto

-- Parts Management View
INSERT INTO feature_permissions (feature_name, role, is_enabled, controlled_by) VALUES
  ('parts_management_view', 'developer', true, 'developer'),
  ('parts_management_view', 'admin', true, 'developer'),
  ('parts_management_view', 'technician', true, 'admin')
ON CONFLICT (feature_name, role) DO NOTHING;

-- Parts Self Assignment
INSERT INTO feature_permissions (feature_name, role, is_enabled, controlled_by) VALUES
  ('parts_self_assignment', 'developer', true, 'developer'),
  ('parts_self_assignment', 'admin', true, 'developer'),
  ('parts_self_assignment', 'technician', true, 'admin')
ON CONFLICT (feature_name, role) DO NOTHING;

-- Parts Request Create
INSERT INTO feature_permissions (feature_name, role, is_enabled, controlled_by) VALUES
  ('parts_request_create', 'developer', true, 'developer'),
  ('parts_request_create', 'admin', true, 'developer'),
  ('parts_request_create', 'technician', true, 'admin')
ON CONFLICT (feature_name, role) DO NOTHING;

-- Parts Request Approve
INSERT INTO feature_permissions (feature_name, role, is_enabled, controlled_by) VALUES
  ('parts_request_approve', 'developer', true, 'developer'),
  ('parts_request_approve', 'admin', true, 'developer')
ON CONFLICT (feature_name, role) DO NOTHING;

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE feature_permissions ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver permisos
CREATE POLICY "Users can view feature permissions"
  ON feature_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Política: Developers pueden actualizar permisos de Admin y Técnico
CREATE POLICY "Developers can update admin and technician permissions"
  ON feature_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
    AND role IN ('admin', 'technician')
    AND controlled_by = 'developer'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
    AND role IN ('admin', 'technician')
    AND controlled_by = 'developer'
  );

-- Política: Admins pueden actualizar permisos de Técnico y Cliente
CREATE POLICY "Admins can update technician and client permissions"
  ON feature_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND role IN ('technician', 'client')
    AND controlled_by = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND role IN ('technician', 'client')
    AND controlled_by = 'admin'
  );

-- =====================================================
-- 4. FUNCIÓN HELPER: Verificar Permiso
-- =====================================================

-- Función para verificar si un usuario tiene un permiso específico
CREATE OR REPLACE FUNCTION has_feature_permission(
  p_user_id uuid,
  p_feature_name text
)
RETURNS boolean AS $$
DECLARE
  v_user_role text;
  v_is_enabled boolean;
BEGIN
  -- Obtener rol del usuario
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;

  -- Si no se encuentra el usuario, denegar
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;

  -- Developers siempre tienen acceso
  IF v_user_role = 'developer' THEN
    RETURN true;
  END IF;

  -- Verificar permiso específico
  SELECT is_enabled INTO v_is_enabled
  FROM feature_permissions
  WHERE feature_name = p_feature_name
  AND role = v_user_role;

  -- Si no existe el permiso, denegar por defecto
  RETURN COALESCE(v_is_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. VISTA: Permisos Actuales por Usuario
-- =====================================================

CREATE OR REPLACE VIEW user_feature_permissions AS
SELECT
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  fp.feature_name,
  fp.is_enabled,
  fp.controlled_by
FROM profiles p
CROSS JOIN feature_permissions fp
WHERE fp.role = p.role;

-- =====================================================
-- 6. REGISTRAR CAMBIOS DE PERMISOS EN ACTIVIDAD
-- =====================================================

CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si cambió is_enabled
  IF (TG_OP = 'UPDATE' AND OLD.is_enabled != NEW.is_enabled) THEN
    INSERT INTO activity_history (
      user_id,
      action_type,
      entity_type,
      entity_id,
      details
    ) VALUES (
      NEW.updated_by,
      'update',
      'feature_permission',
      NEW.id,
      jsonb_build_object(
        'feature_name', NEW.feature_name,
        'role', NEW.role,
        'old_status', OLD.is_enabled,
        'new_status', NEW.is_enabled,
        'controlled_by', NEW.controlled_by
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_permission_change
  AFTER UPDATE ON feature_permissions
  FOR EACH ROW
  EXECUTE FUNCTION log_permission_change();
