-- Add held_for column to user_gear so users can mark items they're carrying
-- on behalf of someone else (common when traveling with shared kit).
-- NULL = the gear belongs to the list owner. Non-null = the named person it's held for.

ALTER TABLE public.user_gear
ADD COLUMN IF NOT EXISTS held_for TEXT;

COMMENT ON COLUMN public.user_gear.held_for IS
  'Name of the person this gear is being held for, if not the owner of the gear list. NULL means the user owns the gear themselves.';
