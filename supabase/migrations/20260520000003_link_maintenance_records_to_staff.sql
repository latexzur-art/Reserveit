-- =====================================================
-- Link Maintenance Records to Maintenance Staff
-- =====================================================
-- Description: Adds an optional FK from maintenance_records to maintenance_staff
--   so a technician can be a real DB entity rather than free text.
--   The existing TEXT 'technician' column is preserved for backwards compatibility
--   and display — when maintenance_staff_id is set, the service should also
--   write the resolved name into 'technician'.
-- =====================================================

ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS maintenance_staff_id UUID
    REFERENCES public.maintenance_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maintenance_records_staff_idx
  ON public.maintenance_records(maintenance_staff_id);

COMMENT ON COLUMN public.maintenance_records.maintenance_staff_id IS
  'Optional FK to maintenance_staff. When set, technician (TEXT) is also populated for display.';
