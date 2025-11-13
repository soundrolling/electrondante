-- Migration: Add additional detail columns to travel_rental_cars table
-- This allows rental car entries to have more comprehensive information
--
-- New columns:
-- - confirmation_number: Confirmation number (separate from reservation number)
-- - driver_name: Name of the primary driver
-- - cost: Rental cost information
-- - insurance: Insurance coverage details

-- Add confirmation_number column if it doesn't exist
ALTER TABLE travel_rental_cars 
ADD COLUMN IF NOT EXISTS confirmation_number TEXT;

-- Add driver_name column if it doesn't exist
ALTER TABLE travel_rental_cars 
ADD COLUMN IF NOT EXISTS driver_name TEXT;

-- Add cost column if it doesn't exist
ALTER TABLE travel_rental_cars 
ADD COLUMN IF NOT EXISTS cost TEXT;

-- Add insurance column if it doesn't exist
ALTER TABLE travel_rental_cars 
ADD COLUMN IF NOT EXISTS insurance TEXT;

-- Add comments to clarify the purpose of each column
COMMENT ON COLUMN travel_rental_cars.confirmation_number IS 'Confirmation number for the rental car reservation';
COMMENT ON COLUMN travel_rental_cars.driver_name IS 'Name of the primary driver';
COMMENT ON COLUMN travel_rental_cars.cost IS 'Rental cost information (e.g., $150/day or $450 total)';
COMMENT ON COLUMN travel_rental_cars.insurance IS 'Insurance coverage details (e.g., Full coverage, CDW included)';

-- ============================================================================
-- Summary
-- ============================================================================
-- This migration adds support for additional rental car details:
-- 1. confirmation_number - Confirmation number (separate from reservation number)
-- 2. driver_name - Name of the primary driver
-- 3. cost - Rental cost information
-- 4. insurance - Insurance coverage details
--
-- All new columns are optional (TEXT, nullable) to maintain backward compatibility.
-- ============================================================================

