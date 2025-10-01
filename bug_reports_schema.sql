-- Bug Reports Database Schema
-- Run this SQL in your Supabase SQL editor to create the necessary tables

-- Create bug_reports table
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'suggestion', 'improvement')),
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  browser VARCHAR(100),
  device VARCHAR(100),
  user_agent TEXT,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bug_report_comments table
CREATE TABLE IF NOT EXISTS bug_report_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_type ON bug_reports(type);
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_report_comments_report_id ON bug_report_comments(report_id);

-- Enable Row Level Security (RLS)
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_report_comments ENABLE ROW LEVEL SECURITY;

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

-- Create policies for bug_report_comments table
-- Allow authenticated users to insert comments
CREATE POLICY "Users can insert comments" ON bug_report_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to view all comments
CREATE POLICY "Users can view all comments" ON bug_report_comments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to update comments
CREATE POLICY "Users can update comments" ON bug_report_comments
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete comments
CREATE POLICY "Users can delete comments" ON bug_report_comments
  FOR DELETE USING (auth.role() = 'authenticated');

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on bug_reports
CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
