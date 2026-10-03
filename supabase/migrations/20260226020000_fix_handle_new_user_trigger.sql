-- Fix handle_new_user() trigger to support pre-created internal users
-- This allows internal users (building admins, etc.) to be pre-created by User Managers
-- and automatically linked when they sign in via Microsoft 365

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
      account_status = 'active',  -- Auto-activate on first sign-in
      updated_at = NOW()
    WHERE id = existing_user_id;
  ELSE
    -- Insert new external user (email/password signup)
    INSERT INTO public.users (id, email, full_name, email_verified, user_type, account_status)
    VALUES (
      NEW.id,
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
