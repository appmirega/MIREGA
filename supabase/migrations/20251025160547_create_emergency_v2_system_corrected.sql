/*
  # Sistema de Emergencias V2 - Mirega
  
  Sistema completo de emergencias con QR, múltiples ascensores, fotos, firmas,
  observación de 15 días, cotizaciones automáticas y PDFs.
*/

-- emergency_v2_visits
CREATE TABLE IF NOT EXISTS emergency_v2_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  technician_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  building_name text NOT NULL,
  building_address text NOT NULL,
  elevators_in_failure uuid[] DEFAULT '{}' NOT NULL,
  current_elevator_index integer DEFAULT 0,
  total_elevators integer GENERATED ALWAYS AS (array_length(elevators_in_failure, 1)) STORED,
  visit_date date DEFAULT CURRENT_DATE NOT NULL,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  signature_name text,
  signature_url text,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  pdf_url text,
  pdf_filename text,
  notes text,
  last_saved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- emergency_v2_reports
CREATE TABLE IF NOT EXISTS emergency_v2_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES emergency_v2_visits(id) ON DELETE CASCADE NOT NULL,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE NOT NULL,
  report_number text UNIQUE NOT NULL,
  initial_status text NOT NULL CHECK (initial_status IN ('stopped', 'running')),
  failure_details text NOT NULL,
  failure_photos_count integer DEFAULT 0,
  final_status text NOT NULL CHECK (final_status IN ('operational', 'under_observation', 'stopped')),
  observations text NOT NULL,
  observation_photos_count integer DEFAULT 0,
  requires_parts boolean DEFAULT false,
  requires_repair boolean DEFAULT false,
  requires_technician_support boolean DEFAULT false,
  support_details text,
  quotation_request_created boolean DEFAULT false,
  quotation_request_id uuid,
  under_observation boolean DEFAULT false,
  observation_start_date timestamptz,
  observation_end_date timestamptz,
  observation_closed boolean DEFAULT false,
  observation_closure_reason text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(visit_id, elevator_id)
);

-- emergency_v2_photos
CREATE TABLE IF NOT EXISTS emergency_v2_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES emergency_v2_reports(id) ON DELETE CASCADE NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('before', 'after')),
  photo_url text NOT NULL,
  photo_order integer NOT NULL CHECK (photo_order IN (1, 2)),
  uploaded_at timestamptz DEFAULT now(),
  UNIQUE(report_id, photo_type, photo_order)
);

-- emergency_v2_support_requests
CREATE TABLE IF NOT EXISTS emergency_v2_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES emergency_v2_reports(id) ON DELETE CASCADE NOT NULL,
  requesting_technician_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_technician_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  request_reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
  response_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- emergency_v2_observation_tracking
CREATE TABLE IF NOT EXISTS emergency_v2_observation_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES emergency_v2_reports(id) ON DELETE CASCADE NOT NULL UNIQUE,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE NOT NULL,
  observation_start timestamptz NOT NULL,
  observation_end timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  new_emergency_occurred boolean DEFAULT false,
  new_emergency_report_id uuid REFERENCES emergency_v2_reports(id) ON DELETE SET NULL,
  closure_status text CHECK (closure_status IN ('operational', 'requires_parts', 'requires_repair', 'requires_support')),
  closure_notes text,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- emergency_v2_quotation_requests
CREATE TABLE IF NOT EXISTS emergency_v2_quotation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES emergency_v2_reports(id) ON DELETE CASCADE NOT NULL,
  elevator_id uuid REFERENCES elevators(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('parts', 'repair', 'both')),
  description text NOT NULL,
  urgency text DEFAULT 'urgent' CHECK (urgency IN ('urgent', 'priority', 'scheduled')),
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'quotation_sent', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_emgv2_visits_client ON emergency_v2_visits(client_id);
CREATE INDEX IF NOT EXISTS idx_emgv2_visits_tech ON emergency_v2_visits(technician_id);
CREATE INDEX IF NOT EXISTS idx_emgv2_visits_status ON emergency_v2_visits(status);
CREATE INDEX IF NOT EXISTS idx_emgv2_visits_date ON emergency_v2_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_emgv2_reports_visit ON emergency_v2_reports(visit_id);
CREATE INDEX IF NOT EXISTS idx_emgv2_reports_elevator ON emergency_v2_reports(elevator_id);
CREATE INDEX IF NOT EXISTS idx_emgv2_reports_status ON emergency_v2_reports(final_status);
CREATE INDEX IF NOT EXISTS idx_emgv2_reports_obs ON emergency_v2_reports(under_observation);
CREATE INDEX IF NOT EXISTS idx_emgv2_photos_report ON emergency_v2_photos(report_id);
CREATE INDEX IF NOT EXISTS idx_emgv2_support_report ON emergency_v2_support_requests(report_id);
CREATE INDEX IF NOT EXISTS idx_emgv2_obs_report ON emergency_v2_observation_tracking(report_id);
CREATE INDEX IF NOT EXISTS idx_emgv2_obs_active ON emergency_v2_observation_tracking(is_active);
CREATE INDEX IF NOT EXISTS idx_emgv2_quot_report ON emergency_v2_quotation_requests(report_id);

-- Triggers
CREATE OR REPLACE FUNCTION emergency_v2_update_last_saved() RETURNS TRIGGER AS $$
BEGIN
  NEW.last_saved_at = now();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emgv2_auto_save ON emergency_v2_visits;
