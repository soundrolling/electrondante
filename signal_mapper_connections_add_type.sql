-- Add connection_type column to connections to describe the transport type
-- e.g., Mic, Line, Dante, Midi, Madi

ALTER TABLE connections
ADD COLUMN IF NOT EXISTS connection_type TEXT;

COMMENT ON COLUMN connections.connection_type IS 'Transport type for the connection (Mic, Line, Dante, Midi, Madi)';


