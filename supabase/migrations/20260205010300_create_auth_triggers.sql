-- =====================================================
-- Migration: Create Auth Triggers
-- =====================================================
-- Description: Triggers to link auth.users to public.users on sign-in
--              and update last_login_at on session creation
-- Date: 2026-02-05
-- =====================================================

-- ============================================================
-- TRIGGER 1: Link auth.users to public.users on sign-in
-- ============================================================

-- Drop existing trigger and function if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_auth_user_created();

-- Create the function
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
    IF user_email NOT LIKE '%@reserveitlucena.onmicrosoft.com' THEN

      -- Auto-create external user profile
      INSERT INTO public.users (
        email,
        full_name,
        user_type,
        account_status,
        email_verified,
        auth_user_id,
        created_at,
        updated_at
      ) VALUES (
        user_email,
        COALESCE(
          NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'name',
          'External User'
        ),
        'external',
        'active',
        COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE),
        NEW.id,
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

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_created();

-- ============================================================
-- TRIGGER 2: Update last_login_at on session creation
-- ============================================================

-- Drop existing trigger and function if any
DROP TRIGGER IF EXISTS on_session_created ON auth.sessions;
DROP FUNCTION IF EXISTS update_user_last_login();

-- Create the function
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE auth_user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.sessions
CREATE TRIGGER on_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_login();

-- ============================================================
-- TRIGGER 3: Sync email verification status
-- ============================================================

-- Drop existing if any
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS sync_email_verification();

-- Create function to sync email verification
CREATE OR REPLACE FUNCTION sync_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- When email is confirmed in auth.users, update public.users
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.users
    SET
      email_verified = TRUE,
      updated_at = NOW()
    WHERE auth_user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_verification();

-- Add comments
COMMENT ON FUNCTION handle_auth_user_created IS 'Links auth.users to pre-created public.users or creates external user profile';
COMMENT ON FUNCTION update_user_last_login IS 'Updates last_login_at when a new session is created';
COMMENT ON FUNCTION sync_email_verification IS 'Syncs email verification status from auth.users to public.users';
