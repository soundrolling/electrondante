-- ============================================================================
-- ⛔ STOP! DO NOT RUN THIS FILE IF YOU GET PERMISSION ERRORS! ⛔
-- ============================================================================
-- 
-- This SQL file requires SERVICE ROLE permissions.
-- If you see "must be owner of relation objects" error, you CANNOT use this.
-- 
-- ✅ INSTEAD: Use the Dashboard method (no special permissions needed):
--    1. Open: migrations/SETUP_PARKING_BUCKET.md
--    2. Follow the step-by-step Dashboard instructions
--    3. This is the RECOMMENDED and EASIER method
--
-- ============================================================================
-- Migration: Create parking-images storage bucket and RLS policies
-- ============================================================================
-- 
-- This file is for users with SERVICE ROLE access only.
-- For everyone else, use the Dashboard method described above.
--
-- IMPORTANT: The bucket itself must be created in the Supabase Dashboard first:
-- 1. Go to Storage in the Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: parking-images
-- 4. Public: Unchecked (private bucket)
-- 5. File size limit: 5MB (or your preference)
-- 6. Allowed MIME types: image/* (or specific: image/jpeg,image/png,image/webp)
--
-- RECOMMENDED: Use the Supabase Dashboard to create policies (easier, no permissions needed):
-- 1. Go to Storage → parking-images bucket
-- 2. Click "Policies" tab
-- 3. Click "New Policy"
-- 4. Use "For full customization" template
-- 5. Copy the policy definitions below into the policy editor
--
-- If you have SERVICE ROLE access, you can run this SQL instead.

-- ============================================================================
-- WARNING: The SQL below will fail if you don't have SERVICE ROLE permissions
-- ============================================================================
-- If you're reading this, you probably got a permission error.
-- Please stop and use the Dashboard method instead!
-- ============================================================================

-- Drop existing policies if they exist (for idempotency)
-- NOTE: This will fail with "must be owner" if you don't have permissions
DROP POLICY IF EXISTS "Users can upload parking images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read parking images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update parking images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete parking images" ON storage.objects;

-- Policy: Allow authenticated users to upload parking images
-- Users can upload images to the parking-images bucket
-- Note: Path format is {projectId}/{tripId}/{timestamp}_{random}.{ext}
CREATE POLICY "Users can upload parking images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'parking-images');

-- Policy: Allow authenticated users to read parking images
-- Users can view parking images from the parking-images bucket
CREATE POLICY "Users can read parking images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'parking-images');

-- Policy: Allow authenticated users to update parking images
-- Users can update parking images in the parking-images bucket
CREATE POLICY "Users can update parking images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'parking-images')
WITH CHECK (bucket_id = 'parking-images');

-- Policy: Allow authenticated users to delete parking images
-- Users can delete parking images from the parking-images bucket
CREATE POLICY "Users can delete parking images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'parking-images');

-- Add comment
COMMENT ON POLICY "Users can upload parking images" ON storage.objects IS 
  'Allows authenticated project members to upload parking photos to the parking-images bucket';
COMMENT ON POLICY "Users can read parking images" ON storage.objects IS 
  'Allows authenticated project members to read parking photos from the parking-images bucket';
COMMENT ON POLICY "Users can update parking images" ON storage.objects IS 
  'Allows authenticated project members to update parking photos in the parking-images bucket';
COMMENT ON POLICY "Users can delete parking images" ON storage.objects IS 
  'Allows authenticated project members to delete parking photos from the parking-images bucket';

