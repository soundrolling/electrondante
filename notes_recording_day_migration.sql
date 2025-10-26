-- Notes Recording Day Migration Script
-- Run this SQL in your Supabase SQL editor to add recording day ID support to notes

-- Add stage_hour_id column to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS stage_hour_id BIGINT;

-- Add foreign key constraint to stage_hours table
ALTER TABLE notes 
ADD CONSTRAINT fk_notes_stage_hour_id 
FOREIGN KEY (stage_hour_id) 
REFERENCES stage_hours(id) 
ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_notes_stage_hour_id ON notes(stage_hour_id);

-- Auto-assign existing notes to stage_hours based on timestamp/date match
-- This finds notes that fall within the time range of existing stage_hours
UPDATE notes 
SET stage_hour_id = sh.id
FROM stage_hours sh
WHERE notes.stage_hour_id IS NULL
  AND notes.location_id = sh.stage_id
  AND notes.project_id = sh.project_id
  AND (
    -- Note falls within stage_hour time range
    (notes.recording_date::date = DATE(sh.start_datetime) 
     AND notes.timestamp >= TO_CHAR(sh.start_datetime, 'HH24:MI:SS')
     AND notes.timestamp <= TO_CHAR(sh.end_datetime, 'HH24:MI:SS'))
    OR
    -- Note spans midnight and stage_hour spans midnight
    (DATE(sh.start_datetime) != DATE(sh.end_datetime)
     AND (
       (notes.recording_date::date = DATE(sh.start_datetime) 
        AND notes.timestamp >= TO_CHAR(sh.start_datetime, 'HH24:MI:SS'))
       OR
       (notes.recording_date::date = DATE(sh.end_datetime) 
        AND notes.timestamp <= TO_CHAR(sh.end_datetime, 'HH24:MI:SS'))
     ))
  );

-- Optional: Show summary of assignment results
SELECT 
  COUNT(*) as total_notes,
  COUNT(stage_hour_id) as assigned_notes,
  COUNT(*) - COUNT(stage_hour_id) as unassigned_notes
FROM notes;
