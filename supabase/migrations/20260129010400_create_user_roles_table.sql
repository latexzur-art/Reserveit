-- =====================================================
-- Phase 1.2: Create User Roles Junction Table
-- =====================================================
-- Description: Many-to-many relationship between users and roles
-- Date: 2026-01-29
-- =====================================================

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate role assignments
  UNIQUE(user_id, role_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS user_roles_is_active_idx ON public.user_roles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS user_roles_expires_at_idx ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can view roles of other users (for display purposes)
CREATE POLICY "Authenticated users can view user roles"
  ON public.user_roles FOR SELECT
  USING (
    auth.role() = 'authenticated' AND is_active = true
  );

-- Service role has full access (for role assignment by admins)
CREATE POLICY "Service role can manage user roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(user_uuid UUID, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
      AND r.name = role_name
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(user_uuid UUID)
RETURNS TABLE(role_name TEXT, role_description TEXT, permissions JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT r.name, r.description, r.permissions
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid
    AND ur.is_active = true
    AND r.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.user_roles IS 'Junction table for many-to-many user-role assignments';
COMMENT ON COLUMN public.user_roles.assigned_by IS 'Admin user who assigned this role';
COMMENT ON COLUMN public.user_roles.expires_at IS 'Optional expiration date for temporary role assignments';
COMMENT ON FUNCTION public.user_has_role(UUID, TEXT) IS 'Check if a user has a specific role by role name';
COMMENT ON FUNCTION public.get_user_roles(UUID) IS 'Get all active roles for a user';
