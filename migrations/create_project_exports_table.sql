-- Migration: Create project_exports table for tracking all project exports
-- This table tracks ZIP exports, signal mapper exports, PDFs, and other exports
-- so users can view and redownload previous exports

CREATE TABLE IF NOT EXISTS project_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL, -- 'full_export', 'signal_mapper', 'pdf', 'csv', 'json', 'xml', etc.
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL, -- Storage path
  file_size BIGINT, -- File size in bytes
  mime_type VARCHAR(100) DEFAULT 'application/zip',
  description TEXT, -- User-friendly description
  export_selections JSONB, -- What was included in the export (for full exports)
  venue_id BIGINT REFERENCES venues(id) ON DELETE SET NULL,
  location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1, -- Version number for tracking multiple exports of same type
  metadata JSONB, -- Additional metadata (e.g., signal mapper config, filters applied)
  
  CONSTRAINT valid_export_type CHECK (export_type IN (
    'full_export', 'signal_mapper', 'pdf', 'csv', 'json', 'xml', 'png', 'other'
  ))
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_exports_project_id ON project_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_project_exports_created_at ON project_exports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_exports_export_type ON project_exports(export_type);
CREATE INDEX IF NOT EXISTS idx_project_exports_location_id ON project_exports(location_id);
CREATE INDEX IF NOT EXISTS idx_project_exports_created_by ON project_exports(created_by);

-- Enable Row Level Security
ALTER TABLE project_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access exports for projects they're members of
CREATE POLICY "Users can view exports for their projects"
  ON project_exports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_exports.project_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create exports for their projects"
  ON project_exports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_exports.project_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update exports for their projects"
  ON project_exports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_exports.project_id
      AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_exports.project_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete exports for their projects"
  ON project_exports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_exports.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Add comment to table
COMMENT ON TABLE project_exports IS 'Tracks all exports (ZIP files, PDFs, signal mapper exports, etc.) for projects. Allows users to view and redownload previous exports.';

