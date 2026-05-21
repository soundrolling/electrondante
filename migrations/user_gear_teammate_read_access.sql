-- Allow reading another user's personal gear and its owner allocations when
-- both users share at least one project_members row. Used by the "Mine /
-- Team Gear" picker so a project member can pull gear from teammates without
-- being able to modify it.
--
-- Without this, the existing "auth.uid() = user_id" SELECT policies on
-- user_gear / user_gear_owners silently strip out everyone else's rows even
-- when the client queries by their user_id, so admins on a shared project
-- only ever see their own gear.

DROP POLICY IF EXISTS "Teammates can read shared-project gear" ON public.user_gear;
CREATE POLICY "Teammates can read shared-project gear"
  ON public.user_gear
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_members pm_self
      JOIN public.project_members pm_other
        ON pm_self.project_id = pm_other.project_id
      WHERE pm_self.user_id = auth.uid()
        AND pm_other.user_id = user_gear.user_id
    )
  );

DROP POLICY IF EXISTS "Teammates can read shared-project gear owners" ON public.user_gear_owners;
CREATE POLICY "Teammates can read shared-project gear owners"
  ON public.user_gear_owners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_gear ug
      JOIN public.project_members pm_self
        ON pm_self.user_id = auth.uid()
      JOIN public.project_members pm_other
        ON pm_other.project_id = pm_self.project_id
       AND pm_other.user_id   = ug.user_id
      WHERE ug.id = user_gear_owners.gear_id
    )
  );
