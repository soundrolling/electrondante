-- contact_ratings: "helpfulness" rating (1=Useless .. 5=Amazing) for project
-- contacts. Ratings follow the PERSON across projects, keyed by a normalized
-- match_key (email if present, else name) rather than a specific
-- project_contacts row.
--
-- Two scopes share this table:
--   scope='shared'   -> one row per person, user_id NULL. Visible/editable only
--                       by project owners/admins. Last write wins.
--   scope='personal' -> one row per (person, user). Each non-admin keeps their
--                       own private rating; nobody else can see it.
--
-- The app (contactRatingsService.js) tolerates this table being absent, so the
-- frontend keeps working if it ships before this migration is applied.

CREATE TABLE IF NOT EXISTS public.contact_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_key   TEXT NOT NULL,
  scope       TEXT NOT NULL CHECK (scope IN ('shared', 'personal')),
  user_id     UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- personal rows must have an owner; shared rows must not.
  CONSTRAINT contact_ratings_scope_user_chk CHECK (
    (scope = 'personal' AND user_id IS NOT NULL) OR
    (scope = 'shared'   AND user_id IS NULL)
  )
);

COMMENT ON TABLE public.contact_ratings IS
  'Helpfulness ratings (1=Useless..5=Amazing) for project contacts, keyed by person (match_key). scope=shared is the admin-visible team rating (one per person); scope=personal is a per-user private rating.';

-- One shared rating per person.
CREATE UNIQUE INDEX IF NOT EXISTS contact_ratings_shared_uniq
  ON public.contact_ratings (match_key)
  WHERE scope = 'shared';

-- One personal rating per person per user.
CREATE UNIQUE INDEX IF NOT EXISTS contact_ratings_personal_uniq
  ON public.contact_ratings (match_key, user_id)
  WHERE scope = 'personal';

ALTER TABLE public.contact_ratings ENABLE ROW LEVEL SECURITY;

-- Personal rows: only the owner can see/manage them.
DROP POLICY IF EXISTS contact_ratings_personal_rw ON public.contact_ratings;
CREATE POLICY contact_ratings_personal_rw ON public.contact_ratings
  FOR ALL
  USING (scope = 'personal' AND user_id = auth.uid())
  WITH CHECK (scope = 'personal' AND user_id = auth.uid());

-- Shared rows: only users who are an owner/admin on some project.
-- project_members.user_email is stored lowercased (see ProjectContacts.checkUserRole).
DROP POLICY IF EXISTS contact_ratings_shared_rw ON public.contact_ratings;
CREATE POLICY contact_ratings_shared_rw ON public.contact_ratings
  FOR ALL
  USING (
    scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_email = lower(auth.jwt() ->> 'email')
        AND pm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_email = lower(auth.jwt() ->> 'email')
        AND pm.role IN ('owner', 'admin')
    )
  );
