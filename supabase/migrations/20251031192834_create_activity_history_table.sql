/*
  # Crear Tabla de Historial de Actividad

  1. Nueva Tabla
    - `activity_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - Referencia a profiles
      - `activity_type` (text) - Tipo de actividad
      - `description` (text) - Descripción
      - `metadata` (jsonb) - Datos adicionales
      - `created_at` (timestamptz)
      
  2. Seguridad
    - Enable RLS
    - Add policies for authenticated users
*/

-- Crear tabla de historial de actividad
CREATE TABLE IF NOT EXISTS activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_activity_history_user ON activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_history_type ON activity_history(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_history_created ON activity_history(created_at DESC);

-- Habilitar RLS
ALTER TABLE activity_history ENABLE ROW LEVEL SECURITY;

-- Políticas para activity_history

-- Ver: Usuarios autenticados pueden ver su propio historial
CREATE POLICY "Users can view own activity"
  ON activity_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Ver: Admins y developers pueden ver todo el historial
CREATE POLICY "Admins and developers can view all activity"
  ON activity_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('developer', 'admin')
    )
  );

-- Insertar: Usuarios autenticados pueden insertar su propia actividad
CREATE POLICY "Users can insert own activity"
  ON activity_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
