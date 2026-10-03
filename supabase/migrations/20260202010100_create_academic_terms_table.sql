-- =====================================================
-- Phase 1.2: Create Academic Terms Table
-- =====================================================
-- Description: Semester definitions and key academic dates
-- Date: 2026-02-02
-- =====================================================

-- Create term_type enum
DO $$ BEGIN
  CREATE TYPE term_type AS ENUM ('first_semester', 'second_semester', 'summer', 'midyear');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create academic_terms table
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_code VARCHAR(20) UNIQUE NOT NULL,           -- e.g., '2025-2026-1ST'
  term_name VARCHAR(100) NOT NULL,                 -- e.g., 'First Semester AY 2025-2026'
  academic_year VARCHAR(20) NOT NULL,              -- e.g., '2025-2026'
  term_type term_type NOT NULL,

  -- Core dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Special period dates (for approval rules)
  enrollment_start DATE,
  enrollment_end DATE,
  exam_start DATE,
  exam_end DATE,

  -- Status
  is_active BOOLEAN DEFAULT FALSE,                 -- Only one active term at a time
  is_schedule_locked BOOLEAN DEFAULT FALSE,        -- Prevent further schedule changes

  -- Audit
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_term_dates CHECK (end_date > start_date),
  CONSTRAINT valid_enrollment_dates CHECK (
    enrollment_end IS NULL OR enrollment_start IS NULL OR enrollment_end >= enrollment_start
  ),
  CONSTRAINT valid_exam_dates CHECK (
    exam_end IS NULL OR exam_start IS NULL OR exam_end >= exam_start
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS academic_terms_active_idx ON public.academic_terms(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS academic_terms_dates_idx ON public.academic_terms(start_date, end_date);
CREATE INDEX IF NOT EXISTS academic_terms_academic_year_idx ON public.academic_terms(academic_year);

-- Ensure only one active term at a time
CREATE UNIQUE INDEX IF NOT EXISTS academic_terms_one_active_idx ON public.academic_terms(is_active) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read academic terms
CREATE POLICY "Anyone can view academic terms"
  ON public.academic_terms FOR SELECT
  USING (true);

-- Service role has full access
CREATE POLICY "Service role can manage academic terms"
  ON public.academic_terms FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_academic_terms_updated_at
  BEFORE UPDATE ON public.academic_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get current active term
CREATE OR REPLACE FUNCTION public.get_active_term()
RETURNS UUID AS $$
DECLARE
  v_term_id UUID;
BEGIN
  SELECT id INTO v_term_id
  FROM public.academic_terms
  WHERE is_active = TRUE
  LIMIT 1;

  RETURN v_term_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set active term (deactivates others)
CREATE OR REPLACE FUNCTION public.set_active_term(p_term_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Deactivate all terms first
  UPDATE public.academic_terms SET is_active = FALSE WHERE is_active = TRUE;

  -- Activate the specified term
  UPDATE public.academic_terms SET is_active = TRUE WHERE id = p_term_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.academic_terms IS 'Semester definitions with key academic dates for schedule scoping';
COMMENT ON COLUMN public.academic_terms.term_code IS 'Unique code like 2025-2026-1ST';
COMMENT ON COLUMN public.academic_terms.is_active IS 'Only one term can be active at a time';
COMMENT ON COLUMN public.academic_terms.is_schedule_locked IS 'When true, prevents schedule modifications';
COMMENT ON FUNCTION public.get_active_term IS 'Returns the ID of the currently active academic term';
COMMENT ON FUNCTION public.set_active_term IS 'Sets a term as active and deactivates all others';
