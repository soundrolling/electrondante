-- Schedules Recording Day Migration Script
-- Run this SQL in your Supabase SQL editor to add recording day ID support to schedules

-- Add stage_hour_id column to schedules table
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS stage_hour_id BIGINT;

-- Add foreign key constraint to stage_hours table
ALTER TABLE schedules 
ADD CONSTRAINT fk_schedules_stage_hour_id 
FOREIGN KEY (stage_hour_id) 
REFERENCES stage_hours(id) 
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_schedules_stage_hour_id ON schedules(stage_hour_id);

-- Backfill: assign stage_hour_id where schedule start falls within stage_hours window
UPDATE schedules s
SET stage_hour_id = sh.id
FROM stage_hours sh
WHERE s.stage_hour_id IS NULL
  AND s.location_id = sh.stage_id
  AND s.project_id = sh.project_id
  AND (
    -- Schedule falls within same-day window
    (
      s.recording_date::date = DATE(sh.start_datetime)
      AND s.start_time >= TO_CHAR(sh.start_datetime, 'HH24:MI:SS')
      AND s.start_time <= TO_CHAR(sh.end_datetime, 'HH24:MI:SS')
    )
    OR
    -- Stage hour spans midnight
    (
      DATE(sh.start_datetime) != DATE(sh.end_datetime)
      AND (
        (s.recording_date::date = DATE(sh.start_datetime) AND s.start_time >= TO_CHAR(sh.start_datetime, 'HH24:MI:SS'))
        OR
        (s.recording_date::date = DATE(sh.end_datetime) AND s.start_time <= TO_CHAR(sh.end_datetime, 'HH24:MI:SS'))
      )
    )
  );

-- Optional: summary
SELECT 
  COUNT(*) AS total_schedules,
  COUNT(stage_hour_id) AS assigned_schedules,
  COUNT(*) - COUNT(stage_hour_id) AS unassigned_schedules
FROM schedules;


