-- =====================================================
-- Phase 1.2: Create Equipment Table
-- =====================================================
-- Description: Equipment inventory with status tracking
-- Date: 2026-01-30
-- =====================================================

-- Create equipment table
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_code TEXT UNIQUE NOT NULL, -- e.g., PROJ-001, LAP-015
  equipment_name TEXT NOT NULL,
  equipment_type_id UUID NOT NULL REFERENCES public.equipment_types(id) ON DELETE RESTRICT,
  current_status_id UUID NOT NULL REFERENCES public.equipment_status_types(id) ON DELETE RESTRICT,
  assigned_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL, -- If permanently assigned
  serial_number TEXT,
  brand TEXT,
  model TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  notes TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS equipment_code_idx ON public.equipment(equipment_code);
CREATE INDEX IF NOT EXISTS equipment_type_id_idx ON public.equipment(equipment_type_id);
CREATE INDEX IF NOT EXISTS equipment_current_status_id_idx ON public.equipment(current_status_id);
CREATE INDEX IF NOT EXISTS equipment_assigned_facility_id_idx ON public.equipment(assigned_facility_id);
CREATE INDEX IF NOT EXISTS equipment_is_active_idx ON public.equipment(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active equipment"
  ON public.equipment FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all equipment"
  ON public.equipment FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage equipment"
  ON public.equipment FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample equipment
DO $$
DECLARE
  type_projector UUID;
  type_laptop UUID;
  type_mic_wireless UUID;
  type_speaker UUID;
  type_hdmi UUID;
  status_available UUID;
BEGIN
  -- Get type IDs
  SELECT id INTO type_projector FROM public.equipment_types WHERE type_code = 'PROJECTOR';
  SELECT id INTO type_laptop FROM public.equipment_types WHERE type_code = 'LAPTOP';
  SELECT id INTO type_mic_wireless FROM public.equipment_types WHERE type_code = 'MIC_WIRELESS';
  SELECT id INTO type_speaker FROM public.equipment_types WHERE type_code = 'SPEAKER';
  SELECT id INTO type_hdmi FROM public.equipment_types WHERE type_code = 'HDMI_CABLE';
  SELECT id INTO status_available FROM public.equipment_status_types WHERE status_code = 'AVAILABLE';

  IF type_projector IS NOT NULL AND status_available IS NOT NULL THEN
    -- Projectors
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('PROJ-001', 'Projector Unit 1', type_projector, status_available, 'Epson', 'EB-X51'),
      ('PROJ-002', 'Projector Unit 2', type_projector, status_available, 'Epson', 'EB-X51'),
      ('PROJ-003', 'Projector Unit 3', type_projector, status_available, 'BenQ', 'MX550'),
      ('PROJ-004', 'Projector Unit 4', type_projector, status_available, 'BenQ', 'MX550'),
      ('PROJ-005', 'Projector Unit 5', type_projector, status_available, 'Epson', 'EB-E10')
    ON CONFLICT (equipment_code) DO NOTHING;

    -- Laptops
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('LAP-001', 'Presentation Laptop 1', type_laptop, status_available, 'Lenovo', 'ThinkPad E14'),
      ('LAP-002', 'Presentation Laptop 2', type_laptop, status_available, 'Lenovo', 'ThinkPad E14'),
      ('LAP-003', 'Presentation Laptop 3', type_laptop, status_available, 'HP', 'ProBook 450'),
      ('LAP-004', 'Presentation Laptop 4', type_laptop, status_available, 'HP', 'ProBook 450'),
      ('LAP-005', 'Presentation Laptop 5', type_laptop, status_available, 'Dell', 'Latitude 3520')
    ON CONFLICT (equipment_code) DO NOTHING;

    -- Wireless Microphones
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('MIC-001', 'Wireless Mic Set 1', type_mic_wireless, status_available, 'Shure', 'BLX24'),
      ('MIC-002', 'Wireless Mic Set 2', type_mic_wireless, status_available, 'Shure', 'BLX24'),
      ('MIC-003', 'Wireless Mic Set 3', type_mic_wireless, status_available, 'Sennheiser', 'XSW 1'),
      ('MIC-004', 'Wireless Mic Set 4', type_mic_wireless, status_available, 'Sennheiser', 'XSW 1')
    ON CONFLICT (equipment_code) DO NOTHING;

    -- Speakers
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand, model) VALUES
      ('SPK-001', 'Portable Speaker 1', type_speaker, status_available, 'JBL', 'PartyBox 110'),
      ('SPK-002', 'Portable Speaker 2', type_speaker, status_available, 'JBL', 'PartyBox 110'),
      ('SPK-003', 'Portable Speaker 3', type_speaker, status_available, 'Bose', 'S1 Pro')
    ON CONFLICT (equipment_code) DO NOTHING;

    -- HDMI Cables
    INSERT INTO public.equipment (equipment_code, equipment_name, equipment_type_id, current_status_id, brand) VALUES
      ('HDMI-001', 'HDMI Cable 3m', type_hdmi, status_available, 'Generic'),
      ('HDMI-002', 'HDMI Cable 3m', type_hdmi, status_available, 'Generic'),
      ('HDMI-003', 'HDMI Cable 5m', type_hdmi, status_available, 'Generic'),
      ('HDMI-004', 'HDMI Cable 5m', type_hdmi, status_available, 'Generic'),
      ('HDMI-005', 'HDMI Cable 10m', type_hdmi, status_available, 'Generic')
    ON CONFLICT (equipment_code) DO NOTHING;
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.equipment IS 'Equipment inventory for booking system';
COMMENT ON COLUMN public.equipment.equipment_code IS 'Unique equipment identifier (e.g., PROJ-001)';
COMMENT ON COLUMN public.equipment.assigned_facility_id IS 'If equipment is permanently assigned to a facility';
