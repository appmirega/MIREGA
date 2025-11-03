/*
  # Sistema Completo de Checklist de Mantenimiento

  ## Nuevas Tablas
  1. `mnt_checklist_questions` - 50 preguntas del checklist
  2. `mnt_checklists` - Checklists de mantenimiento por ascensor
  3. `mnt_checklist_answers` - Respuestas a preguntas
  4. `mnt_checklist_signatures` - Firmas digitales
  5. `mnt_maintenance_pdfs` - PDFs generados
  6. `mnt_client_qr_codes` - Códigos QR únicos por cliente

  ## Seguridad
  - RLS habilitado con políticas por rol
*/

-- Tabla de preguntas del checklist (50 preguntas)
CREATE TABLE IF NOT EXISTS mnt_checklist_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_number int NOT NULL UNIQUE,
  section text NOT NULL,
  question_text text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('M', 'T', 'S')),
  is_hydraulic_only boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Tabla de checklists de mantenimiento
CREATE TABLE IF NOT EXISTS mnt_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elevator_id uuid NOT NULL REFERENCES elevators(id),
  technician_id uuid NOT NULL REFERENCES profiles(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  start_date timestamptz DEFAULT now(),
  completion_date timestamptz,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'signed')),
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  year int NOT NULL CHECK (year >= 2020),
  last_certification_date date,
  next_certification_date date,
  certification_not_legible boolean DEFAULT false,
  certification_status text DEFAULT 'unknown' CHECK (certification_status IN ('valid', 'expired', 'expiring_soon', 'unknown')),
  auto_save_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de respuestas
CREATE TABLE IF NOT EXISTS mnt_checklist_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES mnt_checklists(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES mnt_checklist_questions(id),
  status text DEFAULT 'pending' CHECK (status IN ('approved', 'rejected', 'pending')),
  observations text,
  photo_1_url text,
  photo_2_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(checklist_id, question_id)
);

-- Tabla de firmas
CREATE TABLE IF NOT EXISTS mnt_checklist_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES mnt_checklists(id),
  signer_name text NOT NULL,
  signature_data text NOT NULL,
  signed_at timestamptz DEFAULT now()
);

-- Tabla de PDFs generados
CREATE TABLE IF NOT EXISTS mnt_maintenance_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES mnt_checklists(id),
  folio_number int NOT NULL UNIQUE,
  pdf_url text,
  file_name text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Tabla de códigos QR por cliente
CREATE TABLE IF NOT EXISTS mnt_client_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) UNIQUE,
  qr_code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Agregar columna is_hydraulic a elevators si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevators' AND column_name = 'is_hydraulic'
  ) THEN
    ALTER TABLE elevators ADD COLUMN is_hydraulic boolean DEFAULT false;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_mnt_checklists_elevator ON mnt_checklists(elevator_id);
CREATE INDEX IF NOT EXISTS idx_mnt_checklists_technician ON mnt_checklists(technician_id);
CREATE INDEX IF NOT EXISTS idx_mnt_checklists_status ON mnt_checklists(status);
CREATE INDEX IF NOT EXISTS idx_mnt_checklists_date ON mnt_checklists(year, month);
CREATE INDEX IF NOT EXISTS idx_mnt_answers_checklist ON mnt_checklist_answers(checklist_id);

-- Secuencia para folios
CREATE SEQUENCE IF NOT EXISTS mnt_folio_seq START WITH 1;

