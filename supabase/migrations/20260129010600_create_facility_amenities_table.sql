-- =====================================================
-- Phase 1.2: Create Facility Amenities Table
-- =====================================================
-- Description: Amenity definitions that facilities can have
-- Date: 2026-01-29
-- =====================================================

-- Create facility_amenities table
CREATE TABLE IF NOT EXISTS public.facility_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT, -- Icon identifier for UI display
  category TEXT, -- Grouping: AV, Furniture, Technology, Accessibility
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS facility_amenities_name_idx ON public.facility_amenities(name);
CREATE INDEX IF NOT EXISTS facility_amenities_category_idx ON public.facility_amenities(category);
CREATE INDEX IF NOT EXISTS facility_amenities_is_active_idx ON public.facility_amenities(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.facility_amenities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active amenities
CREATE POLICY "Anyone can view active amenities"
  ON public.facility_amenities FOR SELECT
  USING (is_active = true);

-- Service role can manage amenities
CREATE POLICY "Service role can manage amenities"
  ON public.facility_amenities FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_facility_amenities_updated_at
  BEFORE UPDATE ON public.facility_amenities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default amenities
INSERT INTO public.facility_amenities (name, description, icon, category) VALUES
  -- Audio/Visual
  ('projector', 'LCD/LED Projector', 'videocam', 'AV'),
  ('screen', 'Projection Screen', 'tv', 'AV'),
  ('whiteboard', 'Whiteboard with markers', 'edit', 'AV'),
  ('smart_board', 'Interactive Smart Board', 'dashboard', 'AV'),
  ('sound_system', 'Audio/Sound System', 'volume_up', 'AV'),
  ('microphone', 'Microphone (wired/wireless)', 'mic', 'AV'),
  ('video_conferencing', 'Video Conferencing Equipment', 'video_call', 'AV'),

  -- Technology
  ('wifi', 'WiFi Connectivity', 'wifi', 'Technology'),
  ('computers', 'Desktop Computers', 'computer', 'Technology'),
  ('power_outlets', 'Power Outlets', 'power', 'Technology'),
  ('hdmi_connection', 'HDMI Connection', 'settings_input_hdmi', 'Technology'),
  ('lan_ports', 'Ethernet/LAN Ports', 'settings_ethernet', 'Technology'),

  -- Furniture
  ('tables', 'Tables (various sizes)', 'table_restaurant', 'Furniture'),
  ('chairs', 'Chairs', 'chair', 'Furniture'),
  ('podium', 'Podium/Lectern', 'podium', 'Furniture'),
  ('stage', 'Stage/Platform', 'stairs', 'Furniture'),
  ('storage', 'Storage Cabinets', 'inventory_2', 'Furniture'),

  -- Climate & Comfort
  ('air_conditioning', 'Air Conditioning', 'ac_unit', 'Climate'),
  ('ventilation', 'Proper Ventilation', 'air', 'Climate'),
  ('natural_lighting', 'Natural Lighting', 'wb_sunny', 'Climate'),
  ('blackout_curtains', 'Blackout Curtains', 'curtains', 'Climate'),

  -- Accessibility
  ('wheelchair_accessible', 'Wheelchair Accessible', 'accessible', 'Accessibility'),
  ('elevator_access', 'Elevator Access', 'elevator', 'Accessibility'),
  ('hearing_loop', 'Hearing Loop System', 'hearing', 'Accessibility'),

  -- Safety
  ('fire_extinguisher', 'Fire Extinguisher', 'fire_extinguisher', 'Safety'),
  ('emergency_exit', 'Emergency Exit', 'emergency', 'Safety'),
  ('first_aid', 'First Aid Kit', 'medical_services', 'Safety')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.facility_amenities IS 'Available amenities that can be associated with facilities';
COMMENT ON COLUMN public.facility_amenities.category IS 'Amenity category: AV, Technology, Furniture, Climate, Accessibility, Safety';
COMMENT ON COLUMN public.facility_amenities.icon IS 'Material icon identifier for UI display';
