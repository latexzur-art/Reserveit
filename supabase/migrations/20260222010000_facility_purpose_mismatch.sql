-- =====================================================
-- Migration: Facility-Purpose Mismatch Detection System
-- =====================================================
-- Description:
--   Adds infrastructure for detecting and routing bookings
--   where a faculty member from a non-primary department
--   books a specialized facility (computer lab, AV studio).
--   Unrecognized cross-department uses are routed to the
--   Academic Head for manual review.
-- Date: 2026-02-22
-- =====================================================

-- =====================================================
-- SECTION 1: Extend booking_status enum
-- =====================================================

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_faculty_response';

-- =====================================================
-- SECTION 2: New table — facility_purpose_tags
-- =====================================================
-- Tags specialized facilities by their primary use type.
-- Facilities without tags are treated as general-purpose
-- and bypass mismatch logic entirely.

CREATE TABLE IF NOT EXISTS public.facility_purpose_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  -- Allowed values: 'computer_use' | 'science_lab' | 'av_studio' | 'gym' | 'lecture' | 'multipurpose'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, tag)
);

-- =====================================================
-- SECTION 3: New table — department_facility_exceptions
-- =====================================================
-- Whitelist of department + facility_type combos that are
-- allowed to book a specialized facility without triggering
-- Academic Head review. Managed by Academic Head / Building Admin.

CREATE TABLE IF NOT EXISTS public.department_facility_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  facility_type VARCHAR(50) NOT NULL,
  -- Matches facility_purpose_tags.tag (e.g. 'computer_use')
  allowed_purpose_categories TEXT[] NOT NULL DEFAULT '{}',
  -- e.g. ARRAY['internet_research','graphic_design','presentation']
  auto_approve_eligible BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, facility_type)
);

-- =====================================================
-- SECTION 4: Extend bookings table
-- =====================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS facility_purpose_category VARCHAR(100),
  -- e.g. 'internet_research', 'graphic_design', 'presentation', 'other'
  ADD COLUMN IF NOT EXISTS mismatch_justification TEXT,
  -- Faculty's explanation when booking a non-whitelisted facility type
  ADD COLUMN IF NOT EXISTS mismatch_flag VARCHAR(50),
  -- NULL | 'CROSS_DEPT_EXCEPTION_MATCHED' | 'UNRECOGNIZED_CROSS_DEPT_USE'
  ADD COLUMN IF NOT EXISTS assigned_reviewer_role VARCHAR(50),
  -- 'academic_head' when mismatch forces manual review
  ADD COLUMN IF NOT EXISTS mismatch_reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Set when Academic Head takes action
  ADD COLUMN IF NOT EXISTS mismatch_alternative_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;
  -- Set when Academic Head suggests a different facility

-- =====================================================
-- SECTION 5: Extend facilities table
-- =====================================================

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS primary_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
-- If user's department matches primary_department_id, no mismatch check runs.
-- e.g. BMMA is primary for Room 401 (Photography Studio) & Room 402 (Broadcasting Studio)

-- =====================================================
-- SECTION 6: RLS Policies
-- =====================================================

ALTER TABLE public.facility_purpose_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_facility_exceptions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed by booking form + pipeline)
CREATE POLICY "read_facility_purpose_tags"
  ON public.facility_purpose_tags
  FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "read_dept_exceptions"
  ON public.department_facility_exceptions
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only Academic Head and Building Admin can manage exceptions
CREATE POLICY "manage_dept_exceptions"
  ON public.department_facility_exceptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('academic_head', 'building_admin')
        AND ur.is_active = TRUE
    )
  );
