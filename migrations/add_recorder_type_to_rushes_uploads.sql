-- Migration: Add recorder_type and stage_hour_id to rushes_uploads table
-- This allows tracking main and backup recorder uploads per recording day
-- This migration will create the table if it doesn't exist, or add columns if it does

-- First, create the table if it doesn't exist
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
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- New columns for recorder tracking
  recorder_type TEXT CHECK (recorder_type IN ('main', 'backup')),
  stage_hour_id BIGINT REFERENCES stage_hours(id) ON DELETE SET NULL
);

-- Add recorder_type column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rushes_uploads' AND column_name = 'recorder_type'
  ) THEN
    ALTER TABLE rushes_uploads 
    ADD COLUMN recorder_type TEXT CHECK (recorder_type IN ('main', 'backup'));
  END IF;
END $$;

-- Add stage_hour_id column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rushes_uploads' AND column_name = 'stage_hour_id'
  ) THEN
    ALTER TABLE rushes_uploads 
    ADD COLUMN stage_hour_id BIGINT REFERENCES stage_hours(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for faster lookups by stage_hour_id
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_stage_hour_id ON rushes_uploads(stage_hour_id);

-- Create index for recorder_type lookups
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_recorder_type ON rushes_uploads(recorder_type);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_stage_recorder ON rushes_uploads(location_id, stage_hour_id, recorder_type);

-- Create other indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_project_id ON rushes_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_location_id ON rushes_uploads(location_id);
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_upload_status ON rushes_uploads(upload_status);
CREATE INDEX IF NOT EXISTS idx_rushes_uploads_project_status ON rushes_uploads(project_id, upload_status);

-- Create function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_rushes_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at (drop and recreate to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_update_rushes_uploads_updated_at ON rushes_uploads;
CREATE TRIGGER trigger_update_rushes_uploads_updated_at
  BEFORE UPDATE ON rushes_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_rushes_uploads_updated_at();

-- Enable RLS (Row Level Security) if not already enabled
ALTER TABLE rushes_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$ 
BEGIN
  -- Policy: Users can view rushes_uploads for projects they are members of
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rushes_uploads' AND policyname = 'Users can view rushes_uploads for their projects'
  ) THEN
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
  END IF;

  -- Policy: Users can insert rushes_uploads for projects they are members of
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rushes_uploads' AND policyname = 'Users can insert rushes_uploads for their projects'
  ) THEN
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
  END IF;

  -- Policy: Users can update rushes_uploads for projects they are members of
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rushes_uploads' AND policyname = 'Users can update rushes_uploads for their projects'
  ) THEN
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
  END IF;

  -- Policy: Users can delete rushes_uploads for projects they are members of
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rushes_uploads' AND policyname = 'Users can delete rushes_uploads for their projects'
  ) THEN
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
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE rushes_uploads IS 'Tracks BWF audio file uploads to Frame.io for project rushes management';
COMMENT ON COLUMN rushes_uploads.recorder_type IS 'Type of recorder: main or backup';
COMMENT ON COLUMN rushes_uploads.stage_hour_id IS 'Recording day (stage hour) this upload belongs to';

