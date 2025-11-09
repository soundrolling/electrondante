-- Migration: Create mic_color_buttons table
-- This table stores color button definitions for mic placement
-- Similar to quickfire_buttons, but specifically for mic node coloring

CREATE TABLE IF NOT EXISTS mic_color_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id BIGINT REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL, -- Hex color code (e.g., #ff4d4f)
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE mic_color_buttons IS 'Color button definitions for mic placement. Each button defines a color that can be applied to mic nodes, changing both the border color and label background color.';
COMMENT ON COLUMN mic_color_buttons.project_id IS 'The project this color button belongs to. Project-level buttons have location_id = NULL.';
COMMENT ON COLUMN mic_color_buttons.location_id IS 'Optional location-specific color button. If NULL, button is available project-wide.';
COMMENT ON COLUMN mic_color_buttons.name IS 'Display name for the color button (e.g., "Vocals", "Drums")';
COMMENT ON COLUMN mic_color_buttons.color IS 'Hex color code (e.g., #ff4d4f) that will be applied to mic node border and label background';
COMMENT ON COLUMN mic_color_buttons.description IS 'Optional description of what this color represents';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mic_color_buttons_project_id ON mic_color_buttons(project_id);
CREATE INDEX IF NOT EXISTS idx_mic_color_buttons_location_id ON mic_color_buttons(location_id);
CREATE INDEX IF NOT EXISTS idx_mic_color_buttons_project_location ON mic_color_buttons(project_id, location_id);

-- Enable RLS (Row Level Security)
ALTER TABLE mic_color_buttons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (based on project_members table)
-- Allow users to read color buttons for projects they have access to
CREATE POLICY "Users can view color buttons for accessible projects"
  ON mic_color_buttons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
        )
      )
    )
  );

-- Allow users to insert color buttons for projects they can edit
CREATE POLICY "Users can create color buttons for editable projects"
  ON mic_color_buttons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'editor', 'member')
        )
      )
    )
  );

-- Allow users to update color buttons for projects they can edit
CREATE POLICY "Users can update color buttons for editable projects"
  ON mic_color_buttons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'editor', 'member')
        )
      )
    )
  );

-- Allow users to delete color buttons for projects they can edit
CREATE POLICY "Users can delete color buttons for editable projects"
  ON mic_color_buttons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'editor', 'member')
        )
      )
    )
  );

