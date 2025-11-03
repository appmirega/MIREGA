/*
  # Agregar Campos Detallados a Ascensores

  1. Nuevos Campos
    - `manufacturer` (text): Fabricante del equipo
    - `serial_number_not_legible` (boolean): Indica si el número de serie no es legible
    - `has_machine_room` (boolean): Indica si tiene sala de máquinas
    - `no_machine_room` (boolean): Indica si no tiene sala de máquinas
    - `stops_all_floors` (boolean): Para en todos los pisos
    - `stops_odd_floors` (boolean): Para solo en pisos impares
    - `stops_even_floors` (boolean): Para solo en pisos pares
    - `classification` (text): Clasificación del ascensor

  2. Cambios
    - Se agregan campos para mejorar el detalle técnico de cada ascensor
    - Se mantienen valores por defecto apropiados
*/

-- Agregar nuevos campos a la tabla elevators
ALTER TABLE elevators
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS serial_number_not_legible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_machine_room boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_machine_room boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stops_all_floors boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS stops_odd_floors boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stops_even_floors boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS classification text DEFAULT 'ascensor_corporativo';

-- Crear índice para clasificación (búsquedas frecuentes)
CREATE INDEX IF NOT EXISTS idx_elevators_classification ON elevators(classification);

-- Crear índice para fabricante (búsquedas frecuentes)
CREATE INDEX IF NOT EXISTS idx_elevators_manufacturer ON elevators(manufacturer);