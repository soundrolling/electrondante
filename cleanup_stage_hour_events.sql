-- Cleanup script to remove duplicate stage hour calendar events
-- These events were automatically created when stage hours were saved
-- but should only exist as reference information in stage_hours table

-- Delete calendar events that have:
-- 1. Category = 'recording' 
-- 2. Title = 'Stage Hour'
-- 3. Have a corresponding stage_hours entry

DELETE FROM calendar_events 
WHERE category = 'recording' 
  AND title = 'Stage Hour'
  AND EXISTS (
    SELECT 1 FROM stage_hours sh
    WHERE sh.project_id = calendar_events.project_id
      AND sh.stage_id = calendar_events.location_id
      AND DATE(sh.start_datetime) = calendar_events.event_date
      AND TIME(sh.start_datetime) = calendar_events.start_time
  );

-- Optional: Show remaining stage hour events (if any) for verification
-- SELECT * FROM calendar_events 
-- WHERE category = 'recording' AND title = 'Stage Hour';
