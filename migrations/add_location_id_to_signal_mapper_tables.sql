-- Migration: Add location_id column to nodes and connections tables
-- This allows signal flows to be scoped to specific stages/locations within a project
-- Each stage can have its own independent signal flow configuration

-- Add location_id to nodes table
ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL;

-- Add location_id to connections table
ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL;

-- Create indexes for faster lookups by location
CREATE INDEX IF NOT EXISTS idx_nodes_location_id ON nodes(location_id);
CREATE INDEX IF NOT EXISTS idx_connections_location_id ON connections(location_id);

-- Create composite indexes for common queries (project + location)
CREATE INDEX IF NOT EXISTS idx_nodes_project_location ON nodes(project_id, location_id);
CREATE INDEX IF NOT EXISTS idx_connections_project_location ON connections(project_id, location_id);

-- Add comments
COMMENT ON COLUMN nodes.location_id IS 'Optional location/stage ID. When set, this node belongs to a specific stage. When NULL, node is project-wide.';
COMMENT ON COLUMN connections.location_id IS 'Optional location/stage ID. When set, this connection belongs to a specific stage. When NULL, connection is project-wide.';

