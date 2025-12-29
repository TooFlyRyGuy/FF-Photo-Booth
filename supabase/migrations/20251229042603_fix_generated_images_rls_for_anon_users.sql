/*
  # Fix Generated Images RLS for Anonymous Users
  
  The issue is that using TO public doesn't properly work for Supabase's anon role.
  We need to explicitly create policies for both authenticated and anon roles.
  
  1. Drop existing policies
  2. Create separate INSERT policies for authenticated and anon users
  3. Create separate SELECT policies for authenticated and anon users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can insert generated images" ON generated_images;
DROP POLICY IF EXISTS "Anyone can view generated images" ON generated_images;

-- INSERT policies for both user types
CREATE POLICY "Authenticated users can insert generated images"
  ON generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anonymous users can insert generated images"
  ON generated_images
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- SELECT policies for both user types
CREATE POLICY "Authenticated users can view generated images"
  ON generated_images
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anonymous users can view generated images"
  ON generated_images
  FOR SELECT
  TO anon
  USING (true);
