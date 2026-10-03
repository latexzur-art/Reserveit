-- ============================================================
-- Migration: Add must_change_password flag to users
-- ============================================================
-- Description: Adds must_change_password column to public.users
--              so external users created with temporary passwords
--              by admins are required to update their password on
--              first sign-in.
-- Date: 2026-08-12
-- ============================================================

-- Step 1: Add must_change_password column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Step 2: Update get_current_user_with_roles RPC function to include must_change_password
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
    'must_change_password', COALESCE(u.must_change_password, FALSE),
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
