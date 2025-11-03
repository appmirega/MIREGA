/*
  # Client Portal Features System - Complete Implementation

  ## Overview
  This migration creates all necessary tables and systems for the client portal features:
  - Quotation approval system with client workflow
  - Legal documents storage (Carpeta Cero)
  - Rescue training induction system
  - Emergency visit categorization

  ## New Tables

  ### 1. `quotation_approvals`
  Tracks client approval workflow for quotations
  - `id` (uuid, primary key)
  - `quotation_id` (uuid, references quotations)
  - `client_id` (uuid, references clients)
  - `status` (enum: pending, approved, rejected)
  - `approved_by_name` (text)
  - `approval_date` (timestamptz)
  - `comments` (text)
  - `created_at` (timestamptz)

  ### 2. `legal_documents`
  Stores legal documentation for elevators (Carpeta Cero)
  - `id` (uuid, primary key)
  - `client_id` (uuid, references clients)
  - `elevator_id` (uuid, references elevators, optional)
  - `document_type` (enum: mechanical_plans, electrical_plans, assembly_plans, municipal_permits, contracts, certifications, other)
  - `title` (text)
  - `description` (text)
  - `file_url` (text)
  - `file_name` (text)
  - `file_size` (bigint)
  - `uploaded_by` (uuid, references profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `rescue_training_personnel`
  Personnel registered for rescue training
  - `id` (uuid, primary key)
  - `client_id` (uuid, references clients)
  - `first_name` (text)
  - `last_name` (text)
  - `rut` (text)
  - `position` (text)
  - `email` (text)
  - `phone` (text)
  - `status` (enum: active, inactive)
  - `created_at` (timestamptz)

  ### 4. `rescue_training_sessions`
  Training sessions conducted
  - `id` (uuid, primary key)
  - `client_id` (uuid, references clients)
  - `personnel_id` (uuid, references rescue_training_personnel)
  - `training_date` (date)
  - `trainer_name` (text)
  - `duration_hours` (numeric)
  - `topics_covered` (text[])
  - `certification_issued` (boolean)
  - `certificate_url` (text)
  - `notes` (text)
  - `created_at` (timestamptz)

  ### 5. `rescue_training_documents`
  Training materials and manuals
  - `id` (uuid, primary key)
  - `title` (text)
  - `description` (text)
  - `document_type` (enum: manual, procedure, responsibility_form, other)
  - `file_url` (text)
  - `file_name` (text)
  - `is_active` (boolean)
  - `created_at` (timestamptz)

  ### 6. `rescue_training_requests`
  Client requests for training
  - `id` (uuid, primary key)
  - `client_id` (uuid, references clients)
  - `personnel_count` (integer)
  - `preferred_dates` (text[])
  - `status` (enum: pending, scheduled, completed, cancelled)
  - `scheduled_date` (date)
  - `notes` (text)
  - `created_at` (timestamptz)

  ## Modifications to Existing Tables

  ### `emergency_visits`
  Add categorization field:
  - `failure_category` (enum: technical_failure, external_failure, other)

  ## Security
  - RLS enabled on all tables
  - Clients can only access their own data
  - Admins have full access
  - Proper policies for each role
*/

-- Create custom types
CREATE TYPE quotation_approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE legal_document_type AS ENUM ('mechanical_plans', 'electrical_plans', 'assembly_plans', 'municipal_permits', 'contracts', 'certifications', 'other');
CREATE TYPE training_document_type AS ENUM ('manual', 'procedure', 'responsibility_form', 'other');
CREATE TYPE training_request_status AS ENUM ('pending', 'scheduled', 'completed', 'cancelled');
CREATE TYPE personnel_status AS ENUM ('active', 'inactive');
CREATE TYPE failure_category AS ENUM ('technical_failure', 'external_failure', 'other');

-- =====================================================
-- QUOTATION APPROVALS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status quotation_approval_status NOT NULL DEFAULT 'pending',
  approved_by_name text,
  approval_date timestamptz,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_quotation_approvals_quotation ON quotation_approvals(quotation_id);
CREATE INDEX idx_quotation_approvals_client ON quotation_approvals(client_id);
CREATE INDEX idx_quotation_approvals_status ON quotation_approvals(status);

