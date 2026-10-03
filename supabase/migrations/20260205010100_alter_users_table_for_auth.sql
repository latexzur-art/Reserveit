-- =====================================================
-- Migration: Alter Users Table for Pre-Creation Auth Flow
-- =====================================================
-- Description: Updates users table to support the dual-channel auth system
--              where internal users are pre-created by User Manager
-- Date: 2026-02-05
-- =====================================================

-- Step 1: Drop existing FK constraint on users.id if it references auth.users
-- This allows users to be created before they authenticate
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Step 2: Add new columns for auth flow
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'internal' CHECK (user_type IN ('internal', 'external')),
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'suspended', 'inactive')),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 3: Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON public.users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users(LOWER(email));

-- Step 4: Update existing users to active status (if any exist)
UPDATE public.users
SET
  account_status = 'active',
  user_type = 'internal'
WHERE account_status IS NULL;

-- Step 5: Add comments
COMMENT ON COLUMN public.users.auth_user_id IS 'Links to Supabase auth.users - null until first sign-in';
COMMENT ON COLUMN public.users.user_type IS 'internal = STI staff (MS365), external = clients (email/password)';
COMMENT ON COLUMN public.users.account_status IS 'pending = awaiting first login, active = normal, suspended/inactive = blocked';
COMMENT ON COLUMN public.users.created_by IS 'User Manager who created this account (for internal users)';
