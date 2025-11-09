-- Migration: Create rushes_uploads table
-- This table tracks BWF audio file uploads to Frame.io for rushes management
-- Allows manual tracking of upload status and Frame.io URLs

-- Create rushes_uploads table
CREATE TABLE IF NOT EXISTS rushes_uploads (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  venue_id BIGINT REFERENCES venues(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  frame_io_url TEXT,
  upload_status TEXT NOT NULL DEFAULT 'not_uploaded' CHECK (upload_status IN ('not_uploaded', 'uploaded', 'failed')),
  uploaded_at TIMESTAMP WITH TIME ZONE,
  uploaded_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_project_id ON rushes_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_location_id ON rushes_uploads(location_id);
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_upload_status ON rushes_uploads(upload_status);
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_project_status ON rushes_uploads(project_id, upload_status);

-- Add comments
COMMENT ON TABLE rushes_uploads IS 'Tracks BWF audio file uploads to Frame.io for project rushes management';
COMMENT ON COLUMN rushes_uploads.project_id IS 'Project this rushes file belongs to';
COMMENT ON COLUMN rushes_uploads.location_id IS 'Optional stage/location this file belongs to';
COMMENT ON COLUMN rushes_uploads.venue_id IS 'Optional venue this file belongs to';
COMMENT ON COLUMN rushes_uploads.file_path IS 'Path to the file in Supabase storage';
COMMENT ON COLUMN rushes_uploads.file_name IS 'Original filename';
COMMENT ON COLUMN rushes_uploads.file_size IS 'File size in bytes';
COMMENT ON COLUMN rushes_uploads.frame_io_url IS 'Frame.io project or asset URL (optional)';
COMMENT ON COLUMN rushes_uploads.upload_status IS 'Upload status: not_uploaded, uploaded, or failed';
COMMENT ON COLUMN rushes_uploads.uploaded_at IS 'Timestamp when file was marked as uploaded';
COMMENT ON COLUMN rushes_uploads.uploaded_by IS 'User email or name who marked as uploaded';
COMMENT ON COLUMN rushes_uploads.notes IS 'Optional notes about the upload';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rushes_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_rushes_uploads_updated_at
  BEFORE UPDATE ON rushes_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_rushes_uploads_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE rushes_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can view rushes_uploads for projects they are members of
CREATE POLICY "Users can view rushes_uploads for their projects"
  ON rushes_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = rushes_uploads.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Users can insert rushes_uploads for projects they are members of
CREATE POLICY "Users can insert rushes_uploads for their projects"
  ON rushes_uploads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = rushes_uploads.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Users can update rushes_uploads for projects they are members of
CREATE POLICY "Users can update rushes_uploads for their projects"
  ON rushes_uploads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = rushes_uploads.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
    )
  );

-- Policy: Users can delete rushes_uploads for projects they are members of
CREATE POLICY "Users can delete rushes_uploads for their projects"
  ON rushes_uploads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = rushes_uploads.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
    )
  );

