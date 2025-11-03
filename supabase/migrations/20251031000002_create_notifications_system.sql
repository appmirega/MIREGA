/*
  # Sistema de Notificaciones y Recordatorios

  1. Nuevas Tablas
    - `notifications`
      - `id` (uuid, primary key)
      - `type` (text) - tipo de notificación
      - `title` (text)
      - `message` (text)
      - `recipient_id` (uuid, foreign key to profiles) - null = todos
      - `metadata` (jsonb) - datos adicionales
      - `is_read` (boolean)
      - `created_at` (timestamptz)

    - `reminders`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `created_by_id` (uuid, foreign key to profiles)
      - `assigned_to_id` (uuid, foreign key to profiles)
      - `due_date` (timestamptz)
      - `priority` (text)
      - `status` (text)
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)

  2. Seguridad
    - Enable RLS on both tables
    - Users can only view their own notifications
    - Admins and technicians can create reminders
    - Users can update their own reminders and notifications
*/

-- Modificar tabla notifications existente para agregar campos faltantes
DO $$
BEGIN
  -- Agregar metadata si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- La tabla ya usa user_id, no necesitamos recipient_id
  -- Simplemente usaremos user_id en lugar de recipient_id
END $$;

-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by_id uuid REFERENCES profiles(id) NOT NULL,
  assigned_to_id uuid REFERENCES profiles(id) NOT NULL,
  due_date timestamptz NOT NULL,
  priority text CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium' NOT NULL,
  status text CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

-- Create indexes (user_id ya tiene índice, solo agregamos los nuevos)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_reminders_assigned_to ON reminders(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_reminders_created_by ON reminders(created_by_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications (ya existen políticas, no las duplicamos)
-- Las políticas originales ya manejan user_id correctamente

-- RLS Policies for reminders

-- Users can view reminders they created or that are assigned to them
CREATE POLICY "Users can view their reminders"
  ON reminders
  FOR SELECT
  TO authenticated
  USING (
    created_by_id = auth.uid() OR
    assigned_to_id = auth.uid()
  );

-- Admins and technicians can create reminders
CREATE POLICY "Admins and technicians can create reminders"
  ON reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'technician', 'developer')
    )
  );

-- Users can update reminders they created or that are assigned to them
CREATE POLICY "Users can update their reminders"
  ON reminders
  FOR UPDATE
  TO authenticated
  USING (
    created_by_id = auth.uid() OR
    assigned_to_id = auth.uid()
  )
  WITH CHECK (
    created_by_id = auth.uid() OR
    assigned_to_id = auth.uid()
  );

-- Users can delete reminders they created
CREATE POLICY "Users can delete their created reminders"
  ON reminders
  FOR DELETE
  TO authenticated
  USING (created_by_id = auth.uid());

-- Function to create notification for all users (usar user_id en lugar de recipient_id)
CREATE OR REPLACE FUNCTION create_notification_for_all(
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (type, title, message, user_id, metadata)
  SELECT p_type, p_title, p_message, id, p_metadata
  FROM profiles
  WHERE role IN ('admin', 'technician', 'client', 'developer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE id = notification_id
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create reminder notification (usar user_id)
CREATE OR REPLACE FUNCTION create_reminder_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (type, title, message, user_id, metadata)
  VALUES (
    'reminder',
    'Nuevo Recordatorio: ' || NEW.title,
    COALESCE(NEW.description, ''),
    NEW.assigned_to_id,
    jsonb_build_object(
      'reminder_id', NEW.id,
      'due_date', NEW.due_date,
      'priority', NEW.priority
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reminder_notification
  AFTER INSERT ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION create_reminder_notification();
