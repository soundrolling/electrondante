-- Travel Trip Members Migration
-- Adds support for tracking who created trips and which project members are associated with trips

-- Add created_by field to travel_trips (to track who created the trip)
ALTER TABLE travel_trips 
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_travel_trips_created_by ON travel_trips(created_by);

-- Create junction table for trip members (many-to-many relationship)
CREATE TABLE IF NOT EXISTS travel_trip_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trip_id, user_email)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_travel_trip_members_trip_id ON travel_trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_travel_trip_members_user_email ON travel_trip_members(user_email);
CREATE INDEX IF NOT EXISTS idx_travel_trip_members_user_id ON travel_trip_members(user_id);

-- Add comment to document the table
COMMENT ON TABLE travel_trip_members IS 'Junction table linking travel trips to project members. Allows multiple members per trip and supports group travel scenarios.';

