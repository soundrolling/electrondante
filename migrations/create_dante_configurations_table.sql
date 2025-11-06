-- Migration: Create dante_configurations table for storing Dante stagebox settings
-- This table stores Dante configuration files and stagebox settings for reuse across projects

CREATE TABLE IF NOT EXISTS dante_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL, -- User-friendly name for this configuration
  description TEXT, -- Optional description
  file_name VARCHAR(255), -- Original filename if uploaded
  file_content TEXT, -- Dante configuration file content (JSON, XML, or text format)
  file_type VARCHAR(50), -- 'json', 'xml', 'txt', etc.
  stagebox_settings JSONB, -- Structured stagebox settings (channels, routing, etc.)
  device_info JSONB, -- Device information (model, serial, firmware, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_dante_configurations_project_id ON dante_configurations(project_id);
CREATE INDEX IF NOT EXISTS idx_dante_configurations_location_id ON dante_configurations(location_id);
CREATE INDEX IF NOT EXISTS idx_dante_configurations_name ON dante_configurations(name);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_dante_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dante_configurations_updated_at
  BEFORE UPDATE ON dante_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_dante_configurations_updated_at();

-- Add comment to table
COMMENT ON TABLE dante_configurations IS 'Stores Dante configuration files and stagebox settings for reuse across projects and locations. Allows uploading Dante files and saving stagebox configurations for future setups.';

