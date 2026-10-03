-- =====================================================
-- Restore maintenance_records (erroneously dropped)
-- =====================================================
-- Description: Migration 20260728234000_phase4_empty_table_cleanup.sql dropped
--   public.maintenance_records as a "confirmed-unused, 0 rows, zero application
--   code references" table. That premise was false: it is read/written by
--   backend/admin/building/building-maintenance.service.ts,
--   building-dashboard.service.ts, building-calendar.service.ts, the
--   academic-head-reminders cron, components/admin/settings/DangerZoneTab.tsx,
--   and (as of this same date) building-facilityEnhancement.service.ts's
--   issue-report -> maintenance conversion flow. Any environment that has run
--   the phase4 cleanup migration currently has a broken admin Maintenance
--   feature. This migration restores the table verbatim from its original
--   definition (20260316000000_create_maintenance_records_table.sql) plus the
--   maintenance_staff_id link added later (20260520000003), so the table's
--   shape is unchanged from before the erroneous drop.
--
--   NOTE: any rows that existed in maintenance_records before the drop are not
--   recoverable by this migration — the DROP already happened. If this
--   environment had real maintenance data, restore it from a DB backup/PITR
--   taken before 2026-07-28 23:13, not from this migration.
-- Date: 2026-07-29
-- =====================================================

CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('facility', 'equipment')),
  target_id UUID NOT NULL,
  target_name TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  completed_date DATE,
  technician TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  maintenance_staff_id UUID REFERENCES public.maintenance_staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS maintenance_records_type_idx ON public.maintenance_records(type);
CREATE INDEX IF NOT EXISTS maintenance_records_target_id_idx ON public.maintenance_records(target_id);
CREATE INDEX IF NOT EXISTS maintenance_records_status_idx ON public.maintenance_records(status);
CREATE INDEX IF NOT EXISTS maintenance_records_schedule_date_idx ON public.maintenance_records(schedule_date);
CREATE INDEX IF NOT EXISTS maintenance_records_is_active_idx ON public.maintenance_records(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS maintenance_records_staff_idx ON public.maintenance_records(maintenance_staff_id);

ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view maintenance records" ON public.maintenance_records;
CREATE POLICY "Authenticated users can view maintenance records"
  ON public.maintenance_records FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage maintenance records" ON public.maintenance_records;
CREATE POLICY "Service role can manage maintenance records"
  ON public.maintenance_records FOR ALL
  USING ((SELECT auth.role()) = 'service_role');

DROP TRIGGER IF EXISTS update_maintenance_records_updated_at ON public.maintenance_records;
CREATE TRIGGER update_maintenance_records_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.maintenance_records IS 'Maintenance schedules for facilities and equipment';
COMMENT ON COLUMN public.maintenance_records.type IS 'Whether this is facility or equipment maintenance';
COMMENT ON COLUMN public.maintenance_records.target_id IS 'UUID of the facility or equipment being maintained';
COMMENT ON COLUMN public.maintenance_records.target_name IS 'Display name of the target (denormalized for convenience)';
COMMENT ON COLUMN public.maintenance_records.maintenance_staff_id IS
  'Optional FK to maintenance_staff. When set, technician (TEXT) is also populated for display.';