ALTER TABLE quotation_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own quotation approvals"
  ON quotation_approvals FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update own quotation approvals"
  ON quotation_approvals FOR UPDATE
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

CREATE POLICY "Admins can manage all quotation approvals"
  ON quotation_approvals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =====================================================
-- LEGAL DOCUMENTS TABLE (Carpeta Cero)
-- =====================================================

CREATE TABLE IF NOT EXISTS legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  elevator_id uuid REFERENCES elevators(id) ON DELETE SET NULL,
  document_type legal_document_type NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_legal_documents_client ON legal_documents(client_id);
CREATE INDEX idx_legal_documents_elevator ON legal_documents(elevator_id);
CREATE INDEX idx_legal_documents_type ON legal_documents(document_type);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own legal documents"
  ON legal_documents FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all legal documents"
  ON legal_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =====================================================
-- RESCUE TRAINING PERSONNEL TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rescue_training_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  rut text NOT NULL,
  position text NOT NULL,
  email text,
  phone text,
  status personnel_status NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rescue_personnel_client ON rescue_training_personnel(client_id);
CREATE INDEX idx_rescue_personnel_status ON rescue_training_personnel(status);
CREATE UNIQUE INDEX idx_rescue_personnel_rut_client ON rescue_training_personnel(client_id, rut);

ALTER TABLE rescue_training_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own personnel"
  ON rescue_training_personnel FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert own personnel"
  ON rescue_training_personnel FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all personnel"
  ON rescue_training_personnel FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =====================================================
-- RESCUE TRAINING SESSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rescue_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES rescue_training_personnel(id) ON DELETE CASCADE,
  training_date date NOT NULL,
  trainer_name text NOT NULL,
  duration_hours numeric(4,2) DEFAULT 2.0,
  topics_covered text[],
  certification_issued boolean DEFAULT false,
  certificate_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_training_sessions_client ON rescue_training_sessions(client_id);
CREATE INDEX idx_training_sessions_personnel ON rescue_training_sessions(personnel_id);
CREATE INDEX idx_training_sessions_date ON rescue_training_sessions(training_date);

ALTER TABLE rescue_training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own training sessions"
  ON rescue_training_sessions FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all training sessions"
  ON rescue_training_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =====================================================
-- RESCUE TRAINING DOCUMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rescue_training_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  document_type training_document_type NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_training_documents_type ON rescue_training_documents(document_type);
CREATE INDEX idx_training_documents_active ON rescue_training_documents(is_active);

ALTER TABLE rescue_training_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view active training documents"
  ON rescue_training_documents FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage training documents"
  ON rescue_training_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =====================================================
-- RESCUE TRAINING REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS rescue_training_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  personnel_count integer NOT NULL,
  preferred_dates text[],
  status training_request_status NOT NULL DEFAULT 'pending',
  scheduled_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_training_requests_client ON rescue_training_requests(client_id);
CREATE INDEX idx_training_requests_status ON rescue_training_requests(status);

ALTER TABLE rescue_training_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own training requests"
  ON rescue_training_requests FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create own training requests"
  ON rescue_training_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all training requests"
  ON rescue_training_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- =====================================================
-- ADD FAILURE CATEGORY TO EMERGENCY VISITS
-- =====================================================

-- Agregar categoría de falla a emergency_v2_visits si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'emergency_v2_visits'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'emergency_v2_visits' AND column_name = 'failure_category'
    ) THEN
      ALTER TABLE emergency_v2_visits ADD COLUMN failure_category failure_category DEFAULT 'other';
      CREATE INDEX IF NOT EXISTS idx_emergency_v2_visits_category ON emergency_v2_visits(failure_category);
    END IF;
  END IF;
END $$;

-- =====================================================
-- STORAGE BUCKETS FOR DOCUMENTS
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('legal-documents', 'legal-documents', false),
  ('training-documents', 'training-documents', true),
  ('training-certificates', 'training-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for legal documents
CREATE POLICY "Clients can view own legal documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'legal-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage legal documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'legal-documents' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- Storage policies for training documents (public read)
CREATE POLICY "Anyone can view training documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'training-documents');

CREATE POLICY "Admins can manage training documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'training-documents' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- Storage policies for training certificates
CREATE POLICY "Clients can view own certificates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'training-certificates' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage certificates"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'training-certificates' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );
