-- =====================================================
-- Migration: Fix Recursive User RLS Policies
-- =====================================================
-- Description: Replaces inline subqueries in public.users 
--              and public.user_roles with SECURITY DEFINER references 
--              to prevent infinite recursion.
-- Date: 2026-02-26
-- =====================================================

-- 1. Fix public.users policies
DROP POLICY IF EXISTS "User managers can view all users" ON public.users;
CREATE POLICY "User managers can view all users"
  ON public.users FOR SELECT
  USING (public.user_has_any_role(ARRAY['user_manager', 'building_admin', 'school_admin']));

DROP POLICY IF EXISTS "User managers can create users" ON public.users;
CREATE POLICY "User managers can create users"
  ON public.users FOR INSERT
  WITH CHECK (public.user_has_role('user_manager'));

DROP POLICY IF EXISTS "User managers can update users" ON public.users;
CREATE POLICY "User managers can update users"
  ON public.users FOR UPDATE
  USING (public.user_has_role('user_manager'));

-- 2. Fix public.user_roles policies
DROP POLICY IF EXISTS "User managers can view all roles" ON public.user_roles;
CREATE POLICY "User managers can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.user_has_any_role(ARRAY['user_manager', 'building_admin', 'school_admin']));

DROP POLICY IF EXISTS "User managers can manage roles" ON public.user_roles;
CREATE POLICY "User managers can manage roles"
  ON public.user_roles FOR ALL
  USING (public.user_has_role('user_manager'));
