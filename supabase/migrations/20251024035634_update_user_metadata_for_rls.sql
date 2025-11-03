/*
  # Update User Metadata for RLS
  
  1. Changes
    - Update auth.users metadata with role from profiles table
    - This allows RLS policies to check role from JWT without recursion
  
  2. Notes
    - Updates raw_app_meta_data which is included in JWT tokens
    - This is required for the new RLS policies to work correctly
*/

-- Update auth.users metadata with role from profiles
UPDATE auth.users
SET raw_app_meta_data = 
  COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('role', p.role)
FROM profiles p
WHERE auth.users.id = p.id;

-- Create a function to automatically sync role to auth metadata
CREATE OR REPLACE FUNCTION sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync role changes
DROP TRIGGER IF EXISTS sync_role_to_auth ON profiles;
CREATE TRIGGER sync_role_to_auth
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_role_to_auth();
