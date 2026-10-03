-- Debug script for building administrator sign-in issue
-- Run in Supabase Studio SQL Editor

-- 1. Check current state of the building administrator user
SELECT
  id,
  email,
  full_name,
  auth_user_id,  -- Should be NULL if not linked yet
  user_type,
  account_status,  -- Showing as "pending" in UI
  created_at
FROM public.users
WHERE email ILIKE '%buildingadministrator%';

-- 2. Check if there's an auth.users record for this email
SELECT
  id as auth_id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users
WHERE email ILIKE '%buildingadministrator%';

-- 3. Check if there are multiple users with similar emails
SELECT
  id,
  email,
  auth_user_id,
  account_status
FROM public.users
WHERE email ILIKE '%reserveitlucena.onmicrosoft.com%'
ORDER BY created_at DESC;

-- 4. Verify the trigger function was updated correctly
SELECT
  pg_get_functiondef(oid) LIKE '%UPDATE public.users%' as has_update_logic,
  pg_get_functiondef(oid) LIKE '%auth_user_id IS NULL%' as has_null_check
FROM pg_proc
WHERE proname = 'handle_new_user';
