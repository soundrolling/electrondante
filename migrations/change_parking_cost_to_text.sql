-- Migration: Change cost field in travel_parking table from numeric to text
-- This allows users to enter currency symbols and other text (e.g., "$10", "£15.50", "10 EUR")
--
-- Run this migration to update the cost column type

-- Step 1: Check current column type and convert existing numeric values to text
-- Convert any existing numeric values to text format (preserving the value)
DO $$
DECLARE
  current_type TEXT;
BEGIN
  -- Get the current data type of the cost column
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'travel_parking'
    AND column_name = 'cost';
  
  -- If column exists and is numeric, convert it
  IF current_type IS NOT NULL AND (current_type = 'numeric' OR current_type = 'double precision' OR current_type = 'real' OR current_type = 'integer' OR current_type = 'bigint' OR current_type = 'smallint' OR current_type = 'decimal') THEN
    -- Convert numeric values to text, preserving the value
    -- This handles NULL values and converts numbers to their string representation
    ALTER TABLE travel_parking 
    ALTER COLUMN cost TYPE TEXT USING 
      CASE 
        WHEN cost IS NULL THEN NULL
        ELSE cost::TEXT
      END;
    
    RAISE NOTICE '✅ Converted cost column from % to TEXT', current_type;
  ELSIF current_type = 'text' OR current_type = 'varchar' OR current_type = 'character varying' THEN
    RAISE NOTICE 'ℹ️  Cost column is already TEXT type, no conversion needed';
  ELSE
    RAISE WARNING '⚠️  Cost column type is % - conversion may be needed', current_type;
    -- Attempt conversion anyway
    ALTER TABLE travel_parking 
    ALTER COLUMN cost TYPE TEXT USING cost::TEXT;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  Error converting cost column: %', SQLERRM;
    -- Try direct conversion as fallback
    BEGIN
      ALTER TABLE travel_parking ALTER COLUMN cost TYPE TEXT;
      RAISE NOTICE '✅ Converted cost column to TEXT (fallback method)';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to convert cost column: %', SQLERRM;
    END;
END $$;

-- Step 2: Update column comment to reflect the change
COMMENT ON COLUMN travel_parking.cost IS 'Parking cost as text (allows currency symbols, e.g., "$10", "£15.50", "10 EUR")';

-- Step 3: Verify the change
DO $$
DECLARE
  final_type TEXT;
BEGIN
  SELECT data_type INTO final_type
  FROM information_schema.columns
  WHERE table_name = 'travel_parking'
    AND column_name = 'cost';
  
  IF final_type = 'text' OR final_type = 'character varying' THEN
    RAISE NOTICE '✅ Verification: cost column is now TEXT type';
  ELSE
    RAISE WARNING '⚠️  Verification: cost column type is % (expected TEXT)', final_type;
  END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================
-- This migration:
-- 1. Converts the cost column from numeric to TEXT
-- 2. Preserves existing numeric values by converting them to text
-- 3. Updates the column comment
-- 4. Verifies the conversion was successful
--
-- After running this, users can enter cost values like:
--   - "$10"
--   - "£15.50"
--   - "10 EUR"
--   - "25.00 USD"
--   - Any other text format
-- ============================================================================

