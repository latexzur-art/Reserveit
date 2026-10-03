-- Notification System Schema Evolution
-- Adds broadcast support, action URLs, metadata, and cleanup columns

-- 0. Ensure broadcasts table exists (prerequisite for foreign keys below)
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'internal', 'external', 'admins')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broadcasts' AND policyname = 'Service role manages broadcasts'
  ) THEN
    CREATE POLICY "Service role manages broadcasts"
      ON public.broadcasts FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 1A. Add new columns to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE SET NULL;

-- 1B. Add source_type CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_source_type_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_source_type_check CHECK (
        source_type IS NULL OR source_type IN (
          'booking',
          'schedule_upload',
          'schedule_entry',
          'facility_block',
          'broadcast',
          'admin_message',
          'restriction',
          'payment',
          'system',
          'override',
          'message',
          'schedule_conflict',
          'appeal',
          'change_request',
          'maintenance',
          'user'
        )
      );
  END IF;
END $$;

-- 1C. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at
  ON public.notifications (expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_broadcast_id
  ON public.notifications (broadcast_id) WHERE broadcast_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_is_broadcast
  ON public.notifications (user_id, is_broadcast) WHERE is_broadcast = true;

-- 1D. Extend broadcasts table
ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_roles TEXT[],
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Backfill created_by from sender_id
UPDATE public.broadcasts SET created_by = sender_id WHERE created_by IS NULL;

-- Add SELECT policy for authenticated users on broadcasts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'broadcasts' AND policyname = 'Users can view broadcasts'
  ) THEN
    CREATE POLICY "Users can view broadcasts"
      ON public.broadcasts FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
