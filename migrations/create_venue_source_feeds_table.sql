-- Migration: Create venue_source_feeds table for Venue Sources Master Node
-- This table stores the configuration for feeds within a Venue Sources node
-- Each feed represents a source type (DJ, Program, HandHeld Mic, etc.) with a specific identifier

CREATE TABLE IF NOT EXISTS venue_source_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL, -- 'dj', 'program', 'handheld_mic', 'stereo_stem', 'mono_stem', etc.
  feed_identifier VARCHAR(10) NOT NULL, -- 'A', 'B', 'C' or '1', '2', '3'
  port_number INTEGER NOT NULL, -- Output port on venue_sources node (1-based)
  channel INTEGER DEFAULT 1, -- 1 for mono, 1=L/2=R for stereo
  output_port_labels JSONB, -- {"1": "DJ A L", "2": "DJ A R"} for stereo sources
  numbering_style VARCHAR(10) DEFAULT 'letters', -- 'letters' or 'numbers'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(node_id, port_number, channel),
  UNIQUE(node_id, source_type, feed_identifier, channel)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_venue_source_feeds_node_id ON venue_source_feeds(node_id);
CREATE INDEX IF NOT EXISTS idx_venue_source_feeds_project_id ON venue_source_feeds(project_id);
CREATE INDEX IF NOT EXISTS idx_venue_source_feeds_source_type ON venue_source_feeds(source_type);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_venue_source_feeds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venue_source_feeds_updated_at
  BEFORE UPDATE ON venue_source_feeds
  FOR EACH ROW
  EXECUTE FUNCTION update_venue_source_feeds_updated_at();

-- Add comment to table
COMMENT ON TABLE venue_source_feeds IS 'Stores feed configuration for Venue Sources master nodes. Each feed represents a source type (DJ, Program, etc.) with a specific identifier and maps to output ports on the venue_sources node.';

-- Example data structure:
-- For a DJ feed "A" (stereo):
--   source_type: 'dj'
--   feed_identifier: 'A'
--   port_number: 1 (for L channel)
--   channel: 1
--   output_port_labels: {"1": "DJ A L"}
-- Then another row for R channel:
--   port_number: 2
--   channel: 2
--   output_port_labels: {"1": "DJ A R"}

