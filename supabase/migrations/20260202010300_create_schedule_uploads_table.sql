-- =====================================================
-- Phase 1.2: Create Schedule Uploads Table
-- =====================================================
-- Description: Batch schedule submissions from Program Heads
-- Date: 2026-02-02
-- =====================================================

-- Create upload_mode enum
DO $$ BEGIN
  CREATE TYPE upload_mode AS ENUM ('file_upload', 'manual_entry', 'hybrid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create upload_status enum
DO $$ BEGIN
  CREATE TYPE upload_status AS ENUM (
    'draft',              -- Still being edited
    'parsing',            -- File being processed (async)
    'validation_failed',  -- Has unresolved errors
    'pending_submission', -- Ready to submit, user hasn't clicked submit
    'submitted',          -- Awaiting Academic Head review
    'revision_requested', -- Returned with feedback
    'approved',           -- Finalized
    'rejected'            -- Declined entirely
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create file_type enum
DO $$ BEGIN
  CREATE TYPE file_type AS ENUM ('csv', 'xlsx', 'xls');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create schedule_uploads table
CREATE TABLE IF NOT EXISTS public.schedule_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  academic_term_id UUID NOT NULL REFERENCES public.academic_terms(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,

  -- Upload metadata
  upload_mode upload_mode NOT NULL DEFAULT 'manual_entry',
  upload_status upload_status NOT NULL DEFAULT 'draft',

  -- File upload fields (nullable for manual entry)
  source_file_name VARCHAR(255),
  source_file_type file_type,
  source_file_path VARCHAR(500),                   -- Supabase storage path
  source_file_hash VARCHAR(64),                    -- SHA-256 for duplicate detection

  -- Parsing results (for file uploads)
  parse_started_at TIMESTAMP WITH TIME ZONE,
  parse_completed_at TIMESTAMP WITH TIME ZONE,
  parse_error_message TEXT,

  -- Entry counts
  total_entries INT DEFAULT 0,
  valid_entries_count INT DEFAULT 0,
  warning_entries_count INT DEFAULT 0,
  error_entries_count INT DEFAULT 0,
  conflict_count INT DEFAULT 0,

  -- Submission tracking
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMP WITH TIME ZONE,

  -- Review tracking
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT file_required_for_upload CHECK (
    upload_mode = 'manual_entry' OR source_file_name IS NOT NULL
  ),
  CONSTRAINT cannot_submit_with_errors CHECK (
    upload_status != 'submitted' OR error_entries_count = 0
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS schedule_uploads_term_idx ON public.schedule_uploads(academic_term_id);
CREATE INDEX IF NOT EXISTS schedule_uploads_dept_idx ON public.schedule_uploads(department_id);
CREATE INDEX IF NOT EXISTS schedule_uploads_status_idx ON public.schedule_uploads(upload_status);
CREATE INDEX IF NOT EXISTS schedule_uploads_uploader_idx ON public.schedule_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS schedule_uploads_created_at_idx ON public.schedule_uploads(created_at DESC);

-- Prevent duplicate active uploads per department per term
CREATE UNIQUE INDEX IF NOT EXISTS schedule_uploads_one_active_per_dept_term_idx
  ON public.schedule_uploads(academic_term_id, department_id)
  WHERE upload_status NOT IN ('approved', 'rejected');

-- Enable Row Level Security
ALTER TABLE public.schedule_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view uploads they created
CREATE POLICY "Users can view own uploads"
  ON public.schedule_uploads FOR SELECT
  USING (uploaded_by = auth.uid());

-- Users can create uploads for their department
CREATE POLICY "Users can create uploads"
  ON public.schedule_uploads FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

-- Users can update their own draft uploads
CREATE POLICY "Users can update own draft uploads"
  ON public.schedule_uploads FOR UPDATE
  USING (uploaded_by = auth.uid() AND upload_status IN ('draft', 'validation_failed', 'pending_submission', 'revision_requested'))
  WITH CHECK (uploaded_by = auth.uid());

-- Service role has full access
CREATE POLICY "Service role can manage schedule uploads"
  ON public.schedule_uploads FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_schedule_uploads_updated_at
  BEFORE UPDATE ON public.schedule_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create a new schedule upload
CREATE OR REPLACE FUNCTION public.create_schedule_upload(
  p_academic_term_id UUID,
  p_department_id UUID,
  p_uploaded_by UUID,
  p_upload_mode upload_mode DEFAULT 'manual_entry'
)
RETURNS UUID AS $$
DECLARE
  v_upload_id UUID;
  v_term_locked BOOLEAN;
BEGIN
  -- Check if term is locked
  SELECT is_schedule_locked INTO v_term_locked
  FROM public.academic_terms
  WHERE id = p_academic_term_id;

  IF v_term_locked = TRUE THEN
    RAISE EXCEPTION 'Schedule uploads are locked for this term';
  END IF;

  INSERT INTO public.schedule_uploads (
    academic_term_id, department_id, uploaded_by, upload_mode
  ) VALUES (
    p_academic_term_id, p_department_id, p_uploaded_by, p_upload_mode
  )
  RETURNING id INTO v_upload_id;

  RETURN v_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit upload for review
CREATE OR REPLACE FUNCTION public.submit_schedule_upload(p_upload_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_error_count INT;
BEGIN
  -- Check error count
  SELECT error_entries_count INTO v_error_count
  FROM public.schedule_uploads
  WHERE id = p_upload_id;

  IF v_error_count > 0 THEN
    RAISE EXCEPTION 'Cannot submit upload with % unresolved errors', v_error_count;
  END IF;

  UPDATE public.schedule_uploads
  SET upload_status = 'submitted',
      submitted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_upload_id
    AND upload_status IN ('draft', 'pending_submission', 'revision_requested');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to request revision
CREATE OR REPLACE FUNCTION public.request_schedule_revision(
  p_upload_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.schedule_uploads
  SET upload_status = 'revision_requested',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      review_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_upload_id
    AND upload_status = 'submitted';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.schedule_uploads IS 'Batch schedule submissions from Program Heads supporting file upload and manual entry';
COMMENT ON COLUMN public.schedule_uploads.source_file_hash IS 'SHA-256 hash for duplicate file detection';
COMMENT ON COLUMN public.schedule_uploads.upload_status IS 'Workflow status: draft → submitted → approved/rejected';
COMMENT ON FUNCTION public.create_schedule_upload IS 'Creates a new schedule upload batch for a department';
COMMENT ON FUNCTION public.submit_schedule_upload IS 'Submits an upload for Academic Head review';
