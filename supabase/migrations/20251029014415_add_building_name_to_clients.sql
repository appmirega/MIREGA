/*
  # Agregar campo "Nombre Edificio" a la tabla clients
  
  1. Cambios
    - Agrega columna `building_name` a la tabla `clients`
    - Este nombre será el identificativo principal del cliente en toda la aplicación
    - Se utilizará en PDFs y búsquedas
    - La razón social seguirá existiendo para fines administrativos
  
  2. Notas
    - El campo es obligatorio (NOT NULL)
    - Debe ser único para facilitar búsquedas
    - Para clientes existentes, se usará el company_name como valor inicial
*/

-- Agregar columna building_name a la tabla clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'building_name'
  ) THEN
    ALTER TABLE clients ADD COLUMN building_name text;
    
    -- Inicializar con el company_name para clientes existentes
    UPDATE clients SET building_name = company_name WHERE building_name IS NULL;
    
    -- Hacer el campo obligatorio después de la migración
    ALTER TABLE clients ALTER COLUMN building_name SET NOT NULL;
  END IF;
END $$;

-- Crear índice para búsquedas rápidas por nombre de edificio
CREATE INDEX IF NOT EXISTS idx_clients_building_name ON clients(building_name);
