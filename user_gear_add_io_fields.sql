-- Adds richer IO/recorder/rented fields to user_gear table
-- Safe to run multiple times (checks for column existence)

DO $$
BEGIN
  -- num_inputs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_gear' AND column_name = 'num_inputs'
  ) THEN
    ALTER TABLE user_gear ADD COLUMN num_inputs INTEGER;
  END IF;

  -- num_outputs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_gear' AND column_name = 'num_outputs'
  ) THEN
    ALTER TABLE user_gear ADD COLUMN num_outputs INTEGER;
  END IF;

  -- num_records (tracks for recorders)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_gear' AND column_name = 'num_records'
  ) THEN
    ALTER TABLE user_gear ADD COLUMN num_records INTEGER;
  END IF;

  -- is_rented
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_gear' AND column_name = 'is_rented'
  ) THEN
    ALTER TABLE user_gear ADD COLUMN is_rented BOOLEAN DEFAULT FALSE;
  END IF;
END $$;


