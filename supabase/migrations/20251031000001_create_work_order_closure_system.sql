/*
  # Sistema de Cierre de Órdenes de Trabajo

  1. Nuevas Tablas
    - `work_order_closures`
      - `id` (uuid, primary key)
      - `work_order_id` (uuid, foreign key to work_orders)
      - `closed_by_technician_id` (uuid, foreign key to profiles)
      - `closure_date` (date)
      - `signer_name` (text)
      - `signature_data` (text, base64 image)
      - `notes` (text, optional)
      - `pdf_url` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `work_order_closure_photos`
      - `id` (uuid, primary key)
      - `closure_id` (uuid, foreign key to work_order_closures)
      - `photo_url` (text)
      - `photo_order` (integer, 1-4)
      - `created_at` (timestamptz)

  2. Storage
    - Crear bucket `work-order-photos` para almacenar fotos de cierre

  3. Seguridad
    - Enable RLS on `work_order_closures` table
    - Enable RLS on `work_order_closure_photos` table
    - Add policies for technicians, admins, and developers to create closures
    - Add policies for all authenticated users to view closures
    - Add storage policies for uploading and viewing photos
*/

-- Create work_order_closures table
CREATE TABLE IF NOT EXISTS work_order_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  closed_by_technician_id uuid REFERENCES profiles(id) NOT NULL,
  closure_date date DEFAULT CURRENT_DATE NOT NULL,
  signer_name text NOT NULL,
  signature_data text NOT NULL,
  notes text,
  pdf_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(work_order_id)
);

-- Create work_order_closure_photos table
CREATE TABLE IF NOT EXISTS work_order_closure_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id uuid REFERENCES work_order_closures(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  photo_order integer CHECK (photo_order >= 1 AND photo_order <= 4) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(closure_id, photo_order)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_closures_work_order ON work_order_closures(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_closures_technician ON work_order_closures(closed_by_technician_id);
CREATE INDEX IF NOT EXISTS idx_work_order_closures_date ON work_order_closures(closure_date);
CREATE INDEX IF NOT EXISTS idx_work_order_closure_photos_closure ON work_order_closure_photos(closure_id);

-- Enable RLS
ALTER TABLE work_order_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_closure_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_order_closures

-- Technicians, admins, and developers can create closures
CREATE POLICY "Technicians can create work order closures"
  ON work_order_closures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = closed_by_technician_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

-- All authenticated users can view closures
CREATE POLICY "Authenticated users can view work order closures"
  ON work_order_closures
  FOR SELECT
  TO authenticated
  USING (true);

-- Technicians can update their own closures within 24 hours
CREATE POLICY "Technicians can update own recent closures"
  ON work_order_closures
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = closed_by_technician_id AND
    created_at > (now() - interval '24 hours')
  )
  WITH CHECK (
    auth.uid() = closed_by_technician_id AND
    created_at > (now() - interval '24 hours')
  );

-- Admins and developers can update any closure
CREATE POLICY "Admins can update any closure"
  ON work_order_closures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'developer')
    )
  );

-- RLS Policies for work_order_closure_photos

-- Technicians can insert photos for their closures
CREATE POLICY "Technicians can add photos to their closures"
  ON work_order_closure_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM work_order_closures
      WHERE work_order_closures.id = closure_id
      AND work_order_closures.closed_by_technician_id = auth.uid()
    )
  );

-- All authenticated users can view photos
CREATE POLICY "Authenticated users can view closure photos"
  ON work_order_closure_photos
  FOR SELECT
  TO authenticated
  USING (true);

-- Create storage bucket for work order photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for work-order-photos bucket

-- Technicians can upload photos
CREATE POLICY "Technicians can upload work order photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-photos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('technician', 'admin', 'developer')
    )
  );

-- All authenticated users can view photos
CREATE POLICY "Authenticated users can view work order photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'work-order-photos');

-- Update work_orders table to track closure status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'is_closed'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN is_closed boolean DEFAULT false;
  END IF;
END $$;

-- Create trigger to update work_order status when closed
CREATE OR REPLACE FUNCTION update_work_order_on_closure()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_orders
  SET
    status = 'completed',
    is_closed = true,
    updated_at = now()
  WHERE id = NEW.work_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_work_order_on_closure
  AFTER INSERT ON work_order_closures
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_on_closure();

-- Create function to get closure with photos
CREATE OR REPLACE FUNCTION get_work_order_closure_with_photos(closure_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'closure', to_jsonb(woc.*),
    'photos', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(wocp.*) ORDER BY wocp.photo_order)
        FROM work_order_closure_photos wocp
        WHERE wocp.closure_id = woc.id
      ),
      '[]'::jsonb
    )
  )
  INTO result
  FROM work_order_closures woc
  WHERE woc.id = closure_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
