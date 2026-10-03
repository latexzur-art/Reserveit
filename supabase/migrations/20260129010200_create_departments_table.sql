-- =====================================================
-- Phase 1.2: Create Departments Table
-- =====================================================
-- Description: Academic departments/programs at STI
-- Date: 2026-01-29
-- =====================================================

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  head_user_id UUID, -- Will reference users table (added later via FK)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS departments_code_idx ON public.departments(code);
CREATE INDEX IF NOT EXISTS departments_name_idx ON public.departments(name);
CREATE INDEX IF NOT EXISTS departments_is_active_idx ON public.departments(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active departments
CREATE POLICY "Anyone can view active departments"
  ON public.departments FOR SELECT
  USING (is_active = true);

-- Only service role can modify departments
CREATE POLICY "Service role can manage departments"
  ON public.departments FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample departments (adjust based on actual STI programs)
INSERT INTO public.departments (code, name, description) VALUES
  ('BSIT', 'Bachelor of Science in Information Technology', 'IT program focusing on software development and network administration'),
  ('BSCS', 'Bachelor of Science in Computer Science', 'CS program focusing on algorithms, AI, and theoretical computing'),
  ('BSHM', 'Bachelor of Science in Hospitality Management', 'Hospitality and tourism management program'),
  ('BSTM', 'Bachelor of Science in Tourism Management', 'Tourism industry and travel management program'),
  ('BSBA', 'Bachelor of Science in Business Administration', 'Business administration and management program'),
  ('ACT', 'Associate in Computer Technology', 'Two-year computer technology program'),
  ('SHS', 'Senior High School', 'Senior High School Department'),
  ('GEN', 'General Administration', 'Administrative and support departments')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.departments IS 'Academic departments and programs at STI';
COMMENT ON COLUMN public.departments.code IS 'Unique department code (e.g., BSIT, BSCS)';
COMMENT ON COLUMN public.departments.head_user_id IS 'Reference to the department head (foreign key added after users table creation)';
