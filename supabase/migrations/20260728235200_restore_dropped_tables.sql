-- =====================================================
-- Restore conversations, conversation_participants, user_preferences,
-- term_course_activations (erroneously dropped)
-- =====================================================
-- Description: Same root cause as 20260728235000_restore_maintenance_records.sql —
--   20260728234000_phase4_empty_table_cleanup.sql dropped these four tables as
--   "confirmed-unused, 0 rows, zero application code references." That premise
--   was false for all four:
--     - conversations / conversation_participants: backend/admin/admin-messaging.service.ts,
--       used by /api/admin/messages, /api/admin/broadcasts, /api/admin/templates,
--       /api/admin/building/messages, /api/academic-head/messages
--     - user_preferences: backend/admin/building/building-settings.service.ts
--       (getPreferences/updatePreferences — the Notifications/Appearance settings tabs)
--     - term_course_activations: backend/course/courseApproval.decisions.ts
--   Restored verbatim from their original definitions:
--     20260514141641_create_messaging_system.sql
--     20260317000000_create_user_preferences.sql
--     20260415000003_create_term_course_activations_table.sql
--   Timestamped to slot in immediately after the erroneous drop and before
--   any later migration that depends on these tables.
--
--   NOTE: as with maintenance_records, any rows that existed before the drop
--   are not recoverable here — restore from a pre-2026-07-28 23:13 backup/PITR
--   if this environment had real data in these tables.
-- Date: 2026-07-29
-- =====================================================

-- 1. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_message_text TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Conversation Participants (junction)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- messages already exists (not dropped) — re-assert the linkage columns, idempotent
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation_id ON public.conversation_participants(conversation_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = public.conversations.id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants sub
      WHERE sub.conversation_id = public.conversation_participants.conversation_id
      AND sub.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Service role manages messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = public.messages.conversation_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert messages into their conversations" ON public.messages;
CREATE POLICY "Users can insert messages into their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = public.messages.conversation_id
      AND user_id = (SELECT auth.uid())
    )
  );

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.conversations IS 'Groups messages into threads between participants';
COMMENT ON TABLE public.conversation_participants IS 'Junction table linking users to conversations';
COMMENT ON COLUMN public.messages.conversation_id IS 'Links the message to a specific thread';

-- 3. User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('notifications', 'locale', 'appearance')),
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can manage own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Service role full access on user_preferences" ON public.user_preferences;
CREATE POLICY "Service role full access on user_preferences"
  ON public.user_preferences FOR ALL
  USING ((SELECT auth.role()) = 'service_role');

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Term Course Activations
CREATE TABLE IF NOT EXISTS public.term_course_activations (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID          NOT NULL REFERENCES public.courses(id)        ON DELETE CASCADE,
  academic_term_id  UUID          NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  activation_method TEXT          NOT NULL DEFAULT 'auto'
                                  CHECK (activation_method IN ('auto', 'manual_override')),
  activated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deactivated_at    TIMESTAMPTZ,
  deactivated_by    UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, academic_term_id)
);

CREATE INDEX IF NOT EXISTS idx_tca_course      ON public.term_course_activations(course_id);
CREATE INDEX IF NOT EXISTS idx_tca_term        ON public.term_course_activations(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_tca_active_term ON public.term_course_activations(academic_term_id, is_active);

ALTER TABLE public.term_course_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_term_offerings" ON public.term_course_activations;
CREATE POLICY "authenticated_read_term_offerings"
  ON public.term_course_activations
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "academic_head_manage_activations" ON public.term_course_activations;
CREATE POLICY "academic_head_manage_activations"
  ON public.term_course_activations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name = 'academic_head'
        AND ur.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION auto_activate_courses_for_term(p_term_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO public.term_course_activations (course_id, academic_term_id, is_active, activation_method)
  SELECT
    c.id,
    cu.academic_term_id,
    TRUE,
    'auto'
  FROM public.courses c
  JOIN public.course_uploads cu ON cu.id = c.batch_upload_id
  WHERE cu.academic_term_id = p_term_id
    AND c.approval_status = 'approved'
    AND c.is_active = TRUE
  ON CONFLICT (course_id, academic_term_id)
  DO UPDATE SET
    is_active         = TRUE,
    activation_method = 'auto',
    activated_at      = NOW(),
    deactivated_at    = NULL,
    deactivated_by    = NULL,
    updated_at        = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
