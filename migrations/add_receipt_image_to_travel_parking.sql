-- Migration: Add receipt_image_path column to travel_parking table
-- This allows parking entries to have two photos: one of the car and one of the receipt
--
-- The existing image_path column will be used for the car photo
-- The new receipt_image_path column will be used for the receipt photo

-- Add receipt_image_path column if it doesn't exist
ALTER TABLE travel_parking 
ADD COLUMN IF NOT EXISTS receipt_image_path TEXT;

-- Update comments to clarify the purpose of each column
COMMENT ON COLUMN travel_parking.image_path IS 'Path to the car photo in Supabase storage (parking-images bucket)';
COMMENT ON COLUMN travel_parking.receipt_image_path IS 'Path to the receipt photo in Supabase storage (parking-images bucket)';

-- ============================================================================
-- Summary
-- ============================================================================
-- This migration adds support for two images per parking entry:
-- 1. image_path - Photo of the car (existing column)
-- 2. receipt_image_path - Photo of the receipt (new column)
--
-- Both images are stored in the parking-images storage bucket.
-- ============================================================================

