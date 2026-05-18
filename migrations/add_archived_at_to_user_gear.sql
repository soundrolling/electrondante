-- Soft-delete column for user_gear. When archived_at is set, the item is
-- hidden from the active gear library, but stays in the table so historical
-- references from gear_table / mic mapper remain intact for past projects.

ALTER TABLE public.user_gear
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_gear.archived_at IS
  'When set, the item has been removed from the active gear library (kit no longer owned) but is preserved so historical references in gear_table / mic mapper stay intact.';

CREATE INDEX IF NOT EXISTS user_gear_archived_at_idx
  ON public.user_gear (user_id, archived_at);
