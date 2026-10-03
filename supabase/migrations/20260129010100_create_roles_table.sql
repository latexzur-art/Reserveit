-- =====================================================
-- Phase 1.2: Create Roles Table
-- =====================================================
-- Description: Role definitions for access control
-- Roles: Building Admin, Faculty, Program Head, Academic Head, External Client
-- Date: 2026-01-29
-- =====================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS roles_name_idx ON public.roles(name);
CREATE INDEX IF NOT EXISTS roles_is_active_idx ON public.roles(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active roles
CREATE POLICY "Anyone can view active roles"
  ON public.roles FOR SELECT
  USING (is_active = true);

-- Only service role can modify roles (backend operations)
CREATE POLICY "Service role can manage roles"
  ON public.roles FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO public.roles (name, description, permissions) VALUES
  ('building_admin', 'Building Administrator - Full system access for facility and booking management',
   '{"facilities": ["create", "read", "update", "delete"], "bookings": ["create", "read", "update", "delete", "approve"], "users": ["read", "update"], "equipment": ["create", "read", "update", "delete"], "reports": ["read"]}'),
  ('faculty', 'Faculty Member - Can create and manage own facility bookings',
   '{"facilities": ["read"], "bookings": ["create", "read", "update", "delete"], "equipment": ["read"]}'),
  ('program_head', 'Program Head - Can approve bookings within their department',
   '{"facilities": ["read"], "bookings": ["create", "read", "update", "delete", "approve_department"], "equipment": ["read"], "users": ["read_department"]}'),
  ('academic_head', 'Academic Head - Final approval authority for all academic bookings',
   '{"facilities": ["read"], "bookings": ["create", "read", "update", "delete", "approve_all"], "equipment": ["read"], "users": ["read"]}'),
  ('external_client', 'External Client - Limited access for external facility rentals',
   '{"facilities": ["read"], "bookings": ["create", "read"], "equipment": ["read"]}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.roles IS 'User role definitions for ReserveIt access control system';
COMMENT ON COLUMN public.roles.name IS 'Unique role identifier (building_admin, faculty, program_head, academic_head, external_client)';
COMMENT ON COLUMN public.roles.permissions IS 'JSON object defining CRUD permissions for each resource';
