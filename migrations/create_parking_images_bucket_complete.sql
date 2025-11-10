-- ============================================================================
-- Complete SQL Migration: Create parking-images Storage Bucket + Policies
-- ============================================================================
-- This file creates the storage bucket AND all RLS policies in one go.
-- 
-- ⚠️  REQUIRES SERVICE ROLE PERMISSIONS ⚠️
-- This SQL must be run with SERVICE ROLE access (not regular SQL editor).
-- If you get permission errors, you need to use the Dashboard method instead.
-- ============================================================================

-- Step 1: Create the storage bucket
-- ============================================================================
-- Attempt to create bucket, but handle permission errors gracefully
DO $$
BEGIN
  -- Try to insert bucket into storage.buckets table
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'parking-images',                    -- id: bucket identifier
    'parking-images',                    -- name: bucket name
    false,                               -- public: false = private bucket (uses signed URLs)
    5242880,                             -- file_size_limit: 5MB in bytes (5 * 1024 * 1024)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']  -- allowed_mime_types: image types
  )
  ON CONFLICT (id) DO NOTHING;            -- If bucket exists, do nothing (idempotent)
  
  RAISE NOTICE '✅ Bucket creation attempted';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot create bucket: Insufficient permissions. Please create "parking-images" bucket via Supabase Dashboard (Storage → New bucket)';
  WHEN OTHERS THEN
    -- Check if bucket already exists
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'parking-images') THEN
      RAISE NOTICE '✅ Bucket "parking-images" already exists';
    ELSE
      RAISE WARNING '⚠️  Could not create bucket. Error: %. Please create "parking-images" bucket via Supabase Dashboard', SQLERRM;
    END IF;
END $$;

-- Add comment to bucket
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads';
-- Note: Individual bucket comments may not be supported, but we'll try
DO $$
BEGIN
  -- Attempt to add comment (may not work on all Supabase versions)
  EXECUTE 'COMMENT ON TABLE storage.buckets IS ''Storage buckets including parking-images for parking photos''';
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if commenting fails
    NULL;
END $$;

-- Step 2: Drop existing policies if they exist (for idempotency)
-- ============================================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload parking images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can read parking images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update parking images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete parking images" ON storage.objects;
  RAISE NOTICE '✅ Existing policies dropped (if they existed)';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot drop policies: Insufficient permissions';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  Error dropping policies: %', SQLERRM;
END $$;

-- Step 3: Create RLS Policies for storage.objects
-- ============================================================================
-- Note: These also require permissions. If they fail, use Dashboard method.

DO $$
BEGIN
  -- Policy 1: Allow authenticated users to upload parking images
  CREATE POLICY "Users can upload parking images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'parking-images');
  
  RAISE NOTICE '✅ Policy 1/4 created: Users can upload parking images';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️  Policy "Users can upload parking images" already exists';
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot create policy: Insufficient permissions. Use Dashboard method instead.';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  Error creating upload policy: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Policy 2: Allow authenticated users to read parking images
  CREATE POLICY "Users can read parking images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'parking-images');
  
  RAISE NOTICE '✅ Policy 2/4 created: Users can read parking images';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️  Policy "Users can read parking images" already exists';
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot create policy: Insufficient permissions. Use Dashboard method instead.';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  Error creating read policy: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Policy 3: Allow authenticated users to update parking images
  CREATE POLICY "Users can update parking images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'parking-images')
  WITH CHECK (bucket_id = 'parking-images');
  
  RAISE NOTICE '✅ Policy 3/4 created: Users can update parking images';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️  Policy "Users can update parking images" already exists';
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot create policy: Insufficient permissions. Use Dashboard method instead.';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  Error creating update policy: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- Policy 4: Allow authenticated users to delete parking images
  CREATE POLICY "Users can delete parking images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'parking-images');
  
  RAISE NOTICE '✅ Policy 4/4 created: Users can delete parking images';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️  Policy "Users can delete parking images" already exists';
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot create policy: Insufficient permissions. Use Dashboard method instead.';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  Error creating delete policy: %', SQLERRM;
END $$;

-- Step 4: Add comments to policies (optional, may fail without permissions)
-- ============================================================================
DO $$
BEGIN
  COMMENT ON POLICY "Users can upload parking images" ON storage.objects IS 
    'Allows authenticated users to upload parking photos to the parking-images bucket';

  COMMENT ON POLICY "Users can read parking images" ON storage.objects IS 
    'Allows authenticated users to read parking photos from the parking-images bucket';

  COMMENT ON POLICY "Users can update parking images" ON storage.objects IS 
    'Allows authenticated users to update parking photos in the parking-images bucket';

  COMMENT ON POLICY "Users can delete parking images" ON storage.objects IS 
    'Allows authenticated users to delete parking photos from the parking-images bucket';
    
  RAISE NOTICE '✅ Policy comments added';
EXCEPTION
  WHEN OTHERS THEN
    -- Comments are optional, so we'll just note if they fail
    RAISE NOTICE 'ℹ️  Could not add policy comments (this is optional)';
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
-- Check if bucket was created successfully
DO $$
DECLARE
  bucket_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'parking-images') INTO bucket_exists;
  
  IF bucket_exists THEN
    RAISE NOTICE '✅ Bucket "parking-images" created successfully';
  ELSE
    RAISE WARNING '⚠️  Bucket "parking-images" may not have been created. Check permissions.';
  END IF;
END $$;

-- Check if policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%parking images%';
  
  IF policy_count = 4 THEN
    RAISE NOTICE '✅ All 4 policies created successfully';
  ELSE
    RAISE WARNING '⚠️  Expected 4 policies, found % policies. Some may have failed.', policy_count;
  END IF;
END $$;

-- ============================================================================
-- Summary & Next Steps
-- ============================================================================
-- This migration attempts to create:
-- 1. Storage bucket: parking-images (private, 5MB limit, image types only)
-- 2. 4 RLS policies for authenticated users (INSERT, SELECT, UPDATE, DELETE)
--
-- ⚠️  IF YOU GOT PERMISSION ERRORS:
-- 
-- You need to use the Supabase Dashboard instead:
-- 1. Create bucket: Storage → New bucket → Name: "parking-images" (private, 5MB)
-- 2. Create policies: Storage → parking-images → Policies tab → Create 4 policies
-- 
-- See migrations/SETUP_PARKING_BUCKET.md for detailed Dashboard instructions.
--
-- After bucket and policies are created, parking photo uploads will work!
-- ============================================================================

