-- =====================================================
-- Phase 1.2: Create Equipment Types Table
-- =====================================================
-- Description: Equipment categorization (projector, laptop, mic, speaker, etc.)
-- Date: 2026-01-30
-- =====================================================

-- Create equipment_types table
CREATE TABLE IF NOT EXISTS public.equipment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code TEXT UNIQUE NOT NULL, -- PROJECTOR, LAPTOP, MIC, SPEAKER, etc.
  type_name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Icon identifier for UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS equipment_types_type_code_idx ON public.equipment_types(type_code);
CREATE INDEX IF NOT EXISTS equipment_types_is_active_idx ON public.equipment_types(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active equipment types"
  ON public.equipment_types FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage equipment types"
  ON public.equipment_types FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_equipment_types_updated_at
  BEFORE UPDATE ON public.equipment_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default equipment types
INSERT INTO public.equipment_types (type_code, type_name, description, icon) VALUES
  ('PROJECTOR', 'Projector', 'LCD/LED projector for presentations', 'videocam'),
  ('LAPTOP', 'Laptop', 'Portable computer for presentations and work', 'laptop'),
  ('MIC_WIRED', 'Wired Microphone', 'Wired microphone for audio', 'mic'),
  ('MIC_WIRELESS', 'Wireless Microphone', 'Wireless/handheld microphone', 'mic_none'),
  ('SPEAKER', 'Speaker', 'Portable speaker system', 'speaker'),
  ('WEBCAM', 'Webcam', 'External webcam for video conferencing', 'videocam'),
  ('HDMI_CABLE', 'HDMI Cable', 'HDMI cable for display connection', 'cable'),
  ('EXTENSION_CORD', 'Extension Cord', 'Power extension cord', 'power'),
  ('TRIPOD', 'Tripod', 'Camera/projector tripod stand', 'camera'),
  ('POINTER', 'Laser Pointer', 'Presentation laser pointer', 'highlight'),
  ('CLICKER', 'Presentation Clicker', 'Wireless presentation remote', 'touch_app'),
  ('WHITEBOARD_MARKER', 'Whiteboard Markers', 'Set of whiteboard markers', 'edit'),
  ('FLIP_CHART', 'Flip Chart Stand', 'Portable flip chart stand with paper', 'note'),
  ('PA_SYSTEM', 'PA System', 'Public address system', 'campaign')
ON CONFLICT (type_code) DO UPDATE SET
  type_name = EXCLUDED.type_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.equipment_types IS 'Categories of equipment available for booking';
COMMENT ON COLUMN public.equipment_types.type_code IS 'Unique equipment type identifier';
