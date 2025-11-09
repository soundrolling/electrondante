-- Migration: Create mix_presets table for Dante Personal Monitor Mixer
-- This table stores user mix presets (fader levels, pan, mute states)

CREATE TABLE IF NOT EXISTS mix_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  faders JSONB NOT NULL, -- Array of gain values per channel [0.7, 0.5, ...]
  pans JSONB NOT NULL,  -- Array of pan values per channel [-1 to 1]
  mutes JSONB NOT NULL, -- Array of mute states per channel [true, false, ...]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_mix_presets_user_id ON mix_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_mix_presets_updated_at ON mix_presets(updated_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_mix_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mix_presets_updated_at
  BEFORE UPDATE ON mix_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_mix_presets_updated_at();

-- Enable Row Level Security
ALTER TABLE mix_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own presets
CREATE POLICY "Users can view their own presets"
  ON mix_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presets"
  ON mix_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets"
  ON mix_presets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets"
  ON mix_presets FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE mix_presets IS 'Stores user mix presets for Dante Personal Monitor Mixer. Each preset contains fader levels, pan settings, and mute states for all channels.';

