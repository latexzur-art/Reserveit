-- =====================================================
-- Phase 1.2: Create Time Slots Table
-- =====================================================
-- Description: Predefined time slot definitions
-- Date: 2026-01-30
-- =====================================================

-- Create time_slots table
CREATE TABLE IF NOT EXISTS public.time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_code TEXT UNIQUE NOT NULL, -- e.g., SLOT-1, SLOT-2
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_label TEXT NOT NULL, -- e.g., "7:00 AM - 8:30 AM"
  duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure end_time is after start_time
  CONSTRAINT time_slots_valid_times CHECK (end_time > start_time)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS time_slots_slot_code_idx ON public.time_slots(slot_code);
CREATE INDEX IF NOT EXISTS time_slots_is_active_idx ON public.time_slots(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS time_slots_sort_order_idx ON public.time_slots(sort_order);

-- Enable Row Level Security
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active time slots"
  ON public.time_slots FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage time slots"
  ON public.time_slots FOR ALL
  USING (auth.role() = 'service_role');

-- Insert default time slots (typical academic schedule)
INSERT INTO public.time_slots (slot_code, start_time, end_time, slot_label, sort_order) VALUES
  ('SLOT-01', '07:00', '08:30', '7:00 AM - 8:30 AM', 1),
  ('SLOT-02', '08:30', '10:00', '8:30 AM - 10:00 AM', 2),
  ('SLOT-03', '10:00', '11:30', '10:00 AM - 11:30 AM', 3),
  ('SLOT-04', '11:30', '13:00', '11:30 AM - 1:00 PM', 4),
  ('SLOT-05', '13:00', '14:30', '1:00 PM - 2:30 PM', 5),
  ('SLOT-06', '14:30', '16:00', '2:30 PM - 4:00 PM', 6),
  ('SLOT-07', '16:00', '17:30', '4:00 PM - 5:30 PM', 7),
  ('SLOT-08', '17:30', '19:00', '5:30 PM - 7:00 PM', 8),
  ('SLOT-09', '19:00', '20:30', '7:00 PM - 8:30 PM', 9),
  -- Half-day slots
  ('SLOT-AM', '07:00', '12:00', '7:00 AM - 12:00 PM (Morning)', 10),
  ('SLOT-PM', '13:00', '18:00', '1:00 PM - 6:00 PM (Afternoon)', 11),
  -- Full-day slot
  ('SLOT-FD', '07:00', '21:00', '7:00 AM - 9:00 PM (Full Day)', 12)
ON CONFLICT (slot_code) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  slot_label = EXCLUDED.slot_label,
  sort_order = EXCLUDED.sort_order;

-- Add comments
COMMENT ON TABLE public.time_slots IS 'Predefined booking time slots';
COMMENT ON COLUMN public.time_slots.slot_label IS 'Human-readable time slot description';
COMMENT ON COLUMN public.time_slots.duration_minutes IS 'Auto-calculated duration in minutes';
