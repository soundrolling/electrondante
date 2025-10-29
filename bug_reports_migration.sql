-- Bug Reports Migration Script
-- Run this SQL in your Supabase SQL editor to add missing columns to the bug_reports table

-- Add missing columns to bug_reports table
ALTER TABLE bug_reports 
ADD COLUMN IF NOT EXISTS steps TEXT,
ADD COLUMN IF NOT EXISTS expected_behavior TEXT,
ADD COLUMN IF NOT EXISTS actual_behavior TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS platform VARCHAR(100),
ADD COLUMN IF NOT EXISTS language VARCHAR(10),
ADD COLUMN IF NOT EXISTS cookie_enabled BOOLEAN,
ADD COLUMN IF NOT EXISTS online_status BOOLEAN,
ADD COLUMN IF NOT EXISTS screen_resolution VARCHAR(20),
ADD COLUMN IF NOT EXISTS viewport_size VARCHAR(20),
ADD COLUMN IF NOT EXISTS color_depth INTEGER,
ADD COLUMN IF NOT EXISTS pixel_ratio DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS page_title TEXT,
ADD COLUMN IF NOT EXISTS console_errors JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_type ON bug_reports(type);
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at);

-- Enable Row Level Security (if not already enabled)
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to handle updates)
DROP POLICY IF EXISTS "Users can insert their own bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Users can view all bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Users can update all bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Users can delete all bug reports" ON bug_reports;

-- Create policies for bug_reports table
-- Allow authenticated users to insert their own reports
CREATE POLICY "Users can insert their own bug reports" ON bug_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to view all reports
CREATE POLICY "Users can view all bug reports" ON bug_reports
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to update all reports (for status management)
CREATE POLICY "Users can update all bug reports" ON bug_reports
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete all reports
CREATE POLICY "Users can delete all bug reports" ON bug_reports
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create bug_report_comments table if it doesn't exist
CREATE TABLE IF NOT EXISTS bug_report_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on comments table
ALTER TABLE bug_report_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing comment policies if they exist
DROP POLICY IF EXISTS "Users can insert comments" ON bug_report_comments;
DROP POLICY IF EXISTS "Users can view all comments" ON bug_report_comments;
DROP POLICY IF EXISTS "Users can update comments" ON bug_report_comments;
DROP POLICY IF EXISTS "Users can delete comments" ON bug_report_comments;

-- Create policies for bug_report_comments table
CREATE POLICY "Users can insert comments" ON bug_report_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view all comments" ON bug_report_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update comments" ON bug_report_comments
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete comments" ON bug_report_comments
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create index for comments
CREATE INDEX IF NOT EXISTS idx_bug_report_comments_report_id ON bug_report_comments(report_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_bug_reports_updated_at ON bug_reports;

-- Create trigger to automatically update updated_at on bug_reports
CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
