-- Migration: Create transformer_input_gain table for tracking gain staging
-- This table stores gain values (in dB) for each input on transformer nodes
-- to help track gain staging throughout the signal chain

CREATE TABLE IF NOT EXISTS transformer_input_gain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  input_number INTEGER NOT NULL, -- Input number on the transformer (1-based)
  gain_db NUMERIC(5, 1) DEFAULT 0, -- Gain value in dB (e.g., -20.0, 0.0, +20.0)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(node_id, input_number)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transformer_input_gain_node_id ON transformer_input_gain(node_id);
CREATE INDEX IF NOT EXISTS idx_transformer_input_gain_project_id ON transformer_input_gain(project_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_transformer_input_gain_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transformer_input_gain_updated_at
  BEFORE UPDATE ON transformer_input_gain
  FOR EACH ROW
  EXECUTE FUNCTION update_transformer_input_gain_updated_at();

-- Add comment to table
COMMENT ON TABLE transformer_input_gain IS 'Stores gain values (in dB) for each input on transformer nodes to track gain staging throughout the signal chain.';