CREATE TRIGGER trg_emgv2_auto_save BEFORE UPDATE ON emergency_v2_visits FOR EACH ROW EXECUTE FUNCTION emergency_v2_update_last_saved();

CREATE OR REPLACE FUNCTION emergency_v2_generate_report_number() RETURNS TRIGGER AS $$
DECLARE report_count INTEGER; new_number TEXT;
BEGIN
  IF NEW.report_number IS NULL OR NEW.report_number = '' THEN
    SELECT COUNT(*) INTO report_count FROM emergency_v2_reports WHERE DATE(created_at) = CURRENT_DATE;
    new_number := 'EMG-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((report_count + 1)::TEXT, 4, '0');
    NEW.report_number = new_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emgv2_gen_number ON emergency_v2_reports;
CREATE TRIGGER trg_emgv2_gen_number BEFORE INSERT ON emergency_v2_reports FOR EACH ROW EXECUTE FUNCTION emergency_v2_generate_report_number();

CREATE OR REPLACE FUNCTION emergency_v2_create_quotation() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.requires_parts OR NEW.requires_repair) AND NOT COALESCE(NEW.quotation_request_created, false) THEN
    INSERT INTO emergency_v2_quotation_requests (report_id, elevator_id, client_id, request_type, description, urgency)
    SELECT NEW.id, NEW.elevator_id, ev.client_id,
      CASE WHEN NEW.requires_parts AND NEW.requires_repair THEN 'both' WHEN NEW.requires_parts THEN 'parts' ELSE 'repair' END,
      COALESCE(NEW.support_details, NEW.observations, 'Solicitud automática'), 'urgent'
    FROM emergency_v2_visits ev WHERE ev.id = NEW.visit_id;
    NEW.quotation_request_created = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emgv2_quotation ON emergency_v2_reports;
CREATE TRIGGER trg_emgv2_quotation BEFORE INSERT OR UPDATE ON emergency_v2_reports FOR EACH ROW EXECUTE FUNCTION emergency_v2_create_quotation();

CREATE OR REPLACE FUNCTION emergency_v2_start_observation() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.final_status = 'under_observation' AND COALESCE(NEW.under_observation, false) = false THEN
    NEW.under_observation = true;
    NEW.observation_start_date = now();
    NEW.observation_end_date = now() + INTERVAL '15 days';
    INSERT INTO emergency_v2_observation_tracking (report_id, elevator_id, observation_start, observation_end, is_active)
    VALUES (NEW.id, NEW.elevator_id, NEW.observation_start_date, NEW.observation_end_date, true)
    ON CONFLICT (report_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emgv2_observation ON emergency_v2_reports;
CREATE TRIGGER trg_emgv2_observation BEFORE INSERT OR UPDATE ON emergency_v2_reports FOR EACH ROW EXECUTE FUNCTION emergency_v2_start_observation();

CREATE OR REPLACE FUNCTION emergency_v2_update_photo_count() RETURNS TRIGGER AS $$
DECLARE v_report_id uuid; v_before_count integer; v_after_count integer;
BEGIN
  v_report_id := COALESCE(NEW.report_id, OLD.report_id);
  SELECT COUNT(*) FILTER (WHERE photo_type = 'before'), COUNT(*) FILTER (WHERE photo_type = 'after')
  INTO v_before_count, v_after_count FROM emergency_v2_photos WHERE report_id = v_report_id;
  UPDATE emergency_v2_reports SET failure_photos_count = v_before_count, observation_photos_count = v_after_count WHERE id = v_report_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emgv2_photo_count ON emergency_v2_photos;
CREATE TRIGGER trg_emgv2_photo_count AFTER INSERT OR DELETE ON emergency_v2_photos FOR EACH ROW EXECUTE FUNCTION emergency_v2_update_photo_count();

-- RLS
ALTER TABLE emergency_v2_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_v2_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_v2_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_v2_support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_v2_observation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_v2_quotation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Dev full" ON emergency_v2_visits;
CREATE POLICY "Admin/Dev full" ON emergency_v2_visits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'developer')));

DROP POLICY IF EXISTS "Tech manage" ON emergency_v2_visits;
CREATE POLICY "Tech manage" ON emergency_v2_visits FOR ALL TO authenticated USING (technician_id = auth.uid());

DROP POLICY IF EXISTS "Client view" ON emergency_v2_visits;
CREATE POLICY "Client view" ON emergency_v2_visits FOR SELECT TO authenticated USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Admin/Dev full" ON emergency_v2_reports;
CREATE POLICY "Admin/Dev full" ON emergency_v2_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'developer')));

DROP POLICY IF EXISTS "Tech manage" ON emergency_v2_reports;
CREATE POLICY "Tech manage" ON emergency_v2_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM emergency_v2_visits ev WHERE ev.id = visit_id AND ev.technician_id = auth.uid()));

DROP POLICY IF EXISTS "Client view" ON emergency_v2_reports;
CREATE POLICY "Client view" ON emergency_v2_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM emergency_v2_visits ev WHERE ev.id = visit_id AND ev.client_id = auth.uid()));

CREATE POLICY "All auth" ON emergency_v2_photos FOR ALL TO authenticated USING (true);
CREATE POLICY "All auth" ON emergency_v2_support_requests FOR ALL TO authenticated USING (true);
CREATE POLICY "All auth" ON emergency_v2_observation_tracking FOR ALL TO authenticated USING (true);
CREATE POLICY "All auth" ON emergency_v2_quotation_requests FOR ALL TO authenticated USING (true);
