-- Supabase Migration: Multi-Room Audio System Tables
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Audio Rooms Table
-- Stores room information including codes, passwords, and metadata
CREATE TABLE IF NOT EXISTS audio_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT true,
  public BOOLEAN DEFAULT false,
  suspended_until TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT code_length CHECK (char_length(code) = 6),
  CONSTRAINT code_format CHECK (code ~ '^[A-Z0-9]{6}$')
);

-- Indexes for audio_rooms
CREATE INDEX IF NOT EXISTS idx_rooms_active ON audio_rooms(active, created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON audio_rooms(code) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON audio_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_rooms_suspended ON audio_rooms(suspended_until) WHERE suspended_until IS NOT NULL;

-- Room Participants Table
-- Tracks who joined which rooms and when
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES audio_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname TEXT,
  client_id TEXT,
  role TEXT DEFAULT 'listener' CHECK (role IN ('broadcaster', 'listener')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  connection_duration INTEGER, -- in seconds
  
  -- Constraints
  CONSTRAINT valid_duration CHECK (connection_duration IS NULL OR connection_duration >= 0)
);

-- Indexes for room_participants
CREATE INDEX IF NOT EXISTS idx_participants_room ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_joined ON room_participants(joined_at);
CREATE INDEX IF NOT EXISTS idx_participants_active ON room_participants(room_id, left_at) WHERE left_at IS NULL;

-- Room Analytics Table
-- Aggregated analytics per room per day
CREATE TABLE IF NOT EXISTS room_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES audio_rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  peak_listeners INTEGER DEFAULT 0,
  total_listen_minutes INTEGER DEFAULT 0,
  total_listeners INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  total_packets_sent BIGINT DEFAULT 0,
  total_packets_received BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one record per room per day
  CONSTRAINT unique_room_date UNIQUE (room_id, date)
);

-- Indexes for room_analytics
CREATE INDEX IF NOT EXISTS idx_analytics_room ON room_analytics(room_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON room_analytics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_room_date ON room_analytics(room_id, date);

-- Audit Log Table
-- Tracks security events, room access, and failed auth attempts
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  room_id UUID REFERENCES audio_rooms(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_event_type CHECK (event_type IN (
    'login_success',
    'login_failure',
    'room_created',
    'room_joined',
    'room_left',
    'room_closed',
    'token_refresh',
    'rate_limit_exceeded',
    'invalid_token',
    'room_access_denied'
  ))
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_room ON audit_log(room_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_log(ip_address);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on audio_rooms
CREATE TRIGGER update_audio_rooms_updated_at
  BEFORE UPDATE ON audio_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log room participant left time
CREATE OR REPLACE FUNCTION log_participant_left()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.left_at IS NOT NULL AND OLD.left_at IS NULL THEN
    NEW.connection_duration = EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate connection duration
CREATE TRIGGER calculate_connection_duration
  BEFORE UPDATE ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION log_participant_left();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE audio_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Audio Rooms Policies
-- Users can see their own rooms
CREATE POLICY "Users can view their own rooms"
  ON audio_rooms FOR SELECT
  USING (auth.uid() = created_by);

-- Users can create rooms
CREATE POLICY "Users can create rooms"
  ON audio_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own rooms
CREATE POLICY "Users can update their own rooms"
  ON audio_rooms FOR UPDATE
  USING (auth.uid() = created_by);

-- Users can delete their own rooms
CREATE POLICY "Users can delete their own rooms"
  ON audio_rooms FOR DELETE
  USING (auth.uid() = created_by);

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access to audio_rooms"
  ON audio_rooms FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Room Participants Policies
-- Users can view participants in rooms they created or joined
CREATE POLICY "Users can view participants in their rooms"
  ON room_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audio_rooms 
      WHERE audio_rooms.id = room_participants.room_id 
      AND audio_rooms.created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Users can insert themselves as participants
CREATE POLICY "Users can join rooms"
  ON room_participants FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own participation
CREATE POLICY "Users can update their own participation"
  ON room_participants FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Service role full access
CREATE POLICY "Service role full access to room_participants"
  ON room_participants FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Room Analytics Policies
-- Users can view analytics for their own rooms
CREATE POLICY "Users can view their room analytics"
  ON room_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audio_rooms 
      WHERE audio_rooms.id = room_analytics.room_id 
      AND audio_rooms.created_by = auth.uid()
    )
  );

-- Service role can insert/update analytics
CREATE POLICY "Service role full access to room_analytics"
  ON room_analytics FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Audit Log Policies
-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Service role full access to audit logs
CREATE POLICY "Service role full access to audit_log"
  ON audit_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Helper Views

-- Active Rooms View
CREATE OR REPLACE VIEW active_rooms_view AS
SELECT 
  r.id,
  r.code,
  r.created_by,
  r.created_at,
  r.metadata,
  COUNT(DISTINCT p.id) FILTER (WHERE p.left_at IS NULL) as current_listeners,
  COUNT(DISTINCT p.id) as total_listeners,
  MAX(p.joined_at) as last_activity
FROM audio_rooms r
LEFT JOIN room_participants p ON r.id = p.room_id
WHERE r.active = true
GROUP BY r.id, r.code, r.created_by, r.created_at, r.metadata;

-- Room Statistics View
CREATE OR REPLACE VIEW room_statistics_view AS
SELECT 
  r.id,
  r.code,
  r.created_at,
  COUNT(DISTINCT p.id) as total_participants,
  SUM(p.connection_duration) as total_listen_seconds,
  AVG(p.connection_duration) as avg_session_duration,
  MAX(ra.peak_listeners) as peak_listeners
FROM audio_rooms r
LEFT JOIN room_participants p ON r.id = p.room_id
LEFT JOIN room_analytics ra ON r.id = ra.room_id
GROUP BY r.id, r.code, r.created_at;

-- Comments for documentation
COMMENT ON TABLE audio_rooms IS 'Stores room information including codes, passwords, and metadata';
COMMENT ON TABLE room_participants IS 'Tracks who joined which rooms and connection duration';
COMMENT ON TABLE room_analytics IS 'Aggregated analytics per room per day';
COMMENT ON TABLE audit_log IS 'Security audit log for authentication and room access events';

COMMENT ON COLUMN audio_rooms.code IS '6-character alphanumeric room code';
COMMENT ON COLUMN audio_rooms.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN audio_rooms.suspended_until IS 'Timestamp when suspended room will be closed (5min grace period)';
COMMENT ON COLUMN room_participants.connection_duration IS 'Duration in seconds, calculated when left_at is set';

