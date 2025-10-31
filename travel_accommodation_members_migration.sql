-- Migration to add member associations to travel accommodations
-- Accommodations can have multiple members staying (many-to-many)

-- Create junction table for accommodation members
CREATE TABLE IF NOT EXISTS travel_accommodation_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  accommodation_id UUID NOT NULL REFERENCES travel_accommodations(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(accommodation_id, user_email)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_accommodation_members_accommodation_id ON travel_accommodation_members(accommodation_id);
CREATE INDEX IF NOT EXISTS idx_travel_accommodation_members_user_email ON travel_accommodation_members(user_email);

-- Enable Row Level Security (RLS)
ALTER TABLE travel_accommodation_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to view accommodation members if they are part of the project
CREATE POLICY "Allow authenticated users to view travel_accommodation_members" ON travel_accommodation_members
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM travel_accommodations ta
    JOIN travel_trips tt ON ta.trip_id = tt.id
    JOIN project_members pm ON tt.project_id = pm.project_id
    WHERE ta.id = travel_accommodation_members.accommodation_id
      AND pm.user_id = auth.uid()
  )
);

-- Allow project contributors/admins to insert/update/delete accommodation members
CREATE POLICY "Allow project contributors/admins to manage travel_accommodation_members" ON travel_accommodation_members
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM travel_accommodations ta
    JOIN travel_trips tt ON ta.trip_id = tt.id
    JOIN project_members pm ON tt.project_id = pm.project_id
    WHERE ta.id = travel_accommodation_members.accommodation_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('admin', 'contributor', 'owner')
  )
);

