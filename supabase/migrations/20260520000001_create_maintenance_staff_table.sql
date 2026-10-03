-- =====================================================
-- Create Maintenance Staff Table
-- =====================================================
-- Description: Standalone table for maintenance staff who do not have
--   Microsoft Entra (MS) accounts and therefore cannot use the normal
--   auth signup flow. Their employee IDs are auto-generated (MNT-XXXX).
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS public.maintenance_staff_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_maintenance_staff_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('public.maintenance_staff_seq');
  RETURN 'MNT-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.maintenance_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT NOT NULL DEFAULT 'Maintenance Technician',
  specialization TEXT,
  hire_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-fill employee_id from sequence on insert
CREATE OR REPLACE FUNCTION public.set_maintenance_staff_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := public.generate_maintenance_staff_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_maintenance_staff_id
  BEFORE INSERT ON public.maintenance_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_maintenance_staff_id();

CREATE TRIGGER update_maintenance_staff_updated_at
  BEFORE UPDATE ON public.maintenance_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS maintenance_staff_active_idx
  ON public.maintenance_staff(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS maintenance_staff_full_name_idx
  ON public.maintenance_staff(full_name);

-- Row Level Security
ALTER TABLE public.maintenance_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage maintenance_staff"
  ON public.maintenance_staff FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Building admins can read maintenance_staff"
  ON public.maintenance_staff FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'building_admin'
        AND ur.is_active = true
    )
  );

COMMENT ON TABLE public.maintenance_staff IS
  'Maintenance technicians who have no Microsoft account. Created and managed by building admins.';
COMMENT ON COLUMN public.maintenance_staff.employee_id IS
  'Auto-generated ID in the format MNT-XXXX.';
COMMENT ON COLUMN public.maintenance_staff.specialization IS
  'e.g. HVAC, Electrical, Plumbing, General';
