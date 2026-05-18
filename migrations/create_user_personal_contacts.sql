-- Migration: Create user_personal_contacts table for personal address book
-- Each user maintains their own address book of people they collaborate with.
-- Primary use: pick "Holding for" owner in the personal gear library instead
-- of free-typing each time. Contacts can also be imported in bulk from any
-- project the user is a member of.

CREATE TABLE IF NOT EXISTS public.user_personal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  notes TEXT,
  source TEXT, -- 'manual' | 'project_member' | 'project_contact' (free-form for forward compat)
  source_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_personal_contacts_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_personal_contacts_user_id
  ON public.user_personal_contacts(user_id);

CREATE INDEX IF NOT EXISTS idx_user_personal_contacts_user_name_lower
  ON public.user_personal_contacts(user_id, LOWER(name));

-- One contact name per user (case-insensitive). Re-importing the same person
-- should update the existing record instead of creating duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_personal_contacts_user_name
  ON public.user_personal_contacts(user_id, LOWER(name));

ALTER TABLE public.user_personal_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own personal contacts" ON public.user_personal_contacts;
CREATE POLICY "Users select own personal contacts"
  ON public.user_personal_contacts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own personal contacts" ON public.user_personal_contacts;
CREATE POLICY "Users insert own personal contacts"
  ON public.user_personal_contacts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own personal contacts" ON public.user_personal_contacts;
CREATE POLICY "Users update own personal contacts"
  ON public.user_personal_contacts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own personal contacts" ON public.user_personal_contacts;
CREATE POLICY "Users delete own personal contacts"
  ON public.user_personal_contacts FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE public.user_personal_contacts IS
  'Per-user personal address book. Used to populate the "Holding for" picker in the personal gear library and any other personal contact-selection UI.';
