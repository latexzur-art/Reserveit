-- =====================================================
-- Phase 1.2: Create Facilities Table
-- =====================================================
-- Description: Main facility records (52 facilities as per plan)
-- Date: 2026-01-29
-- =====================================================

-- Create facilities table
CREATE TABLE IF NOT EXISTS public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  floor_id UUID NOT NULL REFERENCES public.floors(id) ON DELETE RESTRICT,
  facility_type_id UUID NOT NULL REFERENCES public.facility_types(id) ON DELETE RESTRICT,
  capacity INTEGER NOT NULL DEFAULT 0,
  area_sqm DECIMAL(10, 2), -- Area in square meters
  room_number TEXT,
  image_url TEXT,

  -- Booking settings
  is_bookable BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT true,
  min_booking_duration INTEGER DEFAULT 30, -- Minutes
  max_booking_duration INTEGER DEFAULT 240, -- Minutes (4 hours default)
  advance_booking_days INTEGER DEFAULT 14, -- How far in advance can book
  buffer_time INTEGER DEFAULT 15, -- Minutes between bookings

  -- Rental settings (for external clients)
  is_available_for_rental BOOLEAN DEFAULT false,
  hourly_rate DECIMAL(10, 2),
  half_day_rate DECIMAL(10, 2),
  full_day_rate DECIMAL(10, 2),

  -- Status
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'unavailable', 'reserved')),
  maintenance_notes TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance (as specified in Phase 1.4)
