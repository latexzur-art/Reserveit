-- Messaging System Migration v1
-- Implements Conversations, Participants, and Enhanced Messages

-- 1. Create Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_message_text TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Conversation Participants table (Junction)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user is only once in a conversation
  UNIQUE(conversation_id, user_id)
);

-- 3. Enhance Messages table (Renaming/Migrating if necessary, but here we add a new one or adapt)
-- Since public.messages already exists, we will adapt it to link to conversations
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation_id ON public.conversation_participants(conversation_id);

-- 5. RLS Policies

-- Conversations: Users can see conversations they participate in
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = public.conversations.id
      AND user_id = auth.uid()
    )
  );

-- Conversation Participants: Users can see fellow participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants sub
      WHERE sub.conversation_id = public.conversation_participants.conversation_id
      AND sub.user_id = auth.uid()
    )
  );

-- Messages: Users can see messages in their conversations
-- (The existing messages table might have its own RLS, we update it)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop old policy if exists to avoid conflicts (based on previous view_file)
DROP POLICY IF EXISTS "Service role manages messages" ON public.messages;

CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = public.messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages into their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = public.messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- 6. Trigger for updated_at on conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.conversations IS 'Groups messages into threads between participants';
COMMENT ON TABLE public.conversation_participants IS 'Junction table linking users to conversations';
COMMENT ON COLUMN public.messages.conversation_id IS 'Links the message to a specific thread';
