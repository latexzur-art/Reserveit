-- =====================================================
-- Create Maintenance Records Table
-- =====================================================
-- Description: Tracks maintenance schedules for facilities and equipment
-- Date: 2026-03-16
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS maintenance_records_type_idx ON public.maintenance_records(type);
CREATE INDEX IF NOT EXISTS maintenance_records_target_id_idx ON public.maintenance_records(target_id);
CREATE INDEX IF NOT EXISTS maintenance_records_status_idx ON public.maintenance_records(status);
CREATE INDEX IF NOT EXISTS maintenance_records_schedule_date_idx ON public.maintenance_records(schedule_date);
CREATE INDEX IF NOT EXISTS maintenance_records_is_active_idx ON public.maintenance_records(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view maintenance records"
  ON public.maintenance_records FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage maintenance records"
  ON public.maintenance_records FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_maintenance_records_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.maintenance_records IS 'Maintenance schedules for facilities and equipment';
COMMENT ON COLUMN public.maintenance_records.type IS 'Whether this is facility or equipment maintenance';
COMMENT ON COLUMN public.maintenance_records.target_id IS 'UUID of the facility or equipment being maintained';
COMMENT ON COLUMN public.maintenance_records.target_name IS 'Display name of the target (denormalized for convenience)';
