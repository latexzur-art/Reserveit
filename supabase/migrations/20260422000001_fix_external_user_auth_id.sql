-- Fix handle_new_user() to set auth_user_id for new external users.
-- The previous version only set id = NEW.id but left auth_user_id NULL,
-- which caused get_current_user_with_roles() to always return null for
-- email/password and Google OAuth sign-ups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_user_id UUID;
BEGIN
  -- Check if user already exists with NULL auth_user_id (pre-created internal user)
  SELECT id INTO existing_user_id
  FROM public.users
  WHERE LOWER(email) = LOWER(NEW.email)
    AND auth_user_id IS NULL;

  IF existing_user_id IS NOT NULL THEN
    -- Link pre-created internal user to auth account and activate
    UPDATE public.users
    SET
      auth_user_id = NEW.id,
      email_verified = (NEW.email_confirmed_at IS NOT NULL),
      account_status = 'active',
      updated_at = NOW()
    WHERE id = existing_user_id;
  ELSE
    -- New external user (email/password or Google OAuth)
    -- auth_user_id must be set so get_current_user_with_roles() can find them
    INSERT INTO public.users (id, auth_user_id, email, full_name, email_verified, user_type, account_status)
    VALUES (
      NEW.id,
      NEW.id,  -- auth_user_id = auth.uid() so RPC lookups work immediately
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email_confirmed_at IS NOT NULL,
      'external',
      'active'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill any existing external users created before this fix
UPDATE public.users
SET auth_user_id = id
WHERE user_type = 'external'
  AND auth_user_id IS NULL;
