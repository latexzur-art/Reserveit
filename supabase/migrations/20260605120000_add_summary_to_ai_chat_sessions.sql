-- =========================================================
-- AI Chat Sessions — stored conversation summary
-- Lets the assistant recall PAST conversations: a one-line
-- summary is generated when a chat completes, shown in the
-- History list and fed into the next chat's context — without
-- recomputing it each time.
-- =========================================================

ALTER TABLE public.ai_chat_sessions
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS title   TEXT;
