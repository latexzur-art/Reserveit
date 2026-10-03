-- =====================================================
-- Migration: Create Auth Helper Functions
-- =====================================================
-- Description: Database functions for authentication operations
-- Date: 2026-02-05
-- =====================================================

-- ============================================================
-- FUNCTION: Get Current User with Roles
-- ============================================================

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

-- ============================================================
-- FUNCTION: Check if User Has Role
-- ============================================================

CREATE OR REPLACE FUNCTION user_has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_roles ur ON u.id = ur.user_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
      AND r.name = role_name
      AND ur.is_active = TRUE
      AND u.account_status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Check if User Has Any of the Specified Roles
-- ============================================================

CREATE OR REPLACE FUNCTION user_has_any_role(role_names TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_roles ur ON u.id = ur.user_id
    JOIN public.roles r ON ur.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
      AND r.name = ANY(role_names)
      AND ur.is_active = TRUE
      AND u.account_status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Get User's Primary Role (highest priority)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_primary_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  role_priority TEXT[] := ARRAY[
    'user_manager',
    'building_admin',
    'school_admin',
    'dean',
    'dept_head',
    'faculty',
    'cashier',
    'external_client'
  ];
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY role_priority
  LOOP
    IF user_has_role(role_name) THEN
      RETURN role_name;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Check if Email is Pre-Registered
-- ============================================================

CREATE OR REPLACE FUNCTION is_email_preregistered(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE LOWER(email) = LOWER(check_email)
      AND auth_user_id IS NULL
      AND account_status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Get User Statistics (for User Manager dashboard)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_statistics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if current user is a user manager
  IF NOT user_has_role('user_manager') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.users WHERE is_active = TRUE),
    'internal_users', (SELECT COUNT(*) FROM public.users WHERE user_type = 'internal' AND is_active = TRUE),
    'external_users', (SELECT COUNT(*) FROM public.users WHERE user_type = 'external' AND is_active = TRUE),
    'pending_users', (SELECT COUNT(*) FROM public.users WHERE account_status = 'pending'),
    'active_users', (SELECT COUNT(*) FROM public.users WHERE account_status = 'active'),
    'suspended_users', (SELECT COUNT(*) FROM public.users WHERE account_status = 'suspended'),
    'faculty_count', (
      SELECT COUNT(DISTINCT ur.user_id)
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE r.name = 'faculty' AND ur.is_active = TRUE
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Generate Next Employee ID
-- ============================================================

CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TEXT AS $$
DECLARE
  last_number INT;
  new_id TEXT;
BEGIN
  -- Get the highest employee ID number
  SELECT COALESCE(
    MAX(
      CASE
        WHEN employee_id ~ '^USR-[0-9]+$'
        THEN CAST(SUBSTRING(employee_id FROM 5) AS INT)
        ELSE 0
      END
    ),
    0
  ) INTO last_number
  FROM public.users;

  -- Generate new ID
  new_id := 'USR-' || LPAD((last_number + 1)::TEXT, 4, '0');

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Create Internal User (for User Manager)
-- ============================================================

CREATE OR REPLACE FUNCTION create_internal_user(
  p_email TEXT,
  p_full_name TEXT,
  p_employee_id TEXT DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role_ids UUID[] DEFAULT '{}'
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_employee_id TEXT;
  v_created_by UUID;
  v_role_id UUID;
BEGIN
  -- Check if current user is a user manager
  IF NOT user_has_role('user_manager') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get current user's ID for created_by
  SELECT id INTO v_created_by
  FROM public.users
  WHERE auth_user_id = auth.uid();

  -- Generate employee ID if not provided
  v_employee_id := COALESCE(p_employee_id, generate_employee_id());

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(email) = LOWER(p_email)) THEN
    RETURN json_build_object('success', false, 'error', 'Email already exists');
  END IF;

  -- Insert the user
  INSERT INTO public.users (
    email,
    full_name,
    employee_id,
    department_id,
    phone,
    user_type,
    account_status,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    LOWER(p_email),
    p_full_name,
    v_employee_id,
    p_department_id,
    p_phone,
    'internal',
    'pending',
    v_created_by,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_user_id;

  -- Assign roles
  FOREACH v_role_id IN ARRAY p_role_ids
  LOOP
    INSERT INTO public.user_roles (user_id, role_id, assigned_by, is_active, assigned_at)
    VALUES (v_user_id, v_role_id, v_created_by, TRUE, NOW());
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'employee_id', v_employee_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Update User Status
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_status(
  p_user_id UUID,
  p_status TEXT
)
RETURNS JSON AS $$
BEGIN
  -- Check if current user is a user manager
  IF NOT user_has_role('user_manager') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate status
  IF p_status NOT IN ('pending', 'active', 'suspended', 'inactive') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status');
  END IF;

  -- Update the user
  UPDATE public.users
  SET
    account_status = p_status,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION get_current_user_with_roles IS 'Returns the current authenticated user with their roles and department';
COMMENT ON FUNCTION user_has_role(TEXT) IS 'Checks if the current user has a specific role';
COMMENT ON FUNCTION user_has_any_role IS 'Checks if the current user has any of the specified roles';
COMMENT ON FUNCTION get_user_primary_role IS 'Returns the highest-priority role for the current user';
COMMENT ON FUNCTION is_email_preregistered IS 'Checks if an email has been pre-registered by User Manager';
COMMENT ON FUNCTION get_user_statistics IS 'Returns user statistics for the User Manager dashboard';
COMMENT ON FUNCTION generate_employee_id IS 'Generates the next sequential employee ID (USR-XXXX)';
COMMENT ON FUNCTION create_internal_user IS 'Creates a new internal user with roles (User Manager only)';
COMMENT ON FUNCTION update_user_status IS 'Updates a user account status (User Manager only)';
