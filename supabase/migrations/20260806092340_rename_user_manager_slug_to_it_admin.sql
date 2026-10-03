-- =====================================================
-- Rename role slug user_manager -> it_admin
-- =====================================================
-- Description: Renames the machine slug of the IT Admin role from
--   'user_manager' to 'it_admin'. Everything that string-matched the old
--   slug is updated in the SAME transaction so RLS/authorization never has a
--   window where the role exists under a name nothing recognizes:
--     * 4 SECURITY DEFINER functions (recreated with the new slug)
--     * 5 RLS policies on users / user_roles (qual/with_check swapped)
--     * the roles.name row itself (updated last)
--   The role_id (UUID) is unchanged, so user_roles assignments are preserved.
-- Date: 2026-08-06
-- =====================================================

-- ---- Functions (slug user_manager -> it_admin) ----
CREATE OR REPLACE FUNCTION public.get_user_primary_role()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  role_priority TEXT[] := ARRAY[
    'it_admin',
    'building_admin',
    'pamo_officer',
    'academic_head',
    'program_head',
    'faculty',
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
$function$;

CREATE OR REPLACE FUNCTION public.get_user_statistics()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  -- Check if current user is a user manager
  IF NOT user_has_role('it_admin') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.update_user_status(p_user_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user is a user manager
  IF NOT user_has_role('it_admin') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.create_internal_user(p_email text, p_full_name text, p_employee_id text DEFAULT NULL::text, p_department_id uuid DEFAULT NULL::uuid, p_phone text DEFAULT NULL::text, p_role_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_employee_id TEXT;
  v_created_by UUID;
  v_role_id UUID;
BEGIN
  -- Check if current user is a user manager
  IF NOT user_has_role('it_admin') THEN
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
$function$;

-- ---- RLS policies (slug user_manager -> it_admin) ----
ALTER POLICY "User managers can manage roles" ON public.user_roles
  USING (user_has_role('it_admin'));

ALTER POLICY "User managers can view all roles" ON public.user_roles
  USING (user_has_any_role(ARRAY['it_admin', 'building_admin', 'school_admin']));

ALTER POLICY "User managers can create users" ON public.users
  WITH CHECK (user_has_role('it_admin'));

ALTER POLICY "User managers can update users" ON public.users
  USING (user_has_role('it_admin'));

ALTER POLICY "User managers can view all users" ON public.users
  USING (user_has_any_role(ARRAY['it_admin', 'building_admin', 'school_admin']));

-- ---- The role row itself (last) ----
UPDATE public.roles SET name = 'it_admin', updated_at = NOW() WHERE name = 'user_manager';
