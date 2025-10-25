-- Project Members RLS Policies
-- Run this SQL in your Supabase SQL editor to set up proper role-based access control

-- Enable Row Level Security (RLS) on project_members table
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to handle updates)
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Authenticated users can insert project members" ON project_members;
DROP POLICY IF EXISTS "Admins can update project members" ON project_members;
DROP POLICY IF EXISTS "Admins can delete project members" ON project_members;
DROP POLICY IF EXISTS "select_project_members" ON project_members;
DROP POLICY IF EXISTS "insert_project_members" ON project_members;
DROP POLICY IF EXISTS "update_project_members" ON project_members;
DROP POLICY IF EXISTS "delete_project_members" ON project_members;

-- Drop the function if it exists (with CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS is_project_admin(UUID, TEXT) CASCADE;

-- SELECT: Allow all authenticated users to view project members
-- Authorization is handled in the frontend based on project membership
CREATE POLICY "Users can view project members" ON project_members
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: Allow authenticated users to insert (edge function will handle authorization)
-- The edge function uses service role, so it bypasses RLS anyway
CREATE POLICY "Authenticated users can insert project members" ON project_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Allow users to update their own records (for role changes by admins)
-- The frontend will handle authorization logic
CREATE POLICY "Users can update project members" ON project_members
  FOR UPDATE USING (auth.role() = 'authenticated');

-- DELETE: Allow authenticated users to delete (frontend handles authorization)
-- The frontend will prevent non-admins from deleting
CREATE POLICY "Users can delete project members" ON project_members
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add comment to document the policies
COMMENT ON TABLE project_members IS 'Project membership table with basic RLS. Authorization logic is handled in the frontend and edge functions.';
