-- Create connection_port_map table for multi-port mappings between non-source devices
-- One parent connection per device pair, with multiple port-to-port mappings

CREATE TABLE IF NOT EXISTS connection_port_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  from_port integer NOT NULL,
  to_port integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure no duplicate from_port within a connection
  UNIQUE (connection_id, from_port),
  -- Ensure no duplicate to_port within a connection
  UNIQUE (connection_id, to_port)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS connection_port_map_connection_idx ON connection_port_map(connection_id);
CREATE INDEX IF NOT EXISTS connection_port_map_project_idx ON connection_port_map(project_id);

COMMENT ON TABLE connection_port_map IS 'Maps individual ports between non-source devices (transformer-to-transformer, transformer-to-recorder, etc.)';
COMMENT ON COLUMN connection_port_map.from_port IS 'Output port number on the source device';
COMMENT ON COLUMN connection_port_map.to_port IS 'Input/track number on the target device';

