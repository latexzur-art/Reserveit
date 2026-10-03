-- =========================================================
-- Repoint ai_chat_sessions.user_id FK: auth.users(id) -> public.users(id)
--
-- Bug: the original create migration declared
--   user_id UUID NOT NULL REFERENCES auth.users(id)
-- but every ReserveIT API route inserts the *profile* id (public.users.id —
-- what get_current_user_with_roles() returns as `id` and the app calls
-- `user.id`). A profile id is not an auth.users id, so every
-- POST /api/ai/sessions insert failed with FK violation 23503, a code the
-- route silently swallows (`return { id: null }`). Result: no session ever
-- persisted, Rita's "Past conversations" stayed empty, and "New chat" had
-- nothing to archive.
--
-- Fix: reference public.users(id), matching bookings.user_id and every other
-- app table (the profile PK is the app's universal user identity). RLS is
-- unchanged — the existing users_own_sessions policy already mirrors the
-- bookings policy, and all session routes use the service-role client anyway.
-- =========================================================

-- Drop the old constraint pointing at auth.users (idempotent).
ALTER TABLE public.ai_chat_sessions
  DROP CONSTRAINT IF EXISTS ai_chat_sessions_user_id_fkey;

-- Add the corrected constraint pointing at public.users. Guarded so re-running
-- is a no-op. The table holds no rows that reference auth.users (all prior
-- inserts FK-failed), so validating existing data at migration time is free.
DO $$ BEGIN
  ALTER TABLE public.ai_chat_sessions
    ADD CONSTRAINT ai_chat_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
