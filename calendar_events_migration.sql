-- Calendar Events Multi-Day Support Migration
-- Run this SQL in your Supabase SQL editor to add multi-day event support

-- Add end_date column to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update existing events to have end_date = event_date (single day events)
UPDATE calendar_events 
SET end_date = event_date 
WHERE end_date IS NULL;

-- Create index for better performance on date range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range 
ON calendar_events (event_date, end_date);

-- Add comment to document the new column
COMMENT ON COLUMN calendar_events.end_date IS 'End date for multi-day events. Defaults to event_date for single-day events.';
