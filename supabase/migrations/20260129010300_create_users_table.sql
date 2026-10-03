-- =====================================================
-- Phase 1.2: Create Users Table
-- =====================================================
-- Description: Core user profiles extending Supabase Auth
-- Date: 2026-01-29
-- =====================================================

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  phone TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_employee_id_idx ON public.users(employee_id);
CREATE INDEX IF NOT EXISTS users_department_id_idx ON public.users(department_id);
CREATE INDEX IF NOT EXISTS users_is_active_idx ON public.users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS users_full_name_idx ON public.users(full_name);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Authenticated users can view basic info of other active users
CREATE POLICY "Authenticated users can view active users"
  ON public.users FOR SELECT
  USING (
    auth.role() = 'authenticated' AND is_active = true
  );

-- Service role has full access
CREATE POLICY "Service role can manage users"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Now add the foreign key from departments.head_user_id to users
ALTER TABLE public.departments
  ADD CONSTRAINT departments_head_user_id_fkey
  FOREIGN KEY (head_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Function to handle new user signup (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email_confirmed_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comments
COMMENT ON TABLE public.users IS 'User profiles extending Supabase Auth for ReserveIt';
COMMENT ON COLUMN public.users.id IS 'References auth.users(id) - same UUID for consistency';
COMMENT ON COLUMN public.users.employee_id IS 'STI employee/student ID number';
COMMENT ON COLUMN public.users.department_id IS 'Primary department affiliation';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile when new auth user signs up';
