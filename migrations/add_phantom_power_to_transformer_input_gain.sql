-- Migration: Add phantom_power flag to transformer_input_gain
-- Tracks whether +48V phantom power is enabled per transformer input,
-- alongside the existing per-input gain staging value.

ALTER TABLE transformer_input_gain
  ADD COLUMN IF NOT EXISTS phantom_power BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN transformer_input_gain.phantom_power IS
  'Whether +48V phantom power is enabled for this transformer input.';
