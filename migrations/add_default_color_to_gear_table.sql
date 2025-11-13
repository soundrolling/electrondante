-- Add default_color column to gear_table for source gear color assignment
-- This allows sources to have a default color that will be used when placing them in mic placement

ALTER TABLE gear_table
ADD COLUMN IF NOT EXISTS default_color TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN gear_table.default_color IS 'Default color (hex format) for source gear types. Used when placing mics in mic placement view.';

