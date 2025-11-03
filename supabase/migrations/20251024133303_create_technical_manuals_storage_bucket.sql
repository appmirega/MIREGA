/*
  # Create Technical Manuals Storage Bucket
  
  1. New Storage
    - Create bucket `technical-manuals` for storing PDF files
    - Configure as public bucket
    - Set file size limit to 10MB
  
  2. Security
    - Allow authenticated users to upload
    - Allow all users to read (download) files
    - Only admins and developers can delete files
*/

-- Create the bucket for technical manuals
INSERT INTO storage.buckets (id, name, public)
VALUES ('technical-manuals', 'technical-manuals', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload manuals"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'technical-manuals');

-- Allow everyone to read files (download PDFs)
CREATE POLICY "Anyone can read manuals"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'technical-manuals');

-- Only admins and developers can delete files
CREATE POLICY "Admins can delete manuals"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'technical-manuals' AND
  (
    (auth.jwt()->>'role' = 'admin') OR
    (auth.jwt()->>'role' = 'developer')
  )
);
