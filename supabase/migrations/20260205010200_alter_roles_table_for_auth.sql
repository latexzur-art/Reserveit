-- =====================================================
-- Migration: Alter Roles Table for Auth System
-- =====================================================
-- Description: Adds display properties and internal-only flag to roles
-- Date: 2026-02-05
-- =====================================================

-- Step 1: Add new columns
ALTER TABLE public.roles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS badge_color TEXT DEFAULT 'gray',
ADD COLUMN IF NOT EXISTS is_internal_only BOOLEAN DEFAULT FALSE;

-- Step 2: Update existing roles with display names and colors
UPDATE public.roles SET
  display_name = 'User Manager',
  badge_color = 'gray',
  is_internal_only = TRUE
WHERE name = 'user_manager';

UPDATE public.roles SET
  display_name = 'Building Admin',
  badge_color = 'red',
  is_internal_only = TRUE
WHERE name = 'building_admin';

UPDATE public.roles SET
  display_name = 'School Admin',
  badge_color = 'blue',
  is_internal_only = TRUE
WHERE name = 'school_admin';

UPDATE public.roles SET
  display_name = 'Dean',
  badge_color = 'purple',
  is_internal_only = TRUE
WHERE name = 'dean';

UPDATE public.roles SET
  display_name = 'Dept Head',
  badge_color = 'yellow',
  is_internal_only = TRUE
WHERE name = 'dept_head';

UPDATE public.roles SET
  display_name = 'Faculty',
  badge_color = 'teal',
  is_internal_only = TRUE
WHERE name = 'faculty';

UPDATE public.roles SET
  display_name = 'Cashier',
  badge_color = 'green',
  is_internal_only = TRUE
WHERE name = 'cashier';

UPDATE public.roles SET
  display_name = 'External Client',
  badge_color = 'orange',
  is_internal_only = FALSE
WHERE name = 'external_client';

-- Step 3: Insert missing roles if they don't exist
INSERT INTO public.roles (name, display_name, description, badge_color, is_internal_only, is_active)
VALUES
  ('user_manager', 'User Manager', 'Manages user accounts and role assignments', 'gray', TRUE, TRUE),
  ('building_admin', 'Building Admin', 'Building administrator with final approval authority', 'red', TRUE, TRUE),
  ('school_admin', 'School Admin', 'School-wide administrative functions', 'blue', TRUE, TRUE),
  ('dean', 'Dean', 'College dean with departmental oversight', 'purple', TRUE, TRUE),
  ('dept_head', 'Dept Head', 'Department head with first-level approvals', 'yellow', TRUE, TRUE),
  ('faculty', 'Faculty', 'Teaching staff with booking creation access', 'teal', TRUE, TRUE),
  ('cashier', 'Cashier', 'Payment processing staff', 'green', TRUE, TRUE),
  ('external_client', 'External Client', 'External facility renters', 'orange', FALSE, TRUE)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  badge_color = EXCLUDED.badge_color,
  is_internal_only = EXCLUDED.is_internal_only;

-- Step 4: Set display_name from name where null
UPDATE public.roles
SET display_name = INITCAP(REPLACE(name, '_', ' '))
WHERE display_name IS NULL;

-- Step 5: Add comments
COMMENT ON COLUMN public.roles.display_name IS 'Human-readable role name for UI display';
COMMENT ON COLUMN public.roles.badge_color IS 'Color for role badge in UI (tailwind colors)';
COMMENT ON COLUMN public.roles.is_internal_only IS 'If true, only internal (STI) users can have this role';
