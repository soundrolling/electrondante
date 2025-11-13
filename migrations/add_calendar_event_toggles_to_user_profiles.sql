-- Migration: Add calendar_event_toggles column to user_profiles table
-- This column stores user preferences for which calendar event categories are visible
-- Format: JSONB object with category IDs as keys and boolean values (e.g., {"calltimes": true, "recording": false})

-- Add calendar_event_toggles column if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS calendar_event_toggles JSONB DEFAULT '{}'::jsonb;

-- Add comment to clarify the purpose of the column
COMMENT ON COLUMN user_profiles.calendar_event_toggles IS 'User preferences for calendar event category visibility. JSONB object with category IDs as keys and boolean values indicating whether each category should be displayed.';

-- ============================================================================
-- Summary
-- ============================================================================
-- This migration adds support for saving calendar event legend visibility
-- preferences to user profiles. Users can toggle which event categories are
-- visible in the calendar, and these preferences are persisted per user.
-- ============================================================================