CREATE INDEX IF NOT EXISTS facilities_code_idx ON public.facilities(code);
CREATE INDEX IF NOT EXISTS facilities_name_idx ON public.facilities(name);
CREATE INDEX IF NOT EXISTS facilities_floor_id_idx ON public.facilities(floor_id);
CREATE INDEX IF NOT EXISTS facilities_facility_type_id_idx ON public.facilities(facility_type_id);
CREATE INDEX IF NOT EXISTS facilities_status_idx ON public.facilities(status);
CREATE INDEX IF NOT EXISTS facilities_is_active_idx ON public.facilities(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS facilities_is_bookable_idx ON public.facilities(is_bookable) WHERE is_bookable = true;
CREATE INDEX IF NOT EXISTS facilities_floor_active_idx ON public.facilities(floor_id, is_active);

-- Enable Row Level Security
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active facilities
CREATE POLICY "Anyone can view active facilities"
  ON public.facilities FOR SELECT
  USING (is_active = true);

-- Authenticated users can view all facilities (including inactive for admins)
CREATE POLICY "Authenticated users can view all facilities"
  ON public.facilities FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage facilities
CREATE POLICY "Service role can manage facilities"
  ON public.facilities FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample facilities (representative sample, expand as needed)
-- This creates facilities across all 5 floors
DO $$
DECLARE
  floor_1_id UUID;
  floor_2_id UUID;
  floor_3_id UUID;
  floor_4_id UUID;
  floor_5_id UUID;
  type_classroom UUID;
  type_computer_lab UUID;
  type_science_lab UUID;
  type_auditorium UUID;
  type_conference UUID;
  type_multipurpose UUID;
  type_library UUID;
BEGIN
  -- Get floor IDs
  SELECT id INTO floor_1_id FROM public.floors WHERE floor_number = 1 LIMIT 1;
  SELECT id INTO floor_2_id FROM public.floors WHERE floor_number = 2 LIMIT 1;
  SELECT id INTO floor_3_id FROM public.floors WHERE floor_number = 3 LIMIT 1;
  SELECT id INTO floor_4_id FROM public.floors WHERE floor_number = 4 LIMIT 1;
  SELECT id INTO floor_5_id FROM public.floors WHERE floor_number = 5 LIMIT 1;

  -- Get facility type IDs
  SELECT id INTO type_classroom FROM public.facility_types WHERE name = 'classroom' LIMIT 1;
  SELECT id INTO type_computer_lab FROM public.facility_types WHERE name = 'computer_lab' LIMIT 1;
  SELECT id INTO type_science_lab FROM public.facility_types WHERE name = 'science_lab' LIMIT 1;
  SELECT id INTO type_auditorium FROM public.facility_types WHERE name = 'auditorium' LIMIT 1;
  SELECT id INTO type_conference FROM public.facility_types WHERE name = 'conference_room' LIMIT 1;
  SELECT id INTO type_multipurpose FROM public.facility_types WHERE name = 'multipurpose_hall' LIMIT 1;
  SELECT id INTO type_library FROM public.facility_types WHERE name = 'library_room' LIMIT 1;

  -- Insert facilities if all references exist
  IF floor_1_id IS NOT NULL AND type_classroom IS NOT NULL THEN

    -- GROUND FLOOR (Floor 1) - Admin & Services
    INSERT INTO public.facilities (code, name, description, floor_id, facility_type_id, capacity, room_number, requires_approval)
    VALUES
      ('GF-CR-101', 'Conference Room A', 'Main conference room for meetings', floor_1_id, type_conference, 20, '101', true),
      ('GF-CR-102', 'Conference Room B', 'Secondary conference room', floor_1_id, type_conference, 15, '102', true),
      ('GF-LIB-103', 'Library Study Room 1', 'Small group study room', floor_1_id, type_library, 8, '103', false),
      ('GF-LIB-104', 'Library Study Room 2', 'Small group study room', floor_1_id, type_library, 8, '104', false)
    ON CONFLICT (code) DO NOTHING;

    -- 2ND FLOOR - Classrooms
    INSERT INTO public.facilities (code, name, description, floor_id, facility_type_id, capacity, room_number, requires_approval)
    VALUES
      ('2F-RM-201', 'Room 201', 'Standard classroom', floor_2_id, type_classroom, 40, '201', false),
      ('2F-RM-202', 'Room 202', 'Standard classroom', floor_2_id, type_classroom, 40, '202', false),
      ('2F-RM-203', 'Room 203', 'Standard classroom', floor_2_id, type_classroom, 40, '203', false),
      ('2F-RM-204', 'Room 204', 'Standard classroom', floor_2_id, type_classroom, 40, '204', false),
      ('2F-RM-205', 'Room 205', 'Standard classroom', floor_2_id, type_classroom, 40, '205', false),
      ('2F-RM-206', 'Room 206', 'Standard classroom', floor_2_id, type_classroom, 40, '206', false),
      ('2F-RM-207', 'Room 207', 'Standard classroom', floor_2_id, type_classroom, 40, '207', false),
      ('2F-RM-208', 'Room 208', 'Standard classroom', floor_2_id, type_classroom, 40, '208', false),
      ('2F-RM-209', 'Room 209', 'Large classroom', floor_2_id, type_classroom, 60, '209', false),
      ('2F-RM-210', 'Room 210', 'Large classroom', floor_2_id, type_classroom, 60, '210', false)
    ON CONFLICT (code) DO NOTHING;

    -- 3RD FLOOR - Computer Labs
    INSERT INTO public.facilities (code, name, description, floor_id, facility_type_id, capacity, room_number, requires_approval)
    VALUES
      ('3F-CL-301', 'Computer Lab 1', 'General purpose computer laboratory', floor_3_id, type_computer_lab, 35, '301', true),
      ('3F-CL-302', 'Computer Lab 2', 'Programming laboratory', floor_3_id, type_computer_lab, 35, '302', true),
      ('3F-CL-303', 'Computer Lab 3', 'Networking laboratory', floor_3_id, type_computer_lab, 30, '303', true),
      ('3F-CL-304', 'Computer Lab 4', 'Multimedia laboratory', floor_3_id, type_computer_lab, 30, '304', true),
      ('3F-CL-305', 'Computer Lab 5', 'Software development lab', floor_3_id, type_computer_lab, 35, '305', true),
      ('3F-CL-306', 'Computer Lab 6', 'Database laboratory', floor_3_id, type_computer_lab, 30, '306', true),
      ('3F-RM-307', 'Room 307', 'IT Classroom', floor_3_id, type_classroom, 40, '307', false),
      ('3F-RM-308', 'Room 308', 'IT Classroom', floor_3_id, type_classroom, 40, '308', false)
    ON CONFLICT (code) DO NOTHING;

    -- 4TH FLOOR - Science Labs & Specialized Rooms
    INSERT INTO public.facilities (code, name, description, floor_id, facility_type_id, capacity, room_number, requires_approval)
    VALUES
      ('4F-SL-401', 'Science Lab 1', 'Physics laboratory', floor_4_id, type_science_lab, 25, '401', true),
      ('4F-SL-402', 'Science Lab 2', 'Chemistry laboratory', floor_4_id, type_science_lab, 25, '402', true),
      ('4F-SL-403', 'Science Lab 3', 'Biology laboratory', floor_4_id, type_science_lab, 25, '403', true),
      ('4F-RM-404', 'Room 404', 'Science classroom', floor_4_id, type_classroom, 40, '404', false),
      ('4F-RM-405', 'Room 405', 'Science classroom', floor_4_id, type_classroom, 40, '405', false),
      ('4F-RM-406', 'Room 406', 'Classroom', floor_4_id, type_classroom, 40, '406', false),
      ('4F-RM-407', 'Room 407', 'Classroom', floor_4_id, type_classroom, 40, '407', false),
      ('4F-RM-408', 'Room 408', 'Classroom', floor_4_id, type_classroom, 40, '408', false)
    ON CONFLICT (code) DO NOTHING;

    -- 5TH FLOOR - Auditorium & Large Venues
    INSERT INTO public.facilities (code, name, description, floor_id, facility_type_id, capacity, room_number, requires_approval, is_available_for_rental, hourly_rate, half_day_rate, full_day_rate)
    VALUES
      ('5F-AUD-501', 'Main Auditorium', 'Large auditorium for major events and ceremonies', floor_5_id, type_auditorium, 300, '501', true, true, 2500.00, 8000.00, 15000.00),
      ('5F-MPH-502', 'Multipurpose Hall A', 'Large multipurpose hall', floor_5_id, type_multipurpose, 150, '502', true, true, 1500.00, 5000.00, 9000.00),
      ('5F-MPH-503', 'Multipurpose Hall B', 'Medium multipurpose hall', floor_5_id, type_multipurpose, 100, '503', true, true, 1000.00, 3500.00, 6000.00),
      ('5F-CR-504', 'Executive Conference Room', 'Premium conference room', floor_5_id, type_conference, 25, '504', true, false, NULL, NULL, NULL),
      ('5F-RM-505', 'Room 505', 'Training room', floor_5_id, type_classroom, 50, '505', false, false, NULL, NULL, NULL),
      ('5F-RM-506', 'Room 506', 'Seminar room', floor_5_id, type_classroom, 50, '506', false, false, NULL, NULL, NULL)
    ON CONFLICT (code) DO NOTHING;

  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.facilities IS 'Main facility records for booking system (52 facilities across 5 floors)';
COMMENT ON COLUMN public.facilities.code IS 'Unique facility code (format: FLOOR-TYPE-NUMBER)';
COMMENT ON COLUMN public.facilities.buffer_time IS 'Minutes required between consecutive bookings';
COMMENT ON COLUMN public.facilities.advance_booking_days IS 'How many days in advance the facility can be booked';
COMMENT ON COLUMN public.facilities.status IS 'Current facility status: available, maintenance, unavailable, reserved';
