-- Migration for signal_mapper connections table
-- Add pad and phantom_power columns

ALTER TABLE connections
ADD COLUMN IF NOT EXISTS pad BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phantom_power BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN connections.pad IS 'Whether a pad is applied on this connection';
COMMENT ON COLUMN connections.phantom_power IS 'Whether phantom power (+48V) is enabled on this connection';

