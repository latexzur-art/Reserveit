-- Applied via SQL editor on prod. Local equivalent: 20260521000000_create_ai_chat_sessions.sql
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages         JSONB       NOT NULL DEFAULT '[]',
  collected_fields JSONB       NOT NULL DEFAULT '{}',
  booking_flow     TEXT        NOT NULL DEFAULT 'standard',
  session_status   TEXT        NOT NULL DEFAULT 'active',
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

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_recent
  ON public.ai_chat_sessions (user_id, last_active_at DESC)
  WHERE session_status = 'active';
