-- Migration: Add stage_hour_id column to nodes and connections tables
-- This allows signal flows to be scoped to specific recording days (stage hours) within a stage
-- Each recording day can have its own independent signal flow configuration

-- Add stage_hour_id to nodes table
ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS stage_hour_id BIGINT REFERENCES stage_hours(id) ON DELETE SET NULL;

-- Add stage_hour_id to connections table
ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS stage_hour_id BIGINT REFERENCES stage_hours(id) ON DELETE SET NULL;

-- Create indexes for faster lookups by stage_hour_id
CREATE INDEX IF NOT EXISTS idx_nodes_stage_hour_id ON nodes(stage_hour_id);
CREATE INDEX IF NOT EXISTS idx_connections_stage_hour_id ON connections(stage_hour_id);

-- Create composite indexes for common queries (project + location + stage_hour)
CREATE INDEX IF NOT EXISTS idx_nodes_project_location_stage_hour ON nodes(project_id, location_id, stage_hour_id);
CREATE INDEX IF NOT EXISTS idx_connections_project_location_stage_hour ON connections(project_id, location_id, stage_hour_id);

-- Add comments
COMMENT ON COLUMN nodes.stage_hour_id IS 'Optional recording day (stage hour) ID. When set, this node belongs to a specific recording day. When NULL, node is stage-wide.';
COMMENT ON COLUMN connections.stage_hour_id IS 'Optional recording day (stage hour) ID. When set, this connection belongs to a specific recording day. When NULL, connection is stage-wide.';

