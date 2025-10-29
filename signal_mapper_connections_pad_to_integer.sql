-- Convert connections.pad from BOOLEAN to INTEGER with default 0 (supports negative dB values)

ALTER TABLE connections
ALTER COLUMN pad DROP DEFAULT;

-- If column is boolean, convert existing TRUE/FALSE to 1/0 first
ALTER TABLE connections
ALTER COLUMN pad TYPE INTEGER USING CASE
  WHEN pad IS TRUE THEN 1
  WHEN pad IS FALSE THEN 0
  ELSE COALESCE(pad::INTEGER, 0)
END;

ALTER TABLE connections
ALTER COLUMN pad SET DEFAULT 0;

COMMENT ON COLUMN connections.pad IS 'Pad amount in dB (0 for none, negative numbers for attenuation)';


