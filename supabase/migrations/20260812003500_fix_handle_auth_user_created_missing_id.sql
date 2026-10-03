-- ============================================================
-- Migration: Fix handle_auth_user_created missing id column
-- ============================================================
-- Description: The 20260520000040 migration omitted the 'id' column
--              in INSERT INTO public.users, causing a NULL constraint
--              violation on public.users.id during external signup,
--              which resulted in "Database error saving new user".
-- Date: 2026-08-12
-- ============================================================

-- Step 1: Ensure public.users.id has a default UUID generator as a safety net
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 2: Fix handle_auth_user_created trigger function
CREATE OR REPLACE FUNCTION handle_auth_user_created()
RETURNS TRIGGER AS $$
DECLARE
  existing_user_id UUID;
  user_email TEXT;
  external_client_role_id UUID;
BEGIN
  user_email := LOWER(NEW.email);

  -- Check if this email was pre-created by User Manager
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE LOWER(email) = user_email
    AND auth_user_id IS NULL;  -- Not yet linked

  IF existing_user_id IS NOT NULL THEN
    -- Found pre-created user! Link the auth user to existing profile
    UPDATE public.users
    SET
      auth_user_id = NEW.id,
      account_status = 'active',
      email_verified = TRUE,
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = existing_user_id;

    RAISE NOTICE 'Linked auth user % to existing user %', NEW.id, existing_user_id;

  ELSE
    -- Check if external user (non-STI email)
    -- Allow self-registration for non-institutional emails
    IF user_email NOT LIKE '%@reserveitlucena.onmicrosoft.com' 
       AND user_email NOT LIKE '%@lucena.sti.edu.ph' THEN

      -- Auto-create external user profile
      INSERT INTO public.users (
        id,
        auth_user_id,
        email,
        full_name,
        user_type,
        account_status,
        email_verified,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.id,
        user_email,
        COALESCE(
          NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'name',
          'External User'
        ),
        'external',
        'active',
        COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE),
        NOW(),
        NOW()
      );

      -- Get the external_client role ID
      SELECT id INTO external_client_role_id
      FROM public.roles
      WHERE name = 'external_client'
      LIMIT 1;

      -- Assign external_client role if it exists
      IF external_client_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id, is_active, assigned_at)
        SELECT
          u.id,
          external_client_role_id,
          TRUE,
          NOW()
        FROM public.users u
        WHERE u.auth_user_id = NEW.id;
      END IF;

      RAISE NOTICE 'Created new external user for %', user_email;

    ELSE
      -- Internal domain (STI) but not pre-registered = denied
      -- We don't create a user profile, so they won't have access
      RAISE NOTICE 'Denied access for unregistered internal user: %', user_email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
