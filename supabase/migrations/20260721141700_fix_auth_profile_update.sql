-- =====================================================
-- Migration: Fix Auth Profile Update
-- =====================================================
-- Description: Updates the 'Users can update own profile' policy 
--              and includes 'notification_email' in the get_current_user_with_roles RPC
-- Date: 2026-07-21
-- =====================================================

-- 1. Fix the RLS Policy for updating own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());


-- 2. Fix the RPC function to include notification_email
CREATE OR REPLACE FUNCTION get_current_user_with_roles()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', u.id,
    'auth_user_id', u.auth_user_id,
    'email', u.email,
    'full_name', u.full_name,
    'user_type', u.user_type,
    'account_status', u.account_status,
    'employee_id', u.employee_id,
    'phone', u.phone,
    'avatar_url', u.avatar_url,
    'email_verified', u.email_verified,
    'notification_email', u.notification_email,
    'last_login_at', u.last_login_at,
    'created_at', u.created_at,
    'department', CASE
      WHEN d.id IS NOT NULL THEN json_build_object(
        'id', d.id,
        'code', d.code,
        'name', d.name
      )
      ELSE NULL
    END,
    'roles', COALESCE(
      (SELECT json_agg(json_build_object(
        'id', r.id,
        'name', r.name,
        'displayName', r.display_name,
        'badgeColor', r.badge_color
      ) ORDER BY r.name)
       FROM public.user_roles ur
       JOIN public.roles r ON ur.role_id = r.id
       WHERE ur.user_id = u.id
         AND ur.is_active = TRUE
         AND r.is_active = TRUE
      ),
      '[]'::json
    )
  ) INTO result
  FROM public.users u
  LEFT JOIN public.departments d ON u.department_id = d.id
  WHERE u.auth_user_id = auth.uid()
    AND u.account_status = 'active';

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
