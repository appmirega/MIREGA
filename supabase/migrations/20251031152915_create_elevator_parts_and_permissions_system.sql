/*
  # Sistema de Partes y Piezas de Ascensores + Sistema de Permisos

  1. Nuevas Tablas
    - `elevator_parts_forms` - Formularios de partes y piezas por ascensor
      - `id` (uuid, primary key)
      - `elevator_id` (uuid, foreign key to elevators)
      - `client_id` (uuid, foreign key to clients)
      - `control_board_model` (text): Modelo de tarjeta de control
      - `motor_type` (text): Tipo de motor
      - `contactor_model` (text): Modelo de contactores
      - `relay_types` (text): Tipos de relés
      - `door_operator_model` (text): Modelo de operador de puertas
      - `encoder_model` (text): Modelo de encoder
      - `inverter_model` (text): Modelo de inversor
      - `brake_type` (text): Tipo de freno
      - `cable_specifications` (text): Especificaciones de cables
      - `guide_rail_type` (text): Tipo de rieles guía
      - `safety_gear_model` (text): Modelo de paracaídas
      - `governor_model` (text): Modelo de limitador de velocidad
      - `buffer_type` (text): Tipo de amortiguadores
      - `additional_notes` (text): Notas adicionales
      - `is_complete` (boolean): Si el formulario está completo
      - `completion_percentage` (integer): Porcentaje de completitud
      - `created_by` (uuid, foreign key to profiles)
      - `last_updated_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `elevator_parts_photos` - Fotos de partes y piezas
      - `id` (uuid, primary key)
      - `parts_form_id` (uuid, foreign key to elevator_parts_forms)
      - `photo_url` (text): URL de la foto en storage
      - `photo_type` (text): Tipo de foto (control_board, motor, general, etc.)
      - `description` (text): Descripción de la foto
      - `uploaded_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)

    - `parts_requests_history` - Historial de solicitudes de repuestos
      - `id` (uuid, primary key)
      - `parts_form_id` (uuid, foreign key to elevator_parts_forms)
      - `elevator_id` (uuid, foreign key to elevators)
      - `part_name` (text): Nombre de la pieza
      - `part_type` (text): Tipo de pieza
      - `quantity` (integer): Cantidad solicitada
      - `model` (text): Modelo de la pieza
      - `size` (text): Tamaño
      - `requested_by` (uuid, foreign key to profiles)
      - `request_date` (timestamptz)
      - `status` (text): Estado de la solicitud
      - `notes` (text): Notas

    - `profile_permissions` - Permisos por perfil
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `permission_key` (text): Llave del permiso
      - `is_enabled` (boolean): Si está habilitado
      - `granted_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage Buckets
    - `elevator-parts-photos` - Para fotos de partes y piezas

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas restrictivas por rol
*/

-- Crear tabla elevator_parts_forms
CREATE TABLE IF NOT EXISTS elevator_parts_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  control_board_model text,
  motor_type text,
  contactor_model text,
  relay_types text,
  door_operator_model text,
  encoder_model text,
  inverter_model text,
  brake_type text,
  cable_specifications text,
  guide_rail_type text,
  safety_gear_model text,
  governor_model text,
  buffer_type text,
  additional_notes text,
  is_complete boolean DEFAULT false,
  completion_percentage integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  last_updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla elevator_parts_photos
CREATE TABLE IF NOT EXISTS elevator_parts_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parts_form_id uuid REFERENCES elevator_parts_forms(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  photo_type text DEFAULT 'general',
  description text,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Crear tabla parts_requests_history
CREATE TABLE IF NOT EXISTS parts_requests_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parts_form_id uuid REFERENCES elevator_parts_forms(id) ON DELETE SET NULL,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE NOT NULL,
  part_name text NOT NULL,
  part_type text,
  quantity integer DEFAULT 1,
  model text,
  size text,
  requested_by uuid REFERENCES profiles(id) NOT NULL,
  request_date timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  notes text
);

-- Crear tabla profile_permissions
CREATE TABLE IF NOT EXISTS profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  permission_key text NOT NULL,
  is_enabled boolean DEFAULT true,
  granted_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, permission_key)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_elevator_parts_forms_elevator ON elevator_parts_forms(elevator_id);
CREATE INDEX IF NOT EXISTS idx_elevator_parts_forms_client ON elevator_parts_forms(client_id);
CREATE INDEX IF NOT EXISTS idx_elevator_parts_photos_form ON elevator_parts_photos(parts_form_id);
CREATE INDEX IF NOT EXISTS idx_parts_requests_elevator ON parts_requests_history(elevator_id);
CREATE INDEX IF NOT EXISTS idx_parts_requests_form ON parts_requests_history(parts_form_id);
CREATE INDEX IF NOT EXISTS idx_profile_permissions_profile ON profile_permissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_permissions_key ON profile_permissions(permission_key);

-- Crear storage bucket para fotos de partes
INSERT INTO storage.buckets (id, name, public)
VALUES ('elevator-parts-photos', 'elevator-parts-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies

-- elevator_parts_forms
ALTER TABLE elevator_parts_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Desarrolladores ven todos los formularios de partes"
  ON elevator_parts_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

CREATE POLICY "Administradores ven todos los formularios de partes"
  ON elevator_parts_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Técnicos ven formularios de sus clientes asignados"
  ON elevator_parts_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'technician'
    )
  );

CREATE POLICY "Clientes ven sus propios formularios de partes"
  ON elevator_parts_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN clients c ON c.profile_id = p.id
      WHERE p.id = auth.uid()
      AND c.id = elevator_parts_forms.client_id
    )
  );

CREATE POLICY "Desarrolladores, admins y técnicos crean formularios"
  ON elevator_parts_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

CREATE POLICY "Desarrolladores, admins y técnicos actualizan formularios"
  ON elevator_parts_forms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

-- elevator_parts_photos
ALTER TABLE elevator_parts_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos los autenticados ven fotos de partes"
  ON elevator_parts_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Desarrolladores, admins y técnicos suben fotos"
  ON elevator_parts_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

-- parts_requests_history
ALTER TABLE parts_requests_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos los autenticados ven historial de solicitudes"
  ON parts_requests_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Desarrolladores, admins y técnicos crean solicitudes"
  ON parts_requests_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );

-- profile_permissions
ALTER TABLE profile_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Desarrolladores ven todos los permisos"
  ON profile_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

CREATE POLICY "Administradores ven permisos de técnicos y clientes"
  ON profile_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = profile_permissions.profile_id
      WHERE p1.id = auth.uid()
      AND p1.role = 'admin'
      AND p2.role IN ('technician', 'client')
    )
  );

CREATE POLICY "Usuarios ven sus propios permisos"
  ON profile_permissions FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Desarrolladores gestionan todos los permisos"
  ON profile_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

CREATE POLICY "Administradores gestionan permisos de técnicos y clientes"
  ON profile_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = profile_permissions.profile_id
      WHERE p1.id = auth.uid()
      AND p1.role = 'admin'
      AND p2.role IN ('technician', 'client')
    )
  );

-- Storage policies para elevator-parts-photos
CREATE POLICY "Usuarios autenticados ven fotos de partes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'elevator-parts-photos');

CREATE POLICY "Desarrolladores, admins y técnicos suben fotos de partes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'elevator-parts-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin', 'technician')
    )
  );