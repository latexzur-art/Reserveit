-- =====================================================
-- Create equipment_assignment_requests table
-- =====================================================
-- Description: BA cannot assign tech equipment directly; it submits an
--   assignment request that IT Admin (user_manager) approves and processes.
--   On completion the IT path calls assign_equipment_facility().
-- Date: 2026-08-06
-- =====================================================

CREATE TABLE IF NOT EXISTS public.equipment_assignment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  from_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  to_facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  requested_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','in_progress','completed','rejected')),
  handled_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status_note TEXT,                          -- progress updates visible to BA
  decided_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS equipment_assignment_requests_status_idx ON public.equipment_assignment_requests(status);
CREATE INDEX IF NOT EXISTS equipment_assignment_requests_equipment_id_idx ON public.equipment_assignment_requests(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_assignment_requests_requested_by_idx ON public.equipment_assignment_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS equipment_assignment_requests_created_at_idx ON public.equipment_assignment_requests(created_at DESC);

ALTER TABLE public.equipment_assignment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view equipment assignment requests"
  ON public.equipment_assignment_requests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create equipment assignment requests"
  ON public.equipment_assignment_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage equipment assignment requests"
  ON public.equipment_assignment_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_equipment_assignment_requests_updated_at
  BEFORE UPDATE ON public.equipment_assignment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.equipment_assignment_requests IS 'BA->IT Admin tech equipment assignment request workflow';
