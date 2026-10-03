-- ============================================================
-- Migration: Auto-link pre-created profiles on every login
-- ============================================================
-- Description:
--   The original linking trigger (handle_auth_user_created) only runs
--   AFTER INSERT ON auth.users — i.e. the FIRST time a Microsoft account
--   signs in. If a Microsoft account had already signed in BEFORE the
--   User Manager created its profile, that auth.users row already exists,
--   so re-logging-in never re-fires the trigger and the profile stays
--   unlinked (auth_user_id IS NULL). get_current_user_with_roles then
--   returns NULL and the user sees "Your account is not yet set up".
--
--   This extends update_user_last_login (which fires on EVERY session
--   creation, i.e. every login) so that, when no profile is linked to the
--   logging-in auth user, it links an unlinked profile matching the login
--   email. Linking happens on any login, not just the first.
--
--   Only a 'pending' profile is auto-activated; archived ('inactive') and
--   'suspended' profiles are linked but left in their state (access is
--   still gated by get_current_user_with_roles' account_status='active').
-- Date: 2026-06-19
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
DECLARE
  v_login_email TEXT;
  v_rows INT;
BEGIN
  -- Update last_login for the already-linked profile.
  UPDATE public.users
  SET
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE auth_user_id = NEW.user_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- No linked profile: try to link a pre-created, unlinked profile by email.
  IF v_rows = 0 THEN
    SELECT LOWER(email) INTO v_login_email
    FROM auth.users
    WHERE id = NEW.user_id;

    IF v_login_email IS NOT NULL THEN
      UPDATE public.users
      SET
        auth_user_id = NEW.user_id,
        account_status = CASE WHEN account_status = 'pending' THEN 'active' ELSE account_status END,
        email_verified = TRUE,
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE LOWER(email) = v_login_email
        AND auth_user_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_user_last_login IS
  'On every login: updates last_login_at for the linked profile, and links a pre-created unlinked profile by email when the auth user predates the profile.';
