-- Venues Maps Link Migration Script
-- Run this SQL in your Supabase SQL editor to add the missing maps_link column to the venues table

-- Add the maps_link column to venues table
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS maps_link TEXT;

-- Optional: Add a comment to document the column purpose
COMMENT ON COLUMN venues.maps_link IS 'Google Maps link or map URL for the venue location';
