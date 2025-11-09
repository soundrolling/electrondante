-- Migration: Add color_button_id column to nodes table
-- This column stores a reference to a color button for mic nodes in the Mic Placement view
-- Color buttons allow users to quickly apply consistent colors to multiple mic nodes
-- NOTE: This migration should be run AFTER create_mic_color_buttons_table.sql

ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS color_button_id UUID;

-- Add foreign key constraint (only if mic_color_buttons table exists and constraint doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mic_color_buttons') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_nodes_color_button_id'
    ) THEN
      ALTER TABLE nodes 
      ADD CONSTRAINT fk_nodes_color_button_id 
      FOREIGN KEY (color_button_id) 
      REFERENCES mic_color_buttons(id) 
      ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

COMMENT ON COLUMN nodes.color_button_id IS 'Reference to a color button that defines the border color and label background color for this mic node in Mic Placement view.';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_nodes_color_button_id ON nodes(color_button_id);

