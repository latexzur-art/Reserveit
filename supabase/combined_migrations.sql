-- =====================================================
-- Phase 1.2: Utility Functions
-- =====================================================
-- Description: Create reusable utility functions for the database
-- Date: 2026-01-29
-- =====================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment on function
COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to automatically update updated_at timestamp on row update';
-- =====================================================
-- Phase 1.2: Create Roles Table
-- =====================================================
-- Description: Role definitions for access control
-- Roles: Building Admin, Faculty, Program Head, Academic Head, External Client
-- Date: 2026-01-29
-- =====================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS roles_name_idx ON public.roles(name);
CREATE INDEX IF NOT EXISTS roles_is_active_idx ON public.roles(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active roles
CREATE POLICY "Anyone can view active roles"
  ON public.roles FOR SELECT
  USING (is_active = true);

-- Only service role can modify roles (backend operations)
CREATE POLICY "Service role can manage roles"
  ON public.roles FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO public.roles (name, description, permissions) VALUES
  ('building_admin', 'Building Administrator - Full system access for facility and booking management',
   '{"facilities": ["create", "read", "update", "delete"], "bookings": ["create", "read", "update", "delete", "approve"], "users": ["read", "update"], "equipment": ["create", "read", "update", "delete"], "reports": ["read"]}'),
  ('faculty', 'Faculty Member - Can create and manage own facility bookings',
   '{"facilities": ["read"], "bookings": ["create", "read", "update", "delete"], "equipment": ["read"]}'),
  ('program_head', 'Program Head - Can approve bookings within their department',
   '{"facilities": ["read"], "bookings": ["create", "read", "update", "delete", "approve_department"], "equipment": ["read"], "users": ["read_department"]}'),
  ('academic_head', 'Academic Head - Final approval authority for all academic bookings',
   '{"facilities": ["read"], "bookings": ["create", "read", "update", "delete", "approve_all"], "equipment": ["read"], "users": ["read"]}'),
  ('external_client', 'External Client - Limited access for external facility rentals',
   '{"facilities": ["read"], "bookings": ["create", "read"], "equipment": ["read"]}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.roles IS 'User role definitions for ReserveIt access control system';
COMMENT ON COLUMN public.roles.name IS 'Unique role identifier (building_admin, faculty, program_head, academic_head, external_client)';
COMMENT ON COLUMN public.roles.permissions IS 'JSON object defining CRUD permissions for each resource';
-- =====================================================
-- Phase 1.2: Create Departments Table
-- =====================================================
-- Description: Academic departments/programs at STI
-- Date: 2026-01-29
-- =====================================================

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  head_user_id UUID, -- Will reference users table (added later via FK)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS departments_code_idx ON public.departments(code);
CREATE INDEX IF NOT EXISTS departments_name_idx ON public.departments(name);
CREATE INDEX IF NOT EXISTS departments_is_active_idx ON public.departments(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active departments
CREATE POLICY "Anyone can view active departments"
  ON public.departments FOR SELECT
  USING (is_active = true);

-- Only service role can modify departments
CREATE POLICY "Service role can manage departments"
  ON public.departments FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample departments (adjust based on actual STI programs)
INSERT INTO public.departments (code, name, description) VALUES
  ('BSIT', 'Bachelor of Science in Information Technology', 'IT program focusing on software development and network administration'),
  ('BSCS', 'Bachelor of Science in Computer Science', 'CS program focusing on algorithms, AI, and theoretical computing'),
  ('BSHM', 'Bachelor of Science in Hospitality Management', 'Hospitality and tourism management program'),
  ('BSTM', 'Bachelor of Science in Tourism Management', 'Tourism industry and travel management program'),
  ('BSBA', 'Bachelor of Science in Business Administration', 'Business administration and management program'),
  ('ACT', 'Associate in Computer Technology', 'Two-year computer technology program'),
  ('SHS', 'Senior High School', 'Senior High School Department'),
  ('GEN', 'General Administration', 'Administrative and support departments')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.departments IS 'Academic departments and programs at STI';
COMMENT ON COLUMN public.departments.code IS 'Unique department code (e.g., BSIT, BSCS)';
COMMENT ON COLUMN public.departments.head_user_id IS 'Reference to the department head (foreign key added after users table creation)';
-- =====================================================
-- Phase 1.2: Create Users Table
-- =====================================================
-- Description: Core user profiles extending Supabase Auth
-- Date: 2026-01-29
-- =====================================================

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  phone TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_employee_id_idx ON public.users(employee_id);
CREATE INDEX IF NOT EXISTS users_department_id_idx ON public.users(department_id);
CREATE INDEX IF NOT EXISTS users_is_active_idx ON public.users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS users_full_name_idx ON public.users(full_name);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Authenticated users can view basic info of other active users
CREATE POLICY "Authenticated users can view active users"
  ON public.users FOR SELECT
  USING (
    auth.role() = 'authenticated' AND is_active = true
  );

-- Service role has full access
CREATE POLICY "Service role can manage users"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Now add the foreign key from departments.head_user_id to users
ALTER TABLE public.departments
  ADD CONSTRAINT departments_head_user_id_fkey
  FOREIGN KEY (head_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Function to handle new user signup (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email_confirmed_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comments
COMMENT ON TABLE public.users IS 'User profiles extending Supabase Auth for ReserveIt';
COMMENT ON COLUMN public.users.id IS 'References auth.users(id) - same UUID for consistency';
COMMENT ON COLUMN public.users.employee_id IS 'STI employee/student ID number';
COMMENT ON COLUMN public.users.department_id IS 'Primary department affiliation';
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile when new auth user signs up';
-- =====================================================
-- Phase 1.2: Create User Roles Junction Table
-- =====================================================
-- Description: Many-to-many relationship between users and roles
-- Date: 2026-01-29
-- =====================================================

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate role assignments
  UNIQUE(user_id, role_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS user_roles_is_active_idx ON public.user_roles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS user_roles_expires_at_idx ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can view roles of other users (for display purposes)
CREATE POLICY "Authenticated users can view user roles"
  ON public.user_roles FOR SELECT
  USING (
    auth.role() = 'authenticated' AND is_active = true
  );

-- Service role has full access (for role assignment by admins)
CREATE POLICY "Service role can manage user roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(user_uuid UUID, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid
      AND r.name = role_name
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(user_uuid UUID)
RETURNS TABLE(role_name TEXT, role_description TEXT, permissions JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT r.name, r.description, r.permissions
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid
    AND ur.is_active = true
    AND r.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.user_roles IS 'Junction table for many-to-many user-role assignments';
COMMENT ON COLUMN public.user_roles.assigned_by IS 'Admin user who assigned this role';
COMMENT ON COLUMN public.user_roles.expires_at IS 'Optional expiration date for temporary role assignments';
COMMENT ON FUNCTION public.user_has_role(UUID, TEXT) IS 'Check if a user has a specific role by role name';
COMMENT ON FUNCTION public.get_user_roles(UUID) IS 'Get all active roles for a user';
-- =====================================================
-- Phase 1.2: Create Facility Types Table
-- =====================================================
-- Description: Categorization of facilities (classroom, lab, auditorium, etc.)
-- Date: 2026-01-29
-- =====================================================

-- Create facility_types table
CREATE TABLE IF NOT EXISTS public.facility_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT, -- Icon identifier for UI display
  default_capacity INTEGER,
  requires_approval BOOLEAN DEFAULT true,
  booking_rules JSONB DEFAULT '{}', -- Rules like max duration, advance booking days
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS facility_types_name_idx ON public.facility_types(name);
CREATE INDEX IF NOT EXISTS facility_types_is_active_idx ON public.facility_types(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.facility_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active facility types
CREATE POLICY "Anyone can view active facility types"
  ON public.facility_types FOR SELECT
  USING (is_active = true);

-- Service role can manage facility types
CREATE POLICY "Service role can manage facility types"
  ON public.facility_types FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_facility_types_updated_at
  BEFORE UPDATE ON public.facility_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default facility types
INSERT INTO public.facility_types (name, description, icon, default_capacity, requires_approval, booking_rules) VALUES
  ('classroom', 'Standard classroom for lectures and discussions', 'school', 40, false,
   '{"max_duration_hours": 4, "advance_booking_days": 14, "min_notice_hours": 24}'),
  ('computer_lab', 'Computer laboratory with workstations', 'computer', 30, true,
   '{"max_duration_hours": 4, "advance_booking_days": 14, "min_notice_hours": 48, "requires_it_support": true}'),
  ('science_lab', 'Science laboratory for experiments', 'science', 25, true,
   '{"max_duration_hours": 3, "advance_booking_days": 14, "min_notice_hours": 48, "requires_lab_tech": true}'),
  ('auditorium', 'Large auditorium for events and presentations', 'theater_comedy', 200, true,
   '{"max_duration_hours": 8, "advance_booking_days": 30, "min_notice_hours": 72, "requires_av_support": true}'),
  ('conference_room', 'Meeting and conference room', 'groups', 20, true,
   '{"max_duration_hours": 4, "advance_booking_days": 7, "min_notice_hours": 24}'),
  ('multipurpose_hall', 'Flexible space for various activities', 'celebration', 150, true,
   '{"max_duration_hours": 8, "advance_booking_days": 21, "min_notice_hours": 48}'),
  ('library_room', 'Library study rooms', 'menu_book', 10, false,
   '{"max_duration_hours": 3, "advance_booking_days": 3, "min_notice_hours": 2}'),
  ('gym', 'Gymnasium and sports facility', 'fitness_center', 50, true,
   '{"max_duration_hours": 4, "advance_booking_days": 7, "min_notice_hours": 24}'),
  ('studio', 'Media/Recording studio', 'mic', 15, true,
   '{"max_duration_hours": 4, "advance_booking_days": 7, "min_notice_hours": 48, "requires_media_support": true}'),
  ('outdoor_area', 'Outdoor spaces and grounds', 'park', 100, true,
   '{"max_duration_hours": 8, "advance_booking_days": 14, "min_notice_hours": 72}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  default_capacity = EXCLUDED.default_capacity,
  requires_approval = EXCLUDED.requires_approval,
  booking_rules = EXCLUDED.booking_rules,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.facility_types IS 'Categories of facilities available for booking';
COMMENT ON COLUMN public.facility_types.icon IS 'Material icon identifier for UI display';
COMMENT ON COLUMN public.facility_types.booking_rules IS 'JSON object with booking constraints (max duration, advance days, notice period)';
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
-- =====================================================
-- Phase 1.2: Create Buildings Table
-- =====================================================
-- Description: Building registry for multi-building support
-- Date: 2026-01-29
-- =====================================================

-- Create buildings table
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  total_floors INTEGER DEFAULT 1,
  image_url TEXT,
  operating_hours JSONB DEFAULT '{"monday": {"open": "07:00", "close": "21:00"}, "tuesday": {"open": "07:00", "close": "21:00"}, "wednesday": {"open": "07:00", "close": "21:00"}, "thursday": {"open": "07:00", "close": "21:00"}, "friday": {"open": "07:00", "close": "21:00"}, "saturday": {"open": "08:00", "close": "17:00"}, "sunday": null}',
  contact_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS buildings_code_idx ON public.buildings(code);
CREATE INDEX IF NOT EXISTS buildings_name_idx ON public.buildings(name);
CREATE INDEX IF NOT EXISTS buildings_is_active_idx ON public.buildings(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active buildings
CREATE POLICY "Anyone can view active buildings"
  ON public.buildings FOR SELECT
  USING (is_active = true);

-- Service role can manage buildings
CREATE POLICY "Service role can manage buildings"
  ON public.buildings FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default building (STI Main Building)
INSERT INTO public.buildings (code, name, description, address, total_floors, operating_hours, contact_info) VALUES
  ('MAIN', 'STI Academic Center', 'Main academic building with classrooms, laboratories, and administrative offices',
   'STI College, Your City, Philippines', 5,
   '{"monday": {"open": "07:00", "close": "21:00"}, "tuesday": {"open": "07:00", "close": "21:00"}, "wednesday": {"open": "07:00", "close": "21:00"}, "thursday": {"open": "07:00", "close": "21:00"}, "friday": {"open": "07:00", "close": "21:00"}, "saturday": {"open": "08:00", "close": "17:00"}, "sunday": null}',
   '{"phone": "+63-XXX-XXX-XXXX", "email": "building@sti.edu.ph", "emergency": "+63-XXX-XXX-XXXX"}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  total_floors = EXCLUDED.total_floors,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.buildings IS 'Building registry for facility management';
COMMENT ON COLUMN public.buildings.code IS 'Unique building identifier code';
COMMENT ON COLUMN public.buildings.total_floors IS 'Number of floors in the building';
COMMENT ON COLUMN public.buildings.operating_hours IS 'JSON object with daily operating hours (null = closed)';
COMMENT ON COLUMN public.buildings.contact_info IS 'JSON object with building contact information';
-- =====================================================
-- Phase 1.2: Create Floors Table
-- =====================================================
-- Description: Floor definitions for each building (5 floors per plan)
-- Date: 2026-01-29
-- =====================================================

-- Create floors table
CREATE TABLE IF NOT EXISTS public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  floor_plan_url TEXT, -- URL to floor plan image
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each building can only have one entry per floor number
  UNIQUE(building_id, floor_number)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS floors_building_id_idx ON public.floors(building_id);
CREATE INDEX IF NOT EXISTS floors_floor_number_idx ON public.floors(floor_number);
CREATE INDEX IF NOT EXISTS floors_is_active_idx ON public.floors(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read active floors
CREATE POLICY "Anyone can view active floors"
  ON public.floors FOR SELECT
  USING (is_active = true);

-- Service role can manage floors
CREATE POLICY "Service role can manage floors"
  ON public.floors FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_floors_updated_at
  BEFORE UPDATE ON public.floors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default floors for main building (5 floors as per plan)
-- First, get the main building ID
DO $$
DECLARE
  main_building_id UUID;
BEGIN
  SELECT id INTO main_building_id FROM public.buildings WHERE code = 'MAIN';

  IF main_building_id IS NOT NULL THEN
    INSERT INTO public.floors (building_id, floor_number, name, description) VALUES
      (main_building_id, 1, 'Ground Floor', 'Main entrance, lobby, administrative offices, and general services'),
      (main_building_id, 2, '2nd Floor', 'Classrooms and lecture halls'),
      (main_building_id, 3, '3rd Floor', 'Computer laboratories and IT facilities'),
      (main_building_id, 4, '4th Floor', 'Science laboratories and specialized rooms'),
      (main_building_id, 5, '5th Floor', 'Auditorium, conference rooms, and multipurpose halls')
    ON CONFLICT (building_id, floor_number) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW();
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.floors IS 'Floor definitions within buildings';
COMMENT ON COLUMN public.floors.floor_number IS 'Floor number (1 = ground floor)';
COMMENT ON COLUMN public.floors.floor_plan_url IS 'URL to floor plan image for visual reference';
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
-- =====================================================
-- Phase 1.2: Create Facility Amenity Map Table
-- =====================================================
-- Description: Many-to-many relationship between facilities and amenities
-- Date: 2026-01-29
-- =====================================================

-- Create facility_amenity_map junction table
CREATE TABLE IF NOT EXISTS public.facility_amenity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  amenity_id UUID NOT NULL REFERENCES public.facility_amenities(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1, -- Number of this amenity in the facility
  notes TEXT, -- Additional notes about this amenity in this facility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate mappings
  UNIQUE(facility_id, amenity_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS facility_amenity_map_facility_id_idx ON public.facility_amenity_map(facility_id);
CREATE INDEX IF NOT EXISTS facility_amenity_map_amenity_id_idx ON public.facility_amenity_map(amenity_id);

-- Enable Row Level Security
ALTER TABLE public.facility_amenity_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read facility amenity mappings
CREATE POLICY "Anyone can view facility amenities"
  ON public.facility_amenity_map FOR SELECT
  USING (true);

-- Service role can manage mappings
CREATE POLICY "Service role can manage facility amenity mappings"
  ON public.facility_amenity_map FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_facility_amenity_map_updated_at
  BEFORE UPDATE ON public.facility_amenity_map
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Assign common amenities to facilities
-- This assigns standard amenities based on facility type
DO $$
DECLARE
  facility_record RECORD;
  amenity_projector UUID;
  amenity_screen UUID;
  amenity_whiteboard UUID;
  amenity_ac UUID;
  amenity_wifi UUID;
  amenity_chairs UUID;
  amenity_tables UUID;
  amenity_computers UUID;
  amenity_sound UUID;
  amenity_mic UUID;
  amenity_power UUID;
BEGIN
  -- Get amenity IDs
  SELECT id INTO amenity_projector FROM public.facility_amenities WHERE name = 'projector';
  SELECT id INTO amenity_screen FROM public.facility_amenities WHERE name = 'screen';
  SELECT id INTO amenity_whiteboard FROM public.facility_amenities WHERE name = 'whiteboard';
  SELECT id INTO amenity_ac FROM public.facility_amenities WHERE name = 'air_conditioning';
  SELECT id INTO amenity_wifi FROM public.facility_amenities WHERE name = 'wifi';
  SELECT id INTO amenity_chairs FROM public.facility_amenities WHERE name = 'chairs';
  SELECT id INTO amenity_tables FROM public.facility_amenities WHERE name = 'tables';
  SELECT id INTO amenity_computers FROM public.facility_amenities WHERE name = 'computers';
  SELECT id INTO amenity_sound FROM public.facility_amenities WHERE name = 'sound_system';
  SELECT id INTO amenity_mic FROM public.facility_amenities WHERE name = 'microphone';
  SELECT id INTO amenity_power FROM public.facility_amenities WHERE name = 'power_outlets';

  -- Loop through all facilities and assign appropriate amenities
  FOR facility_record IN SELECT f.id, f.code, f.capacity, ft.name as type_name
                         FROM public.facilities f
                         JOIN public.facility_types ft ON f.facility_type_id = ft.id
  LOOP
    -- All facilities get basic amenities
    INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
      (facility_record.id, amenity_ac, 1),
      (facility_record.id, amenity_wifi, 1),
      (facility_record.id, amenity_power, GREATEST(4, facility_record.capacity / 10))
    ON CONFLICT (facility_id, amenity_id) DO NOTHING;

    -- Classrooms get standard classroom amenities
    IF facility_record.type_name = 'classroom' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_screen, 1),
        (facility_record.id, amenity_whiteboard, 2),
        (facility_record.id, amenity_chairs, facility_record.capacity),
        (facility_record.id, amenity_tables, facility_record.capacity / 2)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Computer labs get computers
    IF facility_record.type_name = 'computer_lab' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_screen, 1),
        (facility_record.id, amenity_whiteboard, 1),
        (facility_record.id, amenity_computers, facility_record.capacity),
        (facility_record.id, amenity_chairs, facility_record.capacity)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Science labs
    IF facility_record.type_name = 'science_lab' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_whiteboard, 2),
        (facility_record.id, amenity_tables, facility_record.capacity / 2),
        (facility_record.id, amenity_chairs, facility_record.capacity)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Conference rooms
    IF facility_record.type_name = 'conference_room' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 1),
        (facility_record.id, amenity_screen, 1),
        (facility_record.id, amenity_whiteboard, 1),
        (facility_record.id, amenity_chairs, facility_record.capacity),
        (facility_record.id, amenity_tables, 1)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Auditoriums and multipurpose halls
    IF facility_record.type_name IN ('auditorium', 'multipurpose_hall') THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_projector, 2),
        (facility_record.id, amenity_screen, 2),
        (facility_record.id, amenity_sound, 1),
        (facility_record.id, amenity_mic, 4),
        (facility_record.id, amenity_chairs, facility_record.capacity)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

    -- Library rooms
    IF facility_record.type_name = 'library_room' THEN
      INSERT INTO public.facility_amenity_map (facility_id, amenity_id, quantity) VALUES
        (facility_record.id, amenity_whiteboard, 1),
        (facility_record.id, amenity_chairs, facility_record.capacity),
        (facility_record.id, amenity_tables, facility_record.capacity / 2)
      ON CONFLICT (facility_id, amenity_id) DO NOTHING;
    END IF;

  END LOOP;
END $$;

-- Helper function to get all amenities for a facility
CREATE OR REPLACE FUNCTION public.get_facility_amenities(facility_uuid UUID)
RETURNS TABLE(
  amenity_name TEXT,
  amenity_description TEXT,
  amenity_icon TEXT,
  amenity_category TEXT,
  quantity INTEGER,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fa.name,
    fa.description,
    fa.icon,
    fa.category,
    fam.quantity,
    fam.notes
  FROM public.facility_amenity_map fam
  JOIN public.facility_amenities fa ON fam.amenity_id = fa.id
  WHERE fam.facility_id = facility_uuid
    AND fa.is_active = true
  ORDER BY fa.category, fa.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.facility_amenity_map IS 'Junction table linking facilities to their available amenities';
COMMENT ON COLUMN public.facility_amenity_map.quantity IS 'Number of this amenity available in the facility';
COMMENT ON FUNCTION public.get_facility_amenities(UUID) IS 'Get all amenities for a specific facility';
-- =====================================================
-- Phase 1.2: Create Employee Registry Table
-- =====================================================
-- Description: Official STI employee roster for sign-up verification
-- Ensures only legitimate STI employees can register as Faculty
-- Date: 2026-01-30
-- =====================================================

-- Create employment status enum
DO $$ BEGIN
  CREATE TYPE employment_status AS ENUM ('active', 'resigned', 'on_leave');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create employee_registry table
CREATE TABLE IF NOT EXISTS public.employee_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL, -- Official STI employee number
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, -- School-issued email
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  position TEXT, -- Faculty, Staff, Program Head, etc.
  employment_status employment_status DEFAULT 'active',
  is_claimed BOOLEAN DEFAULT false, -- True when user registers
  claimed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP WITH TIME ZONE,
  date_added TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS employee_registry_employee_id_idx ON public.employee_registry(employee_id);
CREATE INDEX IF NOT EXISTS employee_registry_email_idx ON public.employee_registry(email);
CREATE INDEX IF NOT EXISTS employee_registry_department_id_idx ON public.employee_registry(department_id);
CREATE INDEX IF NOT EXISTS employee_registry_is_claimed_idx ON public.employee_registry(is_claimed);
CREATE INDEX IF NOT EXISTS employee_registry_employment_status_idx ON public.employee_registry(employment_status);

-- Enable Row Level Security
ALTER TABLE public.employee_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role has full access (admin operations)
CREATE POLICY "Service role can manage employee registry"
  ON public.employee_registry FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can check if email exists (for registration verification)
CREATE POLICY "Users can verify their own email"
  ON public.employee_registry FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Add trigger for updated_at
CREATE TRIGGER update_employee_registry_updated_at
  BEFORE UPDATE ON public.employee_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to verify and claim employee record during registration
CREATE OR REPLACE FUNCTION public.claim_employee_record(user_email TEXT, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  employee_record RECORD;
BEGIN
  -- Find unclaimed employee record with matching email
  SELECT * INTO employee_record
  FROM public.employee_registry
  WHERE email = user_email
    AND is_claimed = false
    AND employment_status = 'active';

  IF employee_record IS NULL THEN
    RETURN false;
  END IF;

  -- Claim the record
  UPDATE public.employee_registry
  SET is_claimed = true,
      claimed_by_user_id = user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = employee_record.id;

  -- Update user's department if employee has one
  IF employee_record.department_id IS NOT NULL THEN
    UPDATE public.users
    SET department_id = employee_record.department_id,
        employee_id = employee_record.employee_id,
        updated_at = NOW()
    WHERE id = user_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample employee records (for testing)
INSERT INTO public.employee_registry (employee_id, full_name, email, position, employment_status) VALUES
  ('EMP-001', 'Juan Dela Cruz', 'juan.delacruz@sti.edu.ph', 'Faculty', 'active'),
  ('EMP-002', 'Maria Santos', 'maria.santos@sti.edu.ph', 'Program Head', 'active'),
  ('EMP-003', 'Pedro Reyes', 'pedro.reyes@sti.edu.ph', 'Faculty', 'active'),
  ('EMP-004', 'Ana Garcia', 'ana.garcia@sti.edu.ph', 'Academic Head', 'active'),
  ('EMP-005', 'Jose Rizal', 'jose.rizal@sti.edu.ph', 'Building Admin', 'active')
ON CONFLICT (employee_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.employee_registry IS 'Official STI employee roster for sign-up verification';
COMMENT ON COLUMN public.employee_registry.employee_id IS 'Official STI employee number';
COMMENT ON COLUMN public.employee_registry.is_claimed IS 'True when an employee has registered and claimed their account';
COMMENT ON FUNCTION public.claim_employee_record(TEXT, UUID) IS 'Verify and claim employee record during user registration';
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
-- =====================================================
-- Phase 1.2: Create Equipment Status Types Table
-- =====================================================
-- Description: Lookup table for equipment statuses
-- Date: 2026-01-30
-- =====================================================

-- Create equipment_status_types table
CREATE TABLE IF NOT EXISTS public.equipment_status_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_code TEXT UNIQUE NOT NULL, -- AVAILABLE, IN_USE, BROKEN, MAINTENANCE
  status_name TEXT NOT NULL,
  description TEXT,
  is_bookable BOOLEAN DEFAULT true, -- False for BROKEN, MAINTENANCE
  color TEXT, -- For UI display (hex color or color name)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS equipment_status_types_status_code_idx ON public.equipment_status_types(status_code);
CREATE INDEX IF NOT EXISTS equipment_status_types_is_bookable_idx ON public.equipment_status_types(is_bookable);

-- Enable Row Level Security
ALTER TABLE public.equipment_status_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view equipment status types"
  ON public.equipment_status_types FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage equipment status types"
  ON public.equipment_status_types FOR ALL
  USING (auth.role() = 'service_role');

-- Insert default status types
INSERT INTO public.equipment_status_types (status_code, status_name, description, is_bookable, color, sort_order) VALUES
  ('AVAILABLE', 'Available', 'Equipment is available for booking', true, 'green', 1),
  ('IN_USE', 'In Use', 'Equipment is currently being used for a booking', false, 'blue', 2),
  ('RESERVED', 'Reserved', 'Equipment is reserved for an upcoming booking', false, 'orange', 3),
  ('MAINTENANCE', 'Under Maintenance', 'Equipment is being serviced or repaired', false, 'yellow', 4),
  ('BROKEN', 'Broken/Damaged', 'Equipment is non-functional and needs repair', false, 'red', 5),
  ('RETIRED', 'Retired', 'Equipment has been decommissioned', false, 'gray', 6)
ON CONFLICT (status_code) DO UPDATE SET
  status_name = EXCLUDED.status_name,
  description = EXCLUDED.description,
  is_bookable = EXCLUDED.is_bookable,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- Add comments
COMMENT ON TABLE public.equipment_status_types IS 'Lookup table for equipment availability statuses';
COMMENT ON COLUMN public.equipment_status_types.is_bookable IS 'Whether equipment with this status can be booked';
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
-- =====================================================
-- Phase 1.2: Create Equipment Status Log Table
-- =====================================================
-- Description: Audit trail for equipment state changes
-- Date: 2026-01-30
-- =====================================================

-- Create equipment_status_log table
CREATE TABLE IF NOT EXISTS public.equipment_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  previous_status_id UUID REFERENCES public.equipment_status_types(id) ON DELETE SET NULL,
  new_status_id UUID NOT NULL REFERENCES public.equipment_status_types(id) ON DELETE RESTRICT,
  changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT, -- Why status changed
  booking_id UUID, -- Will reference bookings table (FK added later)
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS equipment_status_log_equipment_id_idx ON public.equipment_status_log(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_status_log_changed_at_idx ON public.equipment_status_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS equipment_status_log_booking_id_idx ON public.equipment_status_log(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS equipment_status_log_changed_by_idx ON public.equipment_status_log(changed_by_user_id);

-- Enable Row Level Security
ALTER TABLE public.equipment_status_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view equipment status logs"
  ON public.equipment_status_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage equipment status logs"
  ON public.equipment_status_log FOR ALL
  USING (auth.role() = 'service_role');

-- Function to log equipment status change and update equipment
CREATE OR REPLACE FUNCTION public.update_equipment_status(
  p_equipment_id UUID,
  p_new_status_code TEXT,
  p_changed_by_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status_id UUID;
  v_new_status_id UUID;
BEGIN
  -- Get current status
  SELECT current_status_id INTO v_current_status_id
  FROM public.equipment
  WHERE id = p_equipment_id;

  IF v_current_status_id IS NULL THEN
    RAISE EXCEPTION 'Equipment not found';
  END IF;

  -- Get new status ID
  SELECT id INTO v_new_status_id
  FROM public.equipment_status_types
  WHERE status_code = p_new_status_code;

  IF v_new_status_id IS NULL THEN
    RAISE EXCEPTION 'Invalid status code: %', p_new_status_code;
  END IF;

  -- Don't log if status hasn't changed
  IF v_current_status_id = v_new_status_id THEN
    RETURN false;
  END IF;

  -- Log the status change
  INSERT INTO public.equipment_status_log (
    equipment_id,
    previous_status_id,
    new_status_id,
    changed_by_user_id,
    reason,
    booking_id
  ) VALUES (
    p_equipment_id,
    v_current_status_id,
    v_new_status_id,
    p_changed_by_user_id,
    p_reason,
    p_booking_id
  );

  -- Update equipment current status
  UPDATE public.equipment
  SET current_status_id = v_new_status_id,
      updated_at = NOW()
  WHERE id = p_equipment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get equipment status history
CREATE OR REPLACE FUNCTION public.get_equipment_status_history(p_equipment_id UUID)
RETURNS TABLE(
  changed_at TIMESTAMP WITH TIME ZONE,
  previous_status TEXT,
  new_status TEXT,
  changed_by TEXT,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    esl.changed_at,
    ps.status_name as previous_status,
    ns.status_name as new_status,
    COALESCE(u.full_name, 'System') as changed_by,
    esl.reason
  FROM public.equipment_status_log esl
  LEFT JOIN public.equipment_status_types ps ON esl.previous_status_id = ps.id
  JOIN public.equipment_status_types ns ON esl.new_status_id = ns.id
  LEFT JOIN public.users u ON esl.changed_by_user_id = u.id
  WHERE esl.equipment_id = p_equipment_id
  ORDER BY esl.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.equipment_status_log IS 'Audit trail for equipment status changes';
COMMENT ON COLUMN public.equipment_status_log.booking_id IS 'Related booking if status change is booking-related';
COMMENT ON FUNCTION public.update_equipment_status IS 'Update equipment status with automatic logging';
COMMENT ON FUNCTION public.get_equipment_status_history IS 'Get full status history for an equipment item';
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
-- =====================================================
-- Phase 1.2: Create Bookings Table
-- =====================================================
-- Description: Master booking records
-- Date: 2026-01-30
-- =====================================================

-- Create booking_type enum
DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM ('internal_free', 'internal_paid', 'external_paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create booking_status enum
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT UNIQUE NOT NULL, -- Auto-generated: BK-20250129-001
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  booking_type booking_type NOT NULL DEFAULT 'internal_free',
  booking_date DATE NOT NULL,
  time_slot_id UUID REFERENCES public.time_slots(id) ON DELETE SET NULL, -- If using predefined slots
  start_time TIME NOT NULL, -- Custom time support
  end_time TIME NOT NULL,
  purpose TEXT NOT NULL,
  event_name TEXT, -- Name of the event (optional)
  expected_attendees INTEGER,
  current_status booking_status NOT NULL DEFAULT 'pending',
  requires_payment BOOLEAN DEFAULT false,
  special_requests TEXT, -- Any special requirements
  internal_notes TEXT, -- Admin notes (not visible to user)
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure end_time is after start_time
  CONSTRAINT bookings_valid_times CHECK (end_time > start_time),
  -- Ensure booking_date is not in the past (optional, can be enforced in app)
  CONSTRAINT bookings_future_date CHECK (booking_date >= CURRENT_DATE)
);

-- Add indexes for performance (as specified in Phase 1.4)
CREATE INDEX IF NOT EXISTS bookings_booking_reference_idx ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_booking_date_idx ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS bookings_current_status_idx ON public.bookings(current_status);
CREATE INDEX IF NOT EXISTS bookings_user_created_idx ON public.bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_date_status_idx ON public.bookings(booking_date, current_status);
CREATE INDEX IF NOT EXISTS bookings_pending_idx ON public.bookings(current_status) WHERE current_status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create bookings
CREATE POLICY "Users can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending bookings
CREATE POLICY "Users can update own pending bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id AND current_status = 'pending')
  WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own pending/approved bookings
CREATE POLICY "Users can cancel own bookings"
  ON public.bookings FOR UPDATE
  USING (
    auth.uid() = user_id AND
    current_status IN ('pending', 'approved')
  );

-- Service role has full access
CREATE POLICY "Service role can manage bookings"
  ON public.bookings FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate booking reference number
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  sequence_num INTEGER;
  new_reference TEXT;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get the count of bookings created today + 1
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.bookings
  WHERE DATE(created_at) = CURRENT_DATE;

  new_reference := 'BK-' || today_date || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate booking reference
CREATE OR REPLACE FUNCTION public.set_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_reference IS NULL OR NEW.booking_reference = '' THEN
    NEW.booking_reference := public.generate_booking_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_booking_reference
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_reference();

-- Add foreign key from equipment_status_log to bookings
ALTER TABLE public.equipment_status_log
  ADD CONSTRAINT equipment_status_log_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON TABLE public.bookings IS 'Master booking records for facility reservations';
COMMENT ON COLUMN public.bookings.booking_reference IS 'Auto-generated reference number (BK-YYYYMMDD-NNN)';
COMMENT ON COLUMN public.bookings.booking_type IS 'internal_free: Faculty free booking, internal_paid: Staff paid (e.g., gym), external_paid: External client';
COMMENT ON COLUMN public.bookings.time_slot_id IS 'Reference to predefined time slot (optional if using custom times)';
-- =====================================================
-- Phase 1.2: Create Booking Facilities Table
-- =====================================================
-- Description: Booking-to-facility assignments (many-to-many)
-- Date: 2026-01-30
-- =====================================================

-- Create booking_facilities junction table
CREATE TABLE IF NOT EXISTS public.booking_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE RESTRICT,
  notes TEXT,
  setup_requirements TEXT, -- Special setup needs for this facility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate facility assignments per booking
  UNIQUE(booking_id, facility_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS booking_facilities_booking_id_idx ON public.booking_facilities(booking_id);
CREATE INDEX IF NOT EXISTS booking_facilities_facility_id_idx ON public.booking_facilities(facility_id);

-- Composite index for conflict detection queries
CREATE INDEX IF NOT EXISTS booking_facilities_facility_booking_idx ON public.booking_facilities(facility_id, booking_id);

-- Enable Row Level Security
ALTER TABLE public.booking_facilities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view facilities for their own bookings
CREATE POLICY "Users can view own booking facilities"
  ON public.booking_facilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

-- Authenticated users can view approved booking facilities (for availability checking)
CREATE POLICY "Authenticated users can view booked facilities"
  ON public.booking_facilities FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.current_status IN ('approved', 'completed')
    )
  );

-- Users can add facilities to their own pending bookings
CREATE POLICY "Users can add facilities to own pending bookings"
  ON public.booking_facilities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.user_id = auth.uid()
        AND b.current_status = 'pending'
    )
  );

-- Service role has full access
CREATE POLICY "Service role can manage booking facilities"
  ON public.booking_facilities FOR ALL
  USING (auth.role() = 'service_role');

-- Function to check facility conflicts
CREATE OR REPLACE FUNCTION public.check_facility_conflict(
  p_facility_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE(
  conflicting_booking_id UUID,
  booking_reference TEXT,
  conflict_start TIME,
  conflict_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as conflicting_booking_id,
    b.booking_reference,
    b.start_time as conflict_start,
    b.end_time as conflict_end
  FROM public.bookings b
  JOIN public.booking_facilities bf ON b.id = bf.booking_id
  WHERE bf.facility_id = p_facility_id
    AND b.booking_date = p_booking_date
    AND b.current_status IN ('pending', 'approved')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (
      -- Check for time overlap
      (p_start_time < b.end_time AND p_end_time > b.start_time)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available facilities for a given date/time
CREATE OR REPLACE FUNCTION public.get_available_facilities(
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_facility_type_id UUID DEFAULT NULL
)
RETURNS TABLE(
  facility_id UUID,
  facility_code TEXT,
  facility_name TEXT,
  capacity INTEGER,
  floor_name TEXT,
  building_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id as facility_id,
    f.code as facility_code,
    f.name as facility_name,
    f.capacity,
    fl.name as floor_name,
    b.name as building_name
  FROM public.facilities f
  JOIN public.floors fl ON f.floor_id = fl.id
  JOIN public.buildings b ON fl.building_id = b.id
  WHERE f.is_active = true
    AND f.is_bookable = true
    AND f.status = 'available'
    AND (p_facility_type_id IS NULL OR f.facility_type_id = p_facility_type_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.check_facility_conflict(f.id, p_booking_date, p_start_time, p_end_time)
    )
  ORDER BY b.name, fl.floor_number, f.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.booking_facilities IS 'Junction table linking bookings to facilities';
COMMENT ON FUNCTION public.check_facility_conflict IS 'Check if a facility has conflicting bookings for given date/time';
COMMENT ON FUNCTION public.get_available_facilities IS 'Get all available facilities for a given date and time range';
-- =====================================================
-- Phase 1.2: Create Booking Equipment Table
-- =====================================================
-- Description: Equipment requests per booking
-- Date: 2026-01-30
-- =====================================================

-- Create booking_equipment junction table
CREATE TABLE IF NOT EXISTS public.booking_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  quantity_requested INTEGER NOT NULL DEFAULT 1,
  quantity_approved INTEGER, -- Set when approved (may differ from requested)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate equipment assignments per booking
  UNIQUE(booking_id, equipment_id),
  -- Ensure positive quantities
  CONSTRAINT booking_equipment_positive_qty CHECK (quantity_requested > 0),
  CONSTRAINT booking_equipment_approved_qty CHECK (quantity_approved IS NULL OR quantity_approved >= 0)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS booking_equipment_booking_id_idx ON public.booking_equipment(booking_id);
CREATE INDEX IF NOT EXISTS booking_equipment_equipment_id_idx ON public.booking_equipment(equipment_id);

-- Enable Row Level Security
ALTER TABLE public.booking_equipment ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view equipment for their own bookings
CREATE POLICY "Users can view own booking equipment"
  ON public.booking_equipment FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

-- Authenticated users can view approved booking equipment
CREATE POLICY "Authenticated users can view booked equipment"
  ON public.booking_equipment FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.current_status IN ('approved', 'completed')
    )
  );

-- Users can add equipment to their own pending bookings
CREATE POLICY "Users can add equipment to own pending bookings"
  ON public.booking_equipment FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.user_id = auth.uid()
        AND b.current_status = 'pending'
    )
  );

-- Users can update equipment on their own pending bookings
CREATE POLICY "Users can update equipment on own pending bookings"
  ON public.booking_equipment FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.user_id = auth.uid()
        AND b.current_status = 'pending'
    )
  );

-- Service role has full access
CREATE POLICY "Service role can manage booking equipment"
  ON public.booking_equipment FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_booking_equipment_updated_at
  BEFORE UPDATE ON public.booking_equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check equipment availability
CREATE OR REPLACE FUNCTION public.check_equipment_availability(
  p_equipment_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_bookable BOOLEAN;
  v_conflict_count INTEGER;
BEGIN
  -- Check if equipment is in a bookable status
  SELECT est.is_bookable INTO v_is_bookable
  FROM public.equipment e
  JOIN public.equipment_status_types est ON e.current_status_id = est.id
  WHERE e.id = p_equipment_id AND e.is_active = true;

  IF v_is_bookable IS NULL OR NOT v_is_bookable THEN
    RETURN false;
  END IF;

  -- Check for conflicting bookings
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.bookings b
  JOIN public.booking_equipment be ON b.id = be.booking_id
  WHERE be.equipment_id = p_equipment_id
    AND b.booking_date = p_booking_date
    AND b.current_status IN ('pending', 'approved')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (p_start_time < b.end_time AND p_end_time > b.start_time);

  RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available equipment by type
CREATE OR REPLACE FUNCTION public.get_available_equipment(
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_equipment_type_id UUID DEFAULT NULL
)
RETURNS TABLE(
  equipment_id UUID,
  equipment_code TEXT,
  equipment_name TEXT,
  type_name TEXT,
  brand TEXT,
  model TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as equipment_id,
    e.equipment_code,
    e.equipment_name,
    et.type_name,
    e.brand,
    e.model
  FROM public.equipment e
  JOIN public.equipment_types et ON e.equipment_type_id = et.id
  JOIN public.equipment_status_types est ON e.current_status_id = est.id
  WHERE e.is_active = true
    AND est.is_bookable = true
    AND (p_equipment_type_id IS NULL OR e.equipment_type_id = p_equipment_type_id)
    AND public.check_equipment_availability(e.id, p_booking_date, p_start_time, p_end_time)
  ORDER BY et.type_name, e.equipment_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.booking_equipment IS 'Equipment requests linked to bookings';
COMMENT ON COLUMN public.booking_equipment.quantity_approved IS 'May differ from requested if not all available';
COMMENT ON FUNCTION public.check_equipment_availability IS 'Check if specific equipment is available for date/time';
COMMENT ON FUNCTION public.get_available_equipment IS 'Get all available equipment for a given date and time range';
-- =====================================================
-- Phase 1.2: Create Booking Status History Table
-- =====================================================
-- Description: Audit trail for booking status changes
-- Date: 2026-01-30
-- =====================================================

-- Create booking_status_history table
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  previous_status booking_status,
  new_status booking_status NOT NULL,
  changed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL if system/AI
  changed_by_ai BOOLEAN DEFAULT false,
  reason TEXT,
  metadata JSONB DEFAULT '{}', -- Additional context (e.g., AI confidence score)
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS booking_status_history_booking_id_idx ON public.booking_status_history(booking_id);
CREATE INDEX IF NOT EXISTS booking_status_history_changed_at_idx ON public.booking_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS booking_status_history_booking_created_idx ON public.booking_status_history(booking_id, changed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view history for their own bookings
CREATE POLICY "Users can view own booking history"
  ON public.booking_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = auth.uid()
    )
  );

-- Authenticated users can view history (for admin purposes)
CREATE POLICY "Authenticated users can view booking history"
  ON public.booking_status_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role has full access
CREATE POLICY "Service role can manage booking status history"
  ON public.booking_status_history FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update booking status with automatic history logging
CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id UUID,
  p_new_status booking_status,
  p_changed_by_user_id UUID DEFAULT NULL,
  p_changed_by_ai BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_status booking_status;
BEGIN
  -- Get current status
  SELECT current_status INTO v_current_status
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Don't log if status hasn't changed
  IF v_current_status = p_new_status THEN
    RETURN false;
  END IF;

  -- Log the status change
  INSERT INTO public.booking_status_history (
    booking_id,
    previous_status,
    new_status,
    changed_by_user_id,
    changed_by_ai,
    reason,
    metadata
  ) VALUES (
    p_booking_id,
    v_current_status,
    p_new_status,
    p_changed_by_user_id,
    p_changed_by_ai,
    p_reason,
    p_metadata
  );

  -- Update booking status and timestamp
  UPDATE public.bookings
  SET current_status = p_new_status,
      approved_at = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_at END,
      rejected_at = CASE WHEN p_new_status = 'rejected' THEN NOW() ELSE rejected_at END,
      cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
      completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log status changes on bookings table
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    INSERT INTO public.booking_status_history (
      booking_id,
      previous_status,
      new_status,
      changed_by_user_id,
      changed_by_ai,
      reason
    ) VALUES (
      NEW.id,
      OLD.current_status,
      NEW.current_status,
      NULL, -- Will be set via the update_booking_status function if needed
      false,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger is optional if using update_booking_status function
-- CREATE TRIGGER trigger_log_booking_status_change
--   AFTER UPDATE OF current_status ON public.bookings
--   FOR EACH ROW
--   EXECUTE FUNCTION public.log_booking_status_change();

-- Function to get booking status history
CREATE OR REPLACE FUNCTION public.get_booking_status_history(p_booking_id UUID)
RETURNS TABLE(
  changed_at TIMESTAMP WITH TIME ZONE,
  previous_status TEXT,
  new_status TEXT,
  changed_by TEXT,
  changed_by_ai BOOLEAN,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bsh.changed_at,
    bsh.previous_status::TEXT,
    bsh.new_status::TEXT,
    COALESCE(u.full_name, CASE WHEN bsh.changed_by_ai THEN 'AI System' ELSE 'System' END) as changed_by,
    bsh.changed_by_ai,
    bsh.reason
  FROM public.booking_status_history bsh
  LEFT JOIN public.users u ON bsh.changed_by_user_id = u.id
  WHERE bsh.booking_id = p_booking_id
  ORDER BY bsh.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.booking_status_history IS 'Audit trail for booking status changes';
COMMENT ON COLUMN public.booking_status_history.changed_by_ai IS 'True if status was changed by AI approval system';
COMMENT ON COLUMN public.booking_status_history.metadata IS 'Additional context like AI confidence score';
COMMENT ON FUNCTION public.update_booking_status IS 'Update booking status with automatic history logging';
COMMENT ON FUNCTION public.get_booking_status_history IS 'Get full status history for a booking';
-- =====================================================
-- Phase 1.2: Create Rental Rates Table
-- =====================================================
-- Description: Facility pricing for rentals with fee categories
-- Fee Types: Rental (AM/PM hourly), Energy (flat), Personnel (variable)
-- Date: 2026-01-30
-- =====================================================

-- Create fee_category enum
DO $$ BEGIN
  CREATE TYPE fee_category AS ENUM ('rental', 'energy', 'personnel');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create time_period enum for AM/PM pricing
DO $$ BEGIN
  CREATE TYPE time_period AS ENUM ('am', 'pm', 'all_day');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create rate_type enum
DO $$ BEGIN
  CREATE TYPE rate_type AS ENUM ('hourly', 'flat', 'variable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create rental_rates table
CREATE TABLE IF NOT EXISTS public.rental_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,

  -- Fee classification
  fee_category fee_category NOT NULL DEFAULT 'rental',
  rate_name TEXT NOT NULL, -- e.g., "AM Rental", "PM Rental", "Basic Sound", "LED Lights"
  rate_type rate_type NOT NULL DEFAULT 'hourly',
  time_period time_period DEFAULT 'all_day', -- AM (before 12pm), PM (12pm onwards)

  -- Pricing
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'PHP',

  -- Time constraints (for hourly rates)
  applicable_start_time TIME, -- e.g., 07:00 for AM rates
  applicable_end_time TIME,   -- e.g., 12:00 for AM rates

  -- Additional details
  description TEXT,
  is_required BOOLEAN DEFAULT false, -- true for base rental, false for add-ons
  is_addon BOOLEAN DEFAULT false, -- true for energy/personnel fees
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_until DATE, -- NULL means no end date

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT rental_rates_positive_amount CHECK (amount >= 0),
  CONSTRAINT rental_rates_valid_dates CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CONSTRAINT rental_rates_valid_time_range CHECK (
    (applicable_start_time IS NULL AND applicable_end_time IS NULL) OR
    (applicable_start_time IS NOT NULL AND applicable_end_time IS NOT NULL AND applicable_end_time > applicable_start_time)
  )
);

-- Add indexes
CREATE INDEX IF NOT EXISTS rental_rates_facility_id_idx ON public.rental_rates(facility_id);
CREATE INDEX IF NOT EXISTS rental_rates_fee_category_idx ON public.rental_rates(fee_category);
CREATE INDEX IF NOT EXISTS rental_rates_time_period_idx ON public.rental_rates(time_period);
CREATE INDEX IF NOT EXISTS rental_rates_rate_type_idx ON public.rental_rates(rate_type);
CREATE INDEX IF NOT EXISTS rental_rates_is_active_idx ON public.rental_rates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS rental_rates_is_addon_idx ON public.rental_rates(is_addon);
CREATE INDEX IF NOT EXISTS rental_rates_effective_idx ON public.rental_rates(effective_from, effective_until);

-- Enable Row Level Security
ALTER TABLE public.rental_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active rental rates"
  ON public.rental_rates FOR SELECT
  USING (is_active = true AND effective_from <= CURRENT_DATE AND (effective_until IS NULL OR effective_until >= CURRENT_DATE));

CREATE POLICY "Authenticated users can view all rental rates"
  ON public.rental_rates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage rental rates"
  ON public.rental_rates FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_rental_rates_updated_at
  BEFORE UPDATE ON public.rental_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default rental rates for rentable facilities
DO $$
DECLARE
  v_facility_id UUID;
BEGIN
  -- Get the Gym facility (or any rentable facility)
  SELECT id INTO v_facility_id
  FROM public.facilities
  WHERE is_available_for_rental = true
  LIMIT 1;

  IF v_facility_id IS NOT NULL THEN
    -- =====================================================
    -- RENTAL FEES (Base hourly rates)
    -- =====================================================

    -- AM Rate: ₱580/hour (7:00 AM - 12:00 PM)
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, applicable_start_time, applicable_end_time,
      description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'rental', 'AM Rental Rate', 'hourly', 'am',
      580.00, '07:00', '12:00',
      'Morning rental rate (7:00 AM - 12:00 PM)', true, false, 1
    ) ON CONFLICT DO NOTHING;

    -- PM Rate: ₱780/hour (12:00 PM - 9:00 PM)
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, applicable_start_time, applicable_end_time,
      description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'rental', 'PM Rental Rate', 'hourly', 'pm',
      780.00, '12:00', '21:00',
      'Afternoon/Evening rental rate (12:00 PM - 9:00 PM)', true, false, 2
    ) ON CONFLICT DO NOTHING;

    -- =====================================================
    -- ENERGY FEES (Optional add-ons - flat rates)
    -- =====================================================

    -- Basic Sound: ₱1,500 flat
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'energy', 'Basic Sound System', 'flat', 'all_day',
      1500.00, 'Basic sound system equipment and power usage', false, true, 10
    ) ON CONFLICT DO NOTHING;

    -- LED Lights: ₱2,500 flat
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'energy', 'LED Lights', 'flat', 'all_day',
      2500.00, 'LED lighting equipment and power usage', false, true, 11
    ) ON CONFLICT DO NOTHING;

    -- =====================================================
    -- PERSONNEL FEES (Variable based on staff)
    -- =====================================================

    -- Personnel: Variable (per staff member)
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'personnel', 'Staff Support (per person)', 'variable', 'all_day',
      0.00, 'Additional staff support - rate varies based on number and type of personnel requested', false, true, 20
    ) ON CONFLICT DO NOTHING;

  END IF;
END $$;

-- Function to get applicable rental rate based on time
CREATE OR REPLACE FUNCTION public.get_rental_rate(
  p_facility_id UUID,
  p_booking_time TIME
)
RETURNS TABLE(
  rate_id UUID,
  rate_name TEXT,
  rate_type rate_type,
  time_period time_period,
  amount DECIMAL,
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.id,
    rr.rate_name,
    rr.rate_type,
    rr.time_period,
    rr.amount,
    rr.currency
  FROM public.rental_rates rr
  WHERE rr.facility_id = p_facility_id
    AND rr.fee_category = 'rental'
    AND rr.is_active = true
    AND rr.effective_from <= CURRENT_DATE
    AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE)
    AND (
      (rr.applicable_start_time IS NULL AND rr.applicable_end_time IS NULL) OR
      (p_booking_time >= rr.applicable_start_time AND p_booking_time < rr.applicable_end_time)
    )
  ORDER BY rr.sort_order ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all addon fees for a facility
CREATE OR REPLACE FUNCTION public.get_addon_fees(
  p_facility_id UUID
)
RETURNS TABLE(
  rate_id UUID,
  fee_category fee_category,
  rate_name TEXT,
  rate_type rate_type,
  amount DECIMAL,
  currency TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.id,
    rr.fee_category,
    rr.rate_name,
    rr.rate_type,
    rr.amount,
    rr.currency,
    rr.description
  FROM public.rental_rates rr
  WHERE rr.facility_id = p_facility_id
    AND rr.is_addon = true
    AND rr.is_active = true
    AND rr.effective_from <= CURRENT_DATE
    AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE)
  ORDER BY rr.sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total rental cost
CREATE OR REPLACE FUNCTION public.calculate_rental_cost(
  p_facility_id UUID,
  p_start_time TIME,
  p_end_time TIME,
  p_addon_ids UUID[] DEFAULT '{}'
)
RETURNS TABLE(
  item_name TEXT,
  fee_category fee_category,
  rate_type rate_type,
  hours DECIMAL,
  unit_amount DECIMAL,
  subtotal DECIMAL,
  currency TEXT
) AS $$
DECLARE
  v_duration_hours DECIMAL;
  v_am_hours DECIMAL := 0;
  v_pm_hours DECIMAL := 0;
  v_noon TIME := '12:00';
BEGIN
  -- Calculate total duration
  v_duration_hours := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 3600;

  -- Calculate AM hours (before noon)
  IF p_start_time < v_noon THEN
    IF p_end_time <= v_noon THEN
      v_am_hours := v_duration_hours;
    ELSE
      v_am_hours := EXTRACT(EPOCH FROM (v_noon - p_start_time)) / 3600;
    END IF;
  END IF;

  -- Calculate PM hours (noon onwards)
  IF p_end_time > v_noon THEN
    IF p_start_time >= v_noon THEN
      v_pm_hours := v_duration_hours;
    ELSE
      v_pm_hours := EXTRACT(EPOCH FROM (p_end_time - v_noon)) / 3600;
    END IF;
  END IF;

  -- Return AM rental if applicable
  IF v_am_hours > 0 THEN
    RETURN QUERY
    SELECT
      rr.rate_name,
      rr.fee_category,
      rr.rate_type,
      v_am_hours,
      rr.amount,
      v_am_hours * rr.amount,
      rr.currency
    FROM public.rental_rates rr
    WHERE rr.facility_id = p_facility_id
      AND rr.fee_category = 'rental'
      AND rr.time_period = 'am'
      AND rr.is_active = true
      AND rr.effective_from <= CURRENT_DATE
      AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE);
  END IF;

  -- Return PM rental if applicable
  IF v_pm_hours > 0 THEN
    RETURN QUERY
    SELECT
      rr.rate_name,
      rr.fee_category,
      rr.rate_type,
      v_pm_hours,
      rr.amount,
      v_pm_hours * rr.amount,
      rr.currency
    FROM public.rental_rates rr
    WHERE rr.facility_id = p_facility_id
      AND rr.fee_category = 'rental'
      AND rr.time_period = 'pm'
      AND rr.is_active = true
      AND rr.effective_from <= CURRENT_DATE
      AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE);
  END IF;

  -- Return selected addon fees
  IF array_length(p_addon_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT
      rr.rate_name,
      rr.fee_category,
      rr.rate_type,
      1::DECIMAL AS hours,
      rr.amount,
      rr.amount AS subtotal,
      rr.currency
    FROM public.rental_rates rr
    WHERE rr.id = ANY(p_addon_ids)
      AND rr.facility_id = p_facility_id
      AND rr.is_addon = true
      AND rr.is_active = true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.rental_rates IS 'Facility rental pricing with fee categories (rental, energy, personnel)';
COMMENT ON COLUMN public.rental_rates.fee_category IS 'Fee type: rental (base), energy (equipment/power), personnel (staff)';
COMMENT ON COLUMN public.rental_rates.time_period IS 'Time period for rate: am (morning), pm (afternoon/evening), all_day';
COMMENT ON COLUMN public.rental_rates.rate_type IS 'Pricing type: hourly, flat, or variable';
COMMENT ON COLUMN public.rental_rates.is_addon IS 'True for optional add-on fees (energy, personnel)';
COMMENT ON COLUMN public.rental_rates.applicable_start_time IS 'Start time when this rate applies (for AM/PM rates)';
COMMENT ON COLUMN public.rental_rates.applicable_end_time IS 'End time when this rate applies (for AM/PM rates)';
COMMENT ON FUNCTION public.get_rental_rate IS 'Get applicable rental rate based on booking time';
COMMENT ON FUNCTION public.get_addon_fees IS 'Get all available addon fees for a facility';
COMMENT ON FUNCTION public.calculate_rental_cost IS 'Calculate total rental cost including AM/PM split and addons';
-- =====================================================
-- Phase 1.2: Create External Clients Table
-- =====================================================
-- Description: Non-STI client profiles for external facility rentals
-- Date: 2026-01-30
-- =====================================================

-- Create external_clients table
CREATE TABLE IF NOT EXISTS public.external_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Links to users table
  organization_name TEXT,
  organization_type TEXT, -- Company, Government, NGO, Individual, etc.
  contact_person TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,

  -- Verification documents
  valid_id_type TEXT, -- Government ID, Business Permit, etc.
  valid_id_number TEXT,
  valid_id_url TEXT, -- Uploaded ID storage path
  business_permit_url TEXT, -- For organizations
  other_documents_url TEXT[], -- Array of additional document URLs

  -- Verification status
  is_verified BOOLEAN DEFAULT false,
  verified_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_notes TEXT,

  -- Blacklist/trust status
  is_blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  blacklisted_at TIMESTAMP WITH TIME ZONE,
  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS external_clients_user_id_idx ON public.external_clients(user_id);
CREATE INDEX IF NOT EXISTS external_clients_organization_name_idx ON public.external_clients(organization_name);
CREATE INDEX IF NOT EXISTS external_clients_contact_email_idx ON public.external_clients(contact_email);
CREATE INDEX IF NOT EXISTS external_clients_is_verified_idx ON public.external_clients(is_verified);
CREATE INDEX IF NOT EXISTS external_clients_is_blacklisted_idx ON public.external_clients(is_blacklisted) WHERE is_blacklisted = true;

-- Enable Row Level Security
ALTER TABLE public.external_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view and update their own external client profile
CREATE POLICY "Users can view own external client profile"
  ON public.external_clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own external client profile"
  ON public.external_clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can create their own external client profile
CREATE POLICY "Users can create own external client profile"
  ON public.external_clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access (for admin verification)
CREATE POLICY "Service role can manage external clients"
  ON public.external_clients FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_external_clients_updated_at
  BEFORE UPDATE ON public.external_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to verify external client
CREATE OR REPLACE FUNCTION public.verify_external_client(
  p_client_id UUID,
  p_verified_by_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.external_clients
  SET is_verified = true,
      verified_by_user_id = p_verified_by_user_id,
      verified_at = NOW(),
      verification_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_client_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to blacklist external client
CREATE OR REPLACE FUNCTION public.blacklist_external_client(
  p_client_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.external_clients
  SET is_blacklisted = true,
      blacklist_reason = p_reason,
      blacklisted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_client_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a verified external client
CREATE OR REPLACE FUNCTION public.is_verified_external_client(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.external_clients
    WHERE user_id = p_user_id
      AND is_verified = true
      AND is_blacklisted = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.external_clients IS 'External (non-STI) client profiles for facility rentals';
COMMENT ON COLUMN public.external_clients.user_id IS 'Links to the users table - every external client has a user account';
COMMENT ON COLUMN public.external_clients.valid_id_url IS 'Storage path to uploaded valid ID document';
COMMENT ON COLUMN public.external_clients.trust_score IS 'Client trust score (0-100) based on booking history';
COMMENT ON FUNCTION public.verify_external_client IS 'Admin function to verify an external client';
COMMENT ON FUNCTION public.is_verified_external_client IS 'Check if a user is a verified external client';
-- =====================================================
-- Phase 1.2: Create Payments Table
-- =====================================================
-- Description: Payment records (PayMongo + Cashier)
-- Date: 2026-01-30
-- =====================================================

-- Create payment_method enum
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('paymongo_card', 'paymongo_gcash', 'paymongo_grab', 'paymongo_maya', 'cashier');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment_status enum
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference TEXT UNIQUE NOT NULL, -- Auto-generated: PAY-20250129-001
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- Amount details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'PHP',
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0)) STORED,

  -- Payment method and status
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',

  -- PayMongo specific fields
  paymongo_payment_id TEXT, -- PayMongo transaction ID
  paymongo_payment_intent_id TEXT,
  paymongo_checkout_url TEXT,
  paymongo_checkout_session_id TEXT,
  paymongo_source_id TEXT,
  paymongo_webhook_data JSONB, -- Store webhook payload for reference

  -- Cashier specific fields
  cashier_received_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin who received cash
  cashier_receipt_number TEXT,
  cashier_notes TEXT,

  -- Timestamps
  paid_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,

  -- Metadata
  description TEXT, -- Payment description
  metadata JSONB DEFAULT '{}', -- Additional data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT payments_positive_amount CHECK (amount > 0),
  CONSTRAINT payments_valid_refund CHECK (refund_amount IS NULL OR refund_amount <= total_amount)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS payments_payment_reference_idx ON public.payments(payment_reference);
CREATE INDEX IF NOT EXISTS payments_booking_id_idx ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_payment_status_idx ON public.payments(payment_status);
CREATE INDEX IF NOT EXISTS payments_payment_method_idx ON public.payments(payment_method);
CREATE INDEX IF NOT EXISTS payments_paymongo_payment_id_idx ON public.payments(paymongo_payment_id) WHERE paymongo_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_pending_idx ON public.payments(payment_status) WHERE payment_status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role can manage payments"
  ON public.payments FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate payment reference number
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  sequence_num INTEGER;
  new_reference TEXT;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get the count of payments created today + 1
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.payments
  WHERE DATE(created_at) = CURRENT_DATE;

  new_reference := 'PAY-' || today_date || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate payment reference
CREATE OR REPLACE FUNCTION public.set_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_reference IS NULL OR NEW.payment_reference = '' THEN
    NEW.payment_reference := public.generate_payment_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_payment_reference
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_reference();

-- Function to create a new payment
CREATE OR REPLACE FUNCTION public.create_payment(
  p_booking_id UUID,
  p_user_id UUID,
  p_amount DECIMAL,
  p_payment_method payment_method,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  INSERT INTO public.payments (
    booking_id,
    user_id,
    amount,
    payment_method,
    description
  ) VALUES (
    p_booking_id,
    p_user_id,
    p_amount,
    p_payment_method,
    p_description
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update payment status
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_payment_id UUID,
  p_new_status payment_status,
  p_paymongo_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.payments
  SET payment_status = p_new_status,
      paid_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE paid_at END,
      paymongo_webhook_data = COALESCE(p_paymongo_data, paymongo_webhook_data),
      updated_at = NOW()
  WHERE id = p_payment_id;

  -- If payment completed, update booking requires_payment to false
  IF p_new_status = 'completed' THEN
    UPDATE public.bookings
    SET requires_payment = false,
        updated_at = NOW()
    WHERE id = (SELECT booking_id FROM public.payments WHERE id = p_payment_id);
  END IF;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process cashier payment
CREATE OR REPLACE FUNCTION public.process_cashier_payment(
  p_payment_id UUID,
  p_cashier_user_id UUID,
  p_receipt_number TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.payments
  SET payment_status = 'completed',
      cashier_received_by = p_cashier_user_id,
      cashier_receipt_number = p_receipt_number,
      cashier_notes = p_notes,
      paid_at = NOW(),
      updated_at = NOW()
  WHERE id = p_payment_id
    AND payment_method = 'cashier'
    AND payment_status = 'pending';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update booking
  UPDATE public.bookings
  SET requires_payment = false,
      updated_at = NOW()
  WHERE id = (SELECT booking_id FROM public.payments WHERE id = p_payment_id);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process refund
CREATE OR REPLACE FUNCTION public.process_refund(
  p_payment_id UUID,
  p_refund_amount DECIMAL,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_total_amount DECIMAL;
BEGIN
  -- Get total amount
  SELECT total_amount INTO v_total_amount
  FROM public.payments
  WHERE id = p_payment_id AND payment_status = 'completed';

  IF v_total_amount IS NULL THEN
    RETURN false;
  END IF;

  IF p_refund_amount > v_total_amount THEN
    RAISE EXCEPTION 'Refund amount cannot exceed total payment amount';
  END IF;

  UPDATE public.payments
  SET payment_status = 'refunded',
      refunded_at = NOW(),
      refund_amount = p_refund_amount,
      refund_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_payment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.payments IS 'Payment records for booking transactions (PayMongo + Cashier)';
COMMENT ON COLUMN public.payments.payment_reference IS 'Auto-generated reference (PAY-YYYYMMDD-NNN)';
COMMENT ON COLUMN public.payments.paymongo_payment_id IS 'PayMongo transaction ID for online payments';
COMMENT ON COLUMN public.payments.cashier_received_by IS 'Admin user who received cash payment';
COMMENT ON FUNCTION public.create_payment IS 'Create a new payment record for a booking';
COMMENT ON FUNCTION public.process_cashier_payment IS 'Mark a cash payment as completed';
COMMENT ON FUNCTION public.process_refund IS 'Process a refund for a completed payment';