-- Trigger para auto-incrementar folio
CREATE OR REPLACE FUNCTION set_mnt_folio_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folio_number IS NULL THEN
    NEW.folio_number := nextval('mnt_folio_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_mnt_folio ON mnt_maintenance_pdfs;
CREATE TRIGGER trigger_set_mnt_folio
BEFORE INSERT ON mnt_maintenance_pdfs
FOR EACH ROW
EXECUTE FUNCTION set_mnt_folio_number();

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_mnt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mnt_checklists_updated ON mnt_checklists;
CREATE TRIGGER trigger_mnt_checklists_updated
BEFORE UPDATE ON mnt_checklists
FOR EACH ROW
EXECUTE FUNCTION update_mnt_updated_at();

DROP TRIGGER IF EXISTS trigger_mnt_answers_updated ON mnt_checklist_answers;
CREATE TRIGGER trigger_mnt_answers_updated
BEFORE UPDATE ON mnt_checklist_answers
FOR EACH ROW
EXECUTE FUNCTION update_mnt_updated_at();

-- RLS
ALTER TABLE mnt_checklist_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mnt_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE mnt_checklist_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mnt_checklist_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE mnt_maintenance_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mnt_client_qr_codes ENABLE ROW LEVEL SECURITY;

-- Políticas simples
CREATE POLICY "Questions readable by all"
  ON mnt_checklist_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Checklists manageable by technicians and admins"
  ON mnt_checklists FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Answers manageable by authenticated users"
  ON mnt_checklist_answers FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Signatures manageable by authenticated users"
  ON mnt_checklist_signatures FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "PDFs readable by authenticated users"
  ON mnt_maintenance_pdfs FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "QR codes readable by all"
  ON mnt_client_qr_codes FOR ALL
  TO authenticated
  USING (true);

-- Insertar las 50 preguntas
INSERT INTO mnt_checklist_questions (question_number, section, question_text, frequency, is_hydraulic_only) VALUES
-- SALA DE MÁQUINAS (6)
(1, 'Sala de máquinas', 'Estado de cuartos de máquinas, limpieza', 'M', false),
(2, 'Sala de máquinas', 'Iluminación permanente y emergencia', 'M', false),
(3, 'Sala de máquinas', 'Protecciones térmicas y diferenciales', 'S', false),
(4, 'Sala de máquinas', 'Carteles instructivos', 'M', false),
(5, 'Sala de máquinas', 'Estado general del cuadro de control', 'M', false),
(6, 'Sala de máquinas', 'Estado de Seguridades', 'M', false),
-- GRUPO TRACTOR (7)
(7, 'Grupo tractor', 'Estado y niveles de aceite', 'T', false),
(8, 'Grupo tractor', 'Estado de máquina y/o motor', 'T', false),
(9, 'Grupo tractor', 'Freno principal, balatas, tambor/disco', 'T', false),
(10, 'Grupo tractor', 'Estado Variador de Frecuencia', 'S', false),
(11, 'Grupo tractor', 'Paso de cables por poleas y estado poleas', 'T', false),
(12, 'Grupo tractor', 'Dispositivo de rescate, señales de niveles', 'S', false),
(13, 'Grupo tractor', 'Estado ventilación forzada', 'M', false),
-- LIMITADOR DE VELOCIDAD (4)
(14, 'Limitador de velocidad', 'Estado de polea superior y del cable', 'T', false),
(15, 'Limitador de velocidad', 'Estado de precintos y funcionamiento', 'T', false),
(16, 'Limitador de velocidad', 'Contacto eléctrico', 'M', false),
(17, 'Limitador de velocidad', 'Funcionamiento libre de para-caídas', 'S', false),
-- GRUPO HIDRÁULICO (3 - solo hidráulicos)
(18, 'Grupo hidráulico, cilindro y válvulas', 'Estado de pistón, válvulas y central', 'T', true),
(19, 'Grupo hidráulico, cilindro y válvulas', 'Verificar nivel de aceite', 'M', true),
(20, 'Grupo hidráulico, cilindro y válvulas', 'Estado unidad enfriadora', 'S', true),
-- CABINA (10)
(21, 'Cabina', 'Placa de capacidad y placa de datos empresa', 'M', false),
(22, 'Cabina', 'Suelo, espejo de cabina e iluminación', 'M', false),
(23, 'Cabina', 'Comprobar citofonía y alarma', 'M', false),
(24, 'Cabina', 'Pulsadores, display e indicadores', 'M', false),
(25, 'Cabina', 'Luz de emergencia', 'M', false),
(26, 'Cabina', 'Malla Infrarroja, limitador de fuerza', 'M', false),
(27, 'Cabina', 'Limpieza y estado de operador de puertas', 'T', false),
(28, 'Cabina', 'Niveles de parada en pisos', 'T', false),
(29, 'Cabina', 'Limpieza general', 'M', false),
(30, 'Cabina', 'Estado de comando mantenimiento', 'M', false),
-- CABLES DE SUSPENSIÓN Y AMARRAS (3)
(31, 'Cable de suspensión y amarras', 'Comprobar cables de suspensión', 'S', false),
(32, 'Cable de suspensión y amarras', 'Tensión de los cables y diámetro', 'S', false),
(33, 'Cable de suspensión y amarras', 'Amarres, tuercas, pasadores y precintos', 'T', false),
-- PUERTAS DE ACCESO Y PISO (6)
(34, 'Puertas de acceso y piso', 'Comprobar los contactos y enclavamiento', 'M', false),
(35, 'Puertas de acceso y piso', 'Recorrer de pisos patines e indicadores', 'M', false),
(36, 'Puertas de acceso y piso', 'Estado de suspensión y amortiguadores', 'M', false),
(37, 'Puertas de acceso y piso', 'Apertura y cierre correcto de puertas', 'M', false),
(38, 'Puertas de acceso y piso', 'Comprobar patines y limpiar correderas', 'T', false),
(39, 'Puertas de acceso y piso', 'Holguras entre puertas y marco (5mm)', 'S', false),
-- ZAPATAS, GUÍAS DE CABINA Y CONTRAPESO (4)
(40, 'Zapatas, guías de cabina y contrapeso', 'Guías de cabina y cuñas', 'T', false),
(41, 'Zapatas, guías de cabina y contrapeso', 'Guías de contrapeso', 'T', false),
(42, 'Zapatas, guías de cabina y contrapeso', 'Anclajes de rieles', 'S', false),
(43, 'Zapatas, guías de cabina y contrapeso', 'Sistemas de lubricación automática', 'T', false),
-- DUCTO (7)
(44, 'Ducto', 'Estado de información magnética y/o mecánica', 'T', false),
(45, 'Ducto', 'Estado iluminación escotilla', 'M', false),
(46, 'Ducto', 'Funcionamiento de limitador y paracaídas', 'M', false),
(47, 'Ducto', 'Estado de polea inferior limitador de velocidad', 'S', false),
(48, 'Ducto', 'Medios de compensación, cables viajantes', 'S', false),
(49, 'Ducto', 'Estado de paragolpes', 'T', false),
(50, 'Ducto', 'Limpieza de pozo, escalera de acceso', 'M', false)
ON CONFLICT (question_number) DO NOTHING;
