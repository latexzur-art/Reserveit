-- Verification script for handle_new_user() trigger migration
-- Run this in Supabase Studio SQL Editor to verify the migration was applied

-- 1. Check if the handle_new_user() function exists and view its definition
SELECT
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = 'public'::regnamespace;

-- 2. Check if the function contains the UPDATE logic for pre-created users
-- (should return true if migration applied correctly)
SELECT
  pg_get_functiondef(oid) LIKE '%UPDATE public.users%auth_user_id = NEW.id%' as has_update_logic,
  pg_get_functiondef(oid) LIKE '%account_status = ''active''%' as has_auto_activate,
  pg_get_functiondef(oid) LIKE '%WHERE LOWER(email) = LOWER(NEW.email)%AND auth_user_id IS NULL%' as has_precreated_check
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = 'public'::regnamespace;

-- 3. Check for any pre-created internal users waiting to be linked
SELECT
  COUNT(*) as pending_internal_users,
  json_agg(json_build_object(
    'email', email,
    'full_name', full_name,
    'user_type', user_type,
    'account_status', account_status
  )) as users
FROM public.users
WHERE user_type = 'internal'
  AND auth_user_id IS NULL;

-- 4. Verify the trigger is still attached to auth.users
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
