-- Add phone_number column to travel_accommodations table
-- This column stores the phone number for accommodation bookings

ALTER TABLE travel_accommodations
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comment to document the column
COMMENT ON COLUMN travel_accommodations.phone_number IS 'Phone number for the accommodation (optional)';

