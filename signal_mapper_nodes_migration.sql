-- Migration for signal_mapper nodes table
-- Add rotation and track_name columns

ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS rotation DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS track_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN nodes.rotation IS 'Rotation angle in degrees (0-360) for mic placement visualization';
COMMENT ON COLUMN nodes.track_name IS 'User-defined track name for the mic/source (e.g. "Stage L", "Stage R")';

