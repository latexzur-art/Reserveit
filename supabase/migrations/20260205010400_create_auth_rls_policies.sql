-- =====================================================
-- Migration: Create Auth RLS Policies
-- =====================================================
-- Description: Row Level Security policies for user management
-- Date: 2026-02-05
-- =====================================================

-- ============================================================
-- USERS TABLE RLS POLICIES
-- ============================================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "User managers can view all users" ON public.users;
DROP POLICY IF EXISTS "User managers can create users" ON public.users;
DROP POLICY IF EXISTS "User managers can update users" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;

-- Enable RLS (if not already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth_user_id = auth.uid());

-- Policy 2: User Managers can view all users
CREATE POLICY "User managers can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON u.id = ur.user_id
      JOIN public.roles r ON ur.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name IN ('user_manager', 'building_admin', 'school_admin')
        AND ur.is_active = TRUE
        AND u.account_status = 'active'
    )
  );

-- Policy 3: User Managers can create users
CREATE POLICY "User managers can create users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON u.id = ur.user_id
      JOIN public.roles r ON ur.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name = 'user_manager'
        AND ur.is_active = TRUE
        AND u.account_status = 'active'
    )
  );

-- Policy 4: User Managers can update users
CREATE POLICY "User managers can update users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON u.id = ur.user_id
      JOIN public.roles r ON ur.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name = 'user_manager'
        AND ur.is_active = TRUE
        AND u.account_status = 'active'
    )
  );

-- Policy 5: Service role has full access
CREATE POLICY "Service role can manage users"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- USER_ROLES TABLE RLS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "User managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "User managers can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can manage user roles" ON public.user_roles;

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own role assignments
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- Policy 2: User Managers can view all role assignments
CREATE POLICY "User managers can view all roles"
  ON public.user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON u.id = ur.user_id
      JOIN public.roles r ON ur.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name IN ('user_manager', 'building_admin', 'school_admin')
        AND ur.is_active = TRUE
    )
  );

-- Policy 3: User Managers can manage role assignments
CREATE POLICY "User managers can manage roles"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_roles ur ON u.id = ur.user_id
      JOIN public.roles r ON ur.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name = 'user_manager'
        AND ur.is_active = TRUE
    )
  );

-- Policy 4: Service role has full access
CREATE POLICY "Service role can manage user roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- ROLES TABLE RLS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active roles" ON public.roles;
DROP POLICY IF EXISTS "Service role can manage roles" ON public.roles;

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone authenticated can view active roles
CREATE POLICY "Anyone can view active roles"
  ON public.roles FOR SELECT
  USING (is_active = TRUE);

-- Policy 2: Service role has full access
CREATE POLICY "Service role can manage roles"
  ON public.roles FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- DEPARTMENTS TABLE - Allow authenticated users to view
-- ============================================================

-- Drop existing and create new policy
DROP POLICY IF EXISTS "Authenticated users can view departments" ON public.departments;

CREATE POLICY "Authenticated users can view departments"
  ON public.departments FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- Add comments
COMMENT ON POLICY "Users can view own profile" ON public.users IS 'Allows users to view their own profile data';
COMMENT ON POLICY "User managers can view all users" ON public.users IS 'Allows user managers to view all user profiles';
COMMENT ON POLICY "User managers can create users" ON public.users IS 'Allows user managers to pre-create internal user accounts';
COMMENT ON POLICY "User managers can update users" ON public.users IS 'Allows user managers to update user profiles and status';
