-- Migration: Fix RLS policies for mic_color_buttons table
-- This fixes the policies that were trying to access auth.users table
-- Run this if you already created the table with the old policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view color buttons for accessible projects" ON mic_color_buttons;
DROP POLICY IF EXISTS "Users can create color buttons for editable projects" ON mic_color_buttons;
DROP POLICY IF EXISTS "Users can update color buttons for editable projects" ON mic_color_buttons;
DROP POLICY IF EXISTS "Users can delete color buttons for editable projects" ON mic_color_buttons;

-- Recreate policies without auth.users access
CREATE POLICY "Users can view color buttons for accessible projects"
  ON mic_color_buttons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create color buttons for editable projects"
  ON mic_color_buttons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'editor', 'member')
        )
      )
    )
  );

CREATE POLICY "Users can update color buttons for editable projects"
  ON mic_color_buttons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'editor', 'member')
        )
      )
    )
  );

CREATE POLICY "Users can delete color buttons for editable projects"
  ON mic_color_buttons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mic_color_buttons.project_id
      AND (
        p.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id
          AND pm.user_id = auth.uid()
          AND pm.role IN ('owner', 'admin', 'editor', 'member')
        )
      )
    )
  );

