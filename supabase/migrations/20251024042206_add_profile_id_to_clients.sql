/*
  # Add profile_id to clients table
  
  1. Changes
    - Add profile_id column to clients table if it doesn't exist
    - Add foreign key constraint to profiles table
    - Create index for performance
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add profile_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_clients_profile_id ON clients(profile_id);
  END IF;
END $$;
