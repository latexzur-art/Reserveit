-- =====================================================
-- Phase 1.2: Create Employee Registry Table
-- =====================================================
-- Description: Official STI employee roster for sign-up verification
-- Ensures only legitimate STI employees can register as Faculty
-- Date: 2026-01-30
-- =====================================================

-- Create employment status enum
DO $$ BEGIN
  CREATE TYPE employment_status AS ENUM ('active', 'resigned', 'on_leave');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create employee_registry table
CREATE TABLE IF NOT EXISTS public.employee_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL, -- Official STI employee number
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, -- School-issued email
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  position TEXT, -- Faculty, Staff, Program Head, etc.
  employment_status employment_status DEFAULT 'active',
  is_claimed BOOLEAN DEFAULT false, -- True when user registers
  claimed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP WITH TIME ZONE,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS employee_registry_employee_id_idx ON public.employee_registry(employee_id);
CREATE INDEX IF NOT EXISTS employee_registry_email_idx ON public.employee_registry(email);
CREATE INDEX IF NOT EXISTS employee_registry_department_id_idx ON public.employee_registry(department_id);
CREATE INDEX IF NOT EXISTS employee_registry_is_claimed_idx ON public.employee_registry(is_claimed);
CREATE INDEX IF NOT EXISTS employee_registry_employment_status_idx ON public.employee_registry(employment_status);

-- Enable Row Level Security
ALTER TABLE public.employee_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role has full access (admin operations)
CREATE POLICY "Service role can manage employee registry"
  ON public.employee_registry FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can check if email exists (for registration verification)
CREATE POLICY "Users can verify their own email"
  ON public.employee_registry FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Add trigger for updated_at
CREATE TRIGGER update_employee_registry_updated_at
  BEFORE UPDATE ON public.employee_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to verify and claim employee record during registration
CREATE OR REPLACE FUNCTION public.claim_employee_record(user_email TEXT, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  employee_record RECORD;
BEGIN
  -- Find unclaimed employee record with matching email
  SELECT * INTO employee_record
  FROM public.employee_registry
  WHERE email = user_email
    AND is_claimed = false
    AND employment_status = 'active';

  IF employee_record IS NULL THEN
    RETURN false;
  END IF;

  -- Claim the record
  UPDATE public.employee_registry
  SET is_claimed = true,
      claimed_by_user_id = user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = employee_record.id;

  -- Update user's department if employee has one
  IF employee_record.department_id IS NOT NULL THEN
    UPDATE public.users
    SET department_id = employee_record.department_id,
        employee_id = employee_record.employee_id,
        updated_at = NOW()
    WHERE id = user_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample employee records (for testing)
INSERT INTO public.employee_registry (employee_id, full_name, email, position, employment_status) VALUES
  ('EMP-001', 'Juan Dela Cruz', 'juan.delacruz@sti.edu.ph', 'Faculty', 'active'),
  ('EMP-002', 'Maria Santos', 'maria.santos@sti.edu.ph', 'Program Head', 'active'),
  ('EMP-003', 'Pedro Reyes', 'pedro.reyes@sti.edu.ph', 'Faculty', 'active'),
  ('EMP-004', 'Ana Garcia', 'ana.garcia@sti.edu.ph', 'Academic Head', 'active'),
  ('EMP-005', 'Jose Rizal', 'jose.rizal@sti.edu.ph', 'Building Admin', 'active')
ON CONFLICT (employee_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.employee_registry IS 'Official STI employee roster for sign-up verification';
COMMENT ON COLUMN public.employee_registry.employee_id IS 'Official STI employee number';
COMMENT ON COLUMN public.employee_registry.is_claimed IS 'True when an employee has registered and claimed their account';
COMMENT ON FUNCTION public.claim_employee_record(TEXT, UUID) IS 'Verify and claim employee record during user registration';
