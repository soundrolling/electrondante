-- Migration: Add label_bg_color column to nodes table
-- This column stores the background color for microphone labels in the Mic Placement view
-- Allows users to customize label background colors for better visibility on floor plans

ALTER TABLE nodes 
ADD COLUMN IF NOT EXISTS label_bg_color TEXT;

-- Add comment to column
COMMENT ON COLUMN nodes.label_bg_color IS 'Background color for microphone labels in Mic Placement view. Can be rgba() format (e.g., rgba(255,255,255,0.92)) or hex format (e.g., #ffffff). Defaults to white if not set.';

