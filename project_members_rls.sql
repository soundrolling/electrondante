-- Project Members RLS Policies
-- Run this SQL in your Supabase SQL editor to set up proper role-based access control

-- Enable Row Level Security (RLS) on project_members table
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to handle updates)
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Admins can insert project members" ON project_members;
DROP POLICY IF EXISTS "Admins can update project members" ON project_members;
DROP POLICY IF EXISTS "Admins can delete project members" ON project_members;

-- SELECT: Users can view members of projects they belong to
CREATE POLICY "Users can view project members" ON project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_email = auth.jwt() ->> 'email'
    )
  );

-- INSERT: Only admins/owners can add new members (enforced via edge function)
-- This policy allows the edge function (using service role) to insert members
CREATE POLICY "Admins can insert project members" ON project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_email = auth.jwt() ->> 'email'
      AND pm.role IN ('admin', 'owner')
    )
  );

-- UPDATE: Only admins/owners can modify member roles
CREATE POLICY "Admins can update project members" ON project_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_email = auth.jwt() ->> 'email'
      AND pm.role IN ('admin', 'owner')
    )
  );

-- DELETE: Only admins/owners can remove members (except project owner)
CREATE POLICY "Admins can delete project members" ON project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_email = auth.jwt() ->> 'email'
      AND pm.role IN ('admin', 'owner')
    )
    AND role != 'owner'  -- Prevent deletion of project owner
  );

-- Add comment to document the policies
COMMENT ON TABLE project_members IS 'Project membership table with role-based access control. Users can only see members of projects they belong to. Only admins/owners can manage members.';
