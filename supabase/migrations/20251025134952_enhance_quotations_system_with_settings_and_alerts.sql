/*
  # Mejoras al Sistema de Cotizaciones
  
  ## Descripción
  Actualiza el sistema de cotizaciones existente agregando:
  - Configuración global (quotation_settings)
  - Sistema de alertas (quotation_alerts)
  - Campos adicionales necesarios (urgency, type, elevator_ids array, etc.)
  - Storage bucket para PDFs
  - Triggers automáticos para alertas
  
  ## Cambios a Tablas Existentes
  
  ### quotations (modificada)
  - Agrega: urgency, type, elevator_ids[], pdf_url, work_order_id, notes, updated_at
  - Renombra: valid_until → expiry_date
  - Modifica: elevator_id → elevator_ids (array)
  
  ### quotation_items (ya existe)
  - Se mantiene sin cambios
  
  ## Nuevas Tablas
  
  ### quotation_settings
  - Configuración global de vigencia y alertas
  
  ### quotation_alerts
  - Historial de alertas emitidas
  
  ## Seguridad
  - RLS actualizado para todas las tablas
  - Políticas para storage bucket
*/

-- ============================================
-- TABLA: quotation_settings
-- ============================================
CREATE TABLE IF NOT EXISTS quotation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validity_days integer DEFAULT 30 NOT NULL CHECK (validity_days > 0),
  alert_new_quotation boolean DEFAULT true,
  alert_quotation_completed boolean DEFAULT true,
  alert_urgent_quotation_active boolean DEFAULT true,
  alert_urgent_quotation_days integer DEFAULT 2 CHECK (alert_urgent_quotation_days > 0),
  alert_expiring_quotation boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insertar configuración por defecto
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM quotation_settings LIMIT 1) THEN
    INSERT INTO quotation_settings (
      validity_days,
      alert_new_quotation,
      alert_quotation_completed,
      alert_urgent_quotation_active,
      alert_urgent_quotation_days,
      alert_expiring_quotation
    ) VALUES (30, true, true, true, 2, true);
  END IF;
END $$;

-- ============================================
-- TABLA: quotation_alerts
-- ============================================
CREATE TABLE IF NOT EXISTS quotation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('new', 'urgent', 'expiring', 'completed')),
  sent_to uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  sent_at timestamptz DEFAULT now(),
  email_sent boolean DEFAULT false,
  read_at timestamptz,
  message text
);

-- ============================================
-- MODIFICAR TABLA EXISTENTE: quotations
-- ============================================

-- Agregar nuevos campos
DO $$
BEGIN
  -- urgency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'urgency'
  ) THEN
    ALTER TABLE quotations ADD COLUMN urgency text DEFAULT 'scheduled' CHECK (urgency IN ('urgent', 'priority', 'scheduled'));
  END IF;

  -- type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'type'
  ) THEN
    ALTER TABLE quotations ADD COLUMN type text DEFAULT 'internal' CHECK (type IN ('external', 'internal'));
  END IF;

  -- elevator_ids (array)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'elevator_ids'
  ) THEN
    ALTER TABLE quotations ADD COLUMN elevator_ids uuid[] DEFAULT '{}';
  END IF;

  -- pdf_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE quotations ADD COLUMN pdf_url text;
  END IF;

  -- work_order_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'work_order_id'
  ) THEN
    ALTER TABLE quotations ADD COLUMN work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL;
  END IF;

  -- notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'notes'
  ) THEN
    ALTER TABLE quotations ADD COLUMN notes text;
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE quotations ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  -- quotation_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'quotation_date'
  ) THEN
    ALTER TABLE quotations ADD COLUMN quotation_date date DEFAULT CURRENT_DATE;
  END IF;

  -- expiry_date (renombrar valid_until si existe)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'expiry_date'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'quotations' AND column_name = 'valid_until'
    ) THEN
      ALTER TABLE quotations RENAME COLUMN valid_until TO expiry_date;
    ELSE
      ALTER TABLE quotations ADD COLUMN expiry_date date DEFAULT (CURRENT_DATE + INTERVAL '30 days');
    END IF;
  END IF;
END $$;

-- Migrar datos de elevator_id a elevator_ids si es necesario
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotations' AND column_name = 'elevator_id'
  ) THEN
    -- Copiar datos
    UPDATE quotations
    SET elevator_ids = ARRAY[elevator_id]
    WHERE elevator_id IS NOT NULL AND elevator_ids = '{}';
  END IF;
END $$;

-- Actualizar constraint de status para incluir rejected
DO $$
BEGIN
  ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
  ALTER TABLE quotations ADD CONSTRAINT quotations_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'approved', 'sent'));
