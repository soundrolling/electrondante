-- Migration: Per-gear owner allocations
-- A single piece of gear (e.g. "KSM mics x 10") can now be split between
-- multiple owners with per-owner quantities. The gear row keeps the total
-- quantity; user_gear_owners rows allocate slices of that total to either:
--   - the gear-list owner themselves (is_self = TRUE), or
--   - a saved personal contact (owner_contact_id), or
--   - a free-text name that hasn't been added as a contact (owner_name).
-- Sum of allocations may be less than user_gear.quantity — the remainder is
-- treated as "unassigned" and surfaced as a flag in the UI. Sum may not
-- exceed the gear quantity (enforced in the service / UI; we don't add a
-- check constraint here because gear.quantity can be edited freely).
--
-- The legacy user_gear.held_for column is left in place for now and is
-- backfilled into this table so existing data keeps working.

CREATE TABLE IF NOT EXISTS public.user_gear_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_id UUID NOT NULL REFERENCES public.user_gear(id) ON DELETE CASCADE,
  is_self BOOLEAN NOT NULL DEFAULT FALSE,
  owner_contact_id UUID REFERENCES public.user_personal_contacts(id) ON DELETE SET NULL,
  owner_name TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_gear_owners_gear_id
  ON public.user_gear_owners(gear_id);
CREATE INDEX IF NOT EXISTS idx_user_gear_owners_contact_id
  ON public.user_gear_owners(owner_contact_id)
  WHERE owner_contact_id IS NOT NULL;

ALTER TABLE public.user_gear_owners ENABLE ROW LEVEL SECURITY;

-- Access is gated through the parent user_gear row: you can read/write
-- allocations only for gear you own.
DROP POLICY IF EXISTS "Users manage owners on own gear" ON public.user_gear_owners;
CREATE POLICY "Users manage owners on own gear"
  ON public.user_gear_owners
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_gear ug
      WHERE ug.id = user_gear_owners.gear_id
        AND ug.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_gear ug
      WHERE ug.id = user_gear_owners.gear_id
        AND ug.user_id = auth.uid()
    )
  );

-- Backfill existing gear into the new allocation table. Active (non-archived)
-- rows get one allocation each:
--   - held_for IS NULL → is_self = TRUE
--   - held_for IS NOT NULL → owner_name = held_for
-- We skip gear that already has any allocation rows so this migration is
-- safely re-runnable.
INSERT INTO public.user_gear_owners (gear_id, is_self, owner_name, quantity)
SELECT
  ug.id,
  ug.held_for IS NULL OR length(trim(ug.held_for)) = 0,
  CASE
    WHEN ug.held_for IS NOT NULL AND length(trim(ug.held_for)) > 0
    THEN trim(ug.held_for)
    ELSE NULL
  END,
  GREATEST(COALESCE(ug.quantity, 1), 1)
FROM public.user_gear ug
LEFT JOIN public.user_gear_owners ugo ON ugo.gear_id = ug.id
WHERE ugo.id IS NULL
  AND ug.archived_at IS NULL;

COMMENT ON TABLE public.user_gear_owners IS
  'Per-gear owner allocations. Sum of allocation.quantity for a gear should be <= user_gear.quantity. is_self=TRUE marks the list owner; otherwise either owner_contact_id (saved contact) or owner_name (free-text) identifies who owns that slice.';
