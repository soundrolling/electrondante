-- Migration: Add measurement_unit column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS measurement_unit TEXT DEFAULT 'metric' CHECK (measurement_unit IN ('metric', 'imperial'));

COMMENT ON COLUMN user_profiles.measurement_unit IS 'User preference for measurement system. Values: metric (kg, cm, °C, km/h) or imperial (lb, in, °F, mph). Default: metric.';
