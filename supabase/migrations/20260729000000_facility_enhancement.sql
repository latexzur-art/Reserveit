-- =====================================================
-- Facility Enhancement: Warnings, Reviews, Photos, Issue Reports
-- =====================================================
-- Description: Adds facility_warnings (top-down admin notices),
--   facility_reviews (bottom-up crowdsourced feedback), facility_photos
--   (gallery, since facilities.image_url is singular), and
--   facility_issue_reports (unvetted user reports, decoupled from the
--   scheduled maintenance_records table). A review with issue_reported=true
--   fires trg_review_to_issue_report, which opens a facility_issue_reports
--   row — never a maintenance_records row directly; an admin explicitly
--   converts a report to maintenance via the admin API.
-- Date: 2026-07-29
-- =====================================================

-- 1. Active Room Warnings
CREATE TABLE IF NOT EXISTS public.facility_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_warnings_active ON public.facility_warnings(facility_id) WHERE is_active = true;

-- 2. Facility Reviews
CREATE TABLE IF NOT EXISTS public.facility_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  issue_reported BOOLEAN NOT NULL DEFAULT false,
  issue_category TEXT CHECK (issue_category IS NULL OR issue_category IN (
    'EQUIPMENT', 'AIRCON', 'LIGHTING', 'CLEANLINESS', 'NETWORK', 'FURNITURE', 'SAFETY', 'OTHER'
  )),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'under_review', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_reviews_facility ON public.facility_reviews(facility_id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_facility_reviews_booking ON public.facility_reviews(booking_id);
-- One review per user per booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_facility_reviews_one_per_booking ON public.facility_reviews(booking_id, user_id) WHERE booking_id IS NOT NULL;

-- 3. Facility Photo Gallery
CREATE TABLE IF NOT EXISTS public.facility_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_photos_facility ON public.facility_photos(facility_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_facility_photos_one_cover ON public.facility_photos(facility_id) WHERE is_cover = true;

-- 4. Issue Reports (decoupled from the maintenance schedule)
CREATE TABLE IF NOT EXISTS public.facility_issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  review_id UUID REFERENCES public.facility_reviews(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'EQUIPMENT', 'AIRCON', 'LIGHTING', 'CLEANLINESS', 'NETWORK', 'FURNITURE', 'SAFETY', 'OTHER'
  )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converted', 'dismissed')),
  maintenance_record_id UUID REFERENCES public.maintenance_records(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_issue_reports_open ON public.facility_issue_reports(facility_id) WHERE status = 'open';

-- 5. Trigger: review with a reported issue -> open issue report (NOT a maintenance record)
CREATE OR REPLACE FUNCTION public.create_issue_report_from_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.issue_reported = true AND NEW.issue_category IS NOT NULL THEN
    INSERT INTO public.facility_issue_reports (
      facility_id, review_id, reported_by, category, details, status
    ) VALUES (
      NEW.facility_id, NEW.id, NEW.user_id, NEW.issue_category,
      COALESCE(NEW.comment, 'No additional details provided.'), 'open'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_to_issue_report ON public.facility_reviews;
CREATE TRIGGER trg_review_to_issue_report
  AFTER INSERT ON public.facility_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.create_issue_report_from_review();

-- 6. updated_at maintenance (mirrors existing tables' touch pattern)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facility_warnings_touch ON public.facility_warnings;
CREATE TRIGGER trg_facility_warnings_touch BEFORE UPDATE ON public.facility_warnings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_facility_photos_touch ON public.facility_photos;
CREATE TRIGGER trg_facility_photos_touch BEFORE UPDATE ON public.facility_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_facility_issue_reports_touch ON public.facility_issue_reports;
CREATE TRIGGER trg_facility_issue_reports_touch BEFORE UPDATE ON public.facility_issue_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. RLS (mirrors existing tables: authenticated SELECT on visible rows, service_role manages all)
ALTER TABLE public.facility_warnings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_issue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view active warnings" ON public.facility_warnings;
CREATE POLICY "Authenticated can view active warnings" ON public.facility_warnings
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can view published reviews" ON public.facility_reviews;
CREATE POLICY "Authenticated can view published reviews" ON public.facility_reviews
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can view photos" ON public.facility_photos;
CREATE POLICY "Authenticated can view photos" ON public.facility_photos
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Users insert own reviews" ON public.facility_reviews;
CREATE POLICY "Users insert own reviews" ON public.facility_reviews
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manage warnings" ON public.facility_warnings;
CREATE POLICY "Service role manage warnings" ON public.facility_warnings
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manage reviews" ON public.facility_reviews;
CREATE POLICY "Service role manage reviews" ON public.facility_reviews
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manage photos" ON public.facility_photos;
CREATE POLICY "Service role manage photos" ON public.facility_photos
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Service role manage issues" ON public.facility_issue_reports;
CREATE POLICY "Service role manage issues" ON public.facility_issue_reports
  FOR ALL USING ((SELECT auth.role()) = 'service_role');
