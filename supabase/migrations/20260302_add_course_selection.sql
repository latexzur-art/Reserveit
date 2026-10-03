-- =====================================================
-- Migration: Add Course Selection for Faculty Bookings
-- =====================================================
-- Description:
--   Adds ability for faculty to select a specific course/program
--   when making a booking. This enables:
--   - Course-facility affinity scoring (e.g., BSIT course + computer lab = +15 points)
--   - Smart mismatch detection that recognizes cross-dept teaching
--   - More accurate approval workflow based on course needs
-- Date: 2026-03-02
-- =====================================================

-- =====================================================
-- SECTION 1: Add booking_course_code column to bookings table
-- =====================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_course_code VARCHAR(10)
  REFERENCES public.departments(code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_course_code
  ON public.bookings(booking_course_code);

COMMENT ON COLUMN public.bookings.booking_course_code
  IS 'Course/program code for which this booking is made (e.g., BSIT, BSHM). May differ from user primary department. Optional.';

-- =====================================================
-- SECTION 2: Create course_facility_affinity table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.course_facility_affinity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code VARCHAR(10) NOT NULL REFERENCES public.departments(code) ON DELETE CASCADE,
  facility_tag VARCHAR(50) NOT NULL,
  -- Must match values in facility_purpose_tags.tag
  -- Allowed: 'computer_use', 'science_lab', 'av_studio', 'gym', 'hospitality_lab', 'multipurpose', 'conference'
  affinity_points INTEGER NOT NULL DEFAULT 15,
  -- Bonus points awarded when course books a facility with this tag
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_code, facility_tag)
);

CREATE INDEX idx_course_affinity_code ON public.course_facility_affinity(course_code);
CREATE INDEX idx_course_affinity_tag ON public.course_facility_affinity(facility_tag);

COMMENT ON TABLE public.course_facility_affinity
  IS 'Maps courses to specialized facility types with scoring bonuses for appropriate matches';

-- =====================================================
-- SECTION 3: Insert missing departments
-- =====================================================

INSERT INTO public.departments (id, code, name, description, is_active)
VALUES
  (gen_random_uuid(), 'BSIS', 'Bachelor of Science in Information Systems',
   'Information systems and business technology program', TRUE),
  (gen_random_uuid(), 'BSA', 'Bachelor of Science in Accountancy',
   'Professional accountancy program', TRUE),
  (gen_random_uuid(), 'BSAIS', 'Bachelor of Science in Accounting Information Systems',
   'Accounting with technology integration program', TRUE),
  (gen_random_uuid(), 'BSCM', 'Bachelor of Science in Culinary Management',
   'Culinary arts and restaurant management program', TRUE),
  (gen_random_uuid(), 'BACOMM', 'Bachelor of Arts in Communication',
   'Media, journalism, and communication program', TRUE)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SECTION 4: Seed course-facility affinity mappings
-- =====================================================

-- ICT Programs + BMMA → Computer Labs
INSERT INTO public.course_facility_affinity (course_code, facility_tag, affinity_points, notes)
VALUES
  ('BSIT', 'computer_use', 15,
   'BSIT classes heavily utilize computer labs for programming, networking, and systems courses'),
  ('BSCS', 'computer_use', 15,
   'BSCS requires computer labs for algorithms, data structures, and software engineering'),
  ('BSIS', 'computer_use', 15,
   'BSIS needs computer labs for database, systems analysis, and business applications'),
  ('BSCpE', 'computer_use', 15,
   'BSCpE uses computer labs for embedded systems, hardware-software integration'),
  ('BMMA', 'computer_use', 15,
   'BMMA heavily uses computer labs for digital design, video editing, and multimedia software')
ON CONFLICT (course_code, facility_tag) DO NOTHING;

-- Hospitality & Tourism → Hospitality Labs
INSERT INTO public.course_facility_affinity (course_code, facility_tag, affinity_points, notes)
VALUES
  ('BSHM', 'hospitality_lab', 15,
   'BSHM requires hospitality labs for hotel operations, bar/dining service training'),
  ('BSTM', 'hospitality_lab', 15,
   'BSTM uses hospitality labs for travel counter operations and guest service training'),
  ('BSCM', 'hospitality_lab', 15,
   'BSCM needs hospitality labs for culinary techniques and kitchen management')
ON CONFLICT (course_code, facility_tag) DO NOTHING;

-- Arts & Sciences → AV Studios
INSERT INTO public.course_facility_affinity (course_code, facility_tag, affinity_points, notes)
VALUES
  ('BMMA', 'av_studio', 15,
   'BMMA primary program for photography, videography, and broadcasting studios'),
  ('BACOMM', 'av_studio', 15,
   'BACOMM uses AV studios for media production, journalism, and broadcasting courses')
ON CONFLICT (course_code, facility_tag) DO NOTHING;

-- =====================================================
-- SECTION 5: RLS Policies
-- =====================================================

ALTER TABLE public.course_facility_affinity ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed by booking pipeline scoring)
CREATE POLICY "read_course_affinity"
  ON public.course_facility_affinity
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only admins can modify
CREATE POLICY "manage_course_affinity"
  ON public.course_facility_affinity
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
