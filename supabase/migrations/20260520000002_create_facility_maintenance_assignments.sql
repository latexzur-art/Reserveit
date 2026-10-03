-- =====================================================
-- Create Facility Maintenance Assignments Table
-- =====================================================
-- Description: Many-to-many junction between facilities and maintenance_staff.
--   A staff member can cover multiple facilities; a facility can have multiple
--   staff. Unassigning is a soft operation (is_active=false, unassigned_at set)
--   so assignment history is preserved for audit.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.facility_maintenance_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  maintenance_staff_id UUID NOT NULL REFERENCES public.maintenance_staff(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate active assignments for the same (facility, staff) pair
CREATE UNIQUE INDEX IF NOT EXISTS facility_maintenance_unique_active
  ON public.facility_maintenance_assignments(facility_id, maintenance_staff_id)
  WHERE is_active = true;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS fma_facility_idx
  ON public.facility_maintenance_assignments(facility_id);
CREATE INDEX IF NOT EXISTS fma_staff_idx
  ON public.facility_maintenance_assignments(maintenance_staff_id);
CREATE INDEX IF NOT EXISTS fma_active_idx
  ON public.facility_maintenance_assignments(is_active) WHERE is_active = true;

CREATE TRIGGER update_fma_updated_at
  BEFORE UPDATE ON public.facility_maintenance_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE public.facility_maintenance_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage facility_maintenance_assignments"
  ON public.facility_maintenance_assignments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Building admins can read facility_maintenance_assignments"
  ON public.facility_maintenance_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'building_admin'
        AND ur.is_active = true
    )
  );

COMMENT ON TABLE public.facility_maintenance_assignments IS
  'Tracks which maintenance staff members are assigned to which facilities.';
COMMENT ON COLUMN public.facility_maintenance_assignments.is_active IS
  'False = soft-unassigned. History rows remain for audit.';
