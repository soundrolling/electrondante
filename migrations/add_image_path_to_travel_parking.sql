-- Migration: Add image_path column to travel_parking table
-- This allows parking entries to have an associated photo stored in Supabase storage

-- Add image_path column if it doesn't exist
ALTER TABLE travel_parking 
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Add comment
COMMENT ON COLUMN travel_parking.image_path IS 'Path to the parking photo in Supabase storage (parking-images bucket)';

