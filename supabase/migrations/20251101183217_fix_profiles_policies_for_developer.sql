/*
  # Fix profiles RLS policies for developer dashboard

  1. Changes
    - Drop duplicate and conflicting policies on profiles table
    - Create clean, unified policies that work with both auth.jwt() and profiles.role
    - Ensure developers can read all profiles for dashboard stats

  2. Security
    - Maintains proper access control
    - Developers and admins can view all profiles
    - Users can view and update their own profile
    - Only admins/developers can manage other profiles
*/

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;

-- Create unified SELECT policy
CREATE POLICY "Users can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'developer')
    )
    OR
    (auth.jwt() ->> 'role') IN ('admin', 'developer')
  );

-- Create INSERT policy (for user creation)
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create UPDATE policy
CREATE POLICY "Users can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'developer')
    )
    OR
    (auth.jwt() ->> 'role') IN ('admin', 'developer')
  )
  WITH CHECK (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'developer')
    )
    OR
    (auth.jwt() ->> 'role') IN ('admin', 'developer')
  );

-- Create DELETE policy (only developers can delete)
CREATE POLICY "Developers can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'developer'
    )
    OR
    (auth.jwt() ->> 'role') = 'developer'
  );