END $$;

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_quotations_client ON quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_work_order ON quotations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_alerts_quotation ON quotation_alerts(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_alerts_user ON quotation_alerts(sent_to);
CREATE INDEX IF NOT EXISTS idx_quotation_alerts_unread ON quotation_alerts(sent_to, read_at) WHERE read_at IS NULL;

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_quotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: actualizar timestamp en quotations
DROP TRIGGER IF EXISTS trg_quotations_updated_at ON quotations;
CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_quotation_timestamp();

-- Trigger: actualizar timestamp en quotation_settings
DROP TRIGGER IF EXISTS trg_quotation_settings_updated_at ON quotation_settings;
CREATE TRIGGER trg_quotation_settings_updated_at
  BEFORE UPDATE ON quotation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_quotation_timestamp();

-- Función para recalcular total de cotización
CREATE OR REPLACE FUNCTION recalculate_quotation_total()
RETURNS TRIGGER AS $$
DECLARE
  v_quotation_id uuid;
  v_new_total numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_quotation_id := OLD.quotation_id;
  ELSE
    v_quotation_id := NEW.quotation_id;
  END IF;

  SELECT COALESCE(SUM(total_price), 0)
  INTO v_new_total
  FROM quotation_items
  WHERE quotation_id = v_quotation_id;

  UPDATE quotations
  SET total_amount = v_new_total
  WHERE id = v_quotation_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: recalcular total automáticamente
DROP TRIGGER IF EXISTS trg_recalculate_quotation_total ON quotation_items;
CREATE TRIGGER trg_recalculate_quotation_total
  AFTER INSERT OR UPDATE OR DELETE ON quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quotation_total();

-- Función para crear alerta de nueva cotización
CREATE OR REPLACE FUNCTION create_new_quotation_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_settings quotation_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM quotation_settings LIMIT 1;
  
  IF v_settings.alert_new_quotation THEN
    INSERT INTO quotation_alerts (
      quotation_id,
      alert_type,
      sent_to,
      message
    ) VALUES (
      NEW.id,
      'new',
      NEW.client_id,
      'Nueva cotización #' || NEW.quotation_number || ' disponible'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: alerta automática al crear cotización
DROP TRIGGER IF EXISTS trg_new_quotation_alert ON quotations;
CREATE TRIGGER trg_new_quotation_alert
  AFTER INSERT ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION create_new_quotation_alert();

-- Función para crear alerta cuando se completa cotización
CREATE OR REPLACE FUNCTION create_completed_quotation_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_settings quotation_settings%ROWTYPE;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    SELECT * INTO v_settings FROM quotation_settings LIMIT 1;
    
    IF v_settings.alert_quotation_completed THEN
      INSERT INTO quotation_alerts (
        quotation_id,
        alert_type,
        sent_to,
        message
      ) VALUES (
        NEW.id,
        'completed',
        NEW.created_by,
        'Cotización #' || NEW.quotation_number || ' ha sido completada'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: alerta cuando se completa cotización
DROP TRIGGER IF EXISTS trg_completed_quotation_alert ON quotations;
CREATE TRIGGER trg_completed_quotation_alert
  AFTER UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION create_completed_quotation_alert();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- RLS: quotation_settings
ALTER TABLE quotation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Dev: view quotation settings" ON quotation_settings;
CREATE POLICY "Admin/Dev: view quotation settings"
  ON quotation_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

DROP POLICY IF EXISTS "Admin/Dev: update quotation settings" ON quotation_settings;
CREATE POLICY "Admin/Dev: update quotation settings"
  ON quotation_settings FOR UPDATE
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

-- RLS: quotation_alerts
ALTER TABLE quotation_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users: view their own alerts" ON quotation_alerts;
CREATE POLICY "Users: view their own alerts"
  ON quotation_alerts FOR SELECT
  TO authenticated
  USING (
    sent_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

DROP POLICY IF EXISTS "Users: update their own alerts" ON quotation_alerts;
CREATE POLICY "Users: update their own alerts"
  ON quotation_alerts FOR UPDATE
  TO authenticated
  USING (sent_to = auth.uid())
  WITH CHECK (sent_to = auth.uid());

DROP POLICY IF EXISTS "System: create alerts" ON quotation_alerts;
CREATE POLICY "System: create alerts"
  ON quotation_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- STORAGE BUCKET PARA PDFs
-- ============================================

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('quotation-pdfs', 'quotation-pdfs', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

DROP POLICY IF EXISTS "Admin/Dev can upload quotation PDFs" ON storage.objects;
CREATE POLICY "Admin/Dev can upload quotation PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'quotation-pdfs'
    AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

DROP POLICY IF EXISTS "Admin/Dev can update quotation PDFs" ON storage.objects;
CREATE POLICY "Admin/Dev can update quotation PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'quotation-pdfs'
    AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

DROP POLICY IF EXISTS "Admin/Dev can delete quotation PDFs" ON storage.objects;
CREATE POLICY "Admin/Dev can delete quotation PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'quotation-pdfs'
    AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

DROP POLICY IF EXISTS "Users can download their quotation PDFs" ON storage.objects;
CREATE POLICY "Users can download their quotation PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'quotation-pdfs'
    AND
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'developer', 'technician')
      )
      OR
      EXISTS (
        SELECT 1 FROM quotations q
        WHERE q.pdf_url LIKE '%' || name || '%'
        AND q.client_id = auth.uid()
      )
    )
  );
