-- =========================================================
-- AI Chat Sessions
-- Stores per-user chatbot conversations with 7-day TTL.
-- Client never queries Supabase directly — all access
-- goes through /api/ai/sessions* API routes.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages         JSONB       NOT NULL DEFAULT '[]',
  collected_fields JSONB       NOT NULL DEFAULT '{}',
  booking_flow     TEXT        NOT NULL DEFAULT 'standard',  -- 'standard' | 'paid'
  session_status   TEXT        NOT NULL DEFAULT 'active',   -- 'active' | 'completed'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions"
  ON public.ai_chat_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Fast lookup: most recent active session for a user
CREATE INDEX idx_ai_chat_sessions_user_recent
  ON public.ai_chat_sessions (user_id, last_active_at DESC)
  WHERE session_status = 'active';
