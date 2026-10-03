/**
 * Seed booking_rules JSONB on facility_types
 * Defines which booking_purpose values are allowed/disallowed for each facility type
 * Used by PURPOSE_MISMATCH hard constraint check
 */

-- Computer Labs: Academic use only (no personal/commercial)
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['academic', 'school_event', 'department_use']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial', 'community']::text[],
  'requires_approval_purposes', ARRAY['school_event']::text[],
  'notes', 'Computer labs are reserved for academic activities. Department use requires advance coordination.'
)
WHERE name ILIKE '%computer%lab%';

-- Science Labs: Academic + research only, always requires approval
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['academic', 'department_use']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial', 'community', 'school_event']::text[],
  'requires_approval_purposes', ARRAY['academic', 'department_use']::text[],
  'notes', 'Science labs require safety protocols. All bookings must be reviewed.'
)
WHERE name ILIKE '%science%lab%' OR name ILIKE '%laboratory%';

-- Classrooms: General academic use, no personal/commercial
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['academic', 'school_event', 'department_use']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial']::text[],
  'requires_approval_purposes', ARRAY[]::text[],
  'notes', 'Standard classrooms available for academic and official school events.'
)
WHERE name ILIKE '%classroom%' OR name ILIKE '%lecture%room%';

-- Auditorium: Events and large gatherings, no regular classes
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['school_event', 'community', 'department_use']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial']::text[],
  'requires_approval_purposes', ARRAY['school_event', 'community', 'department_use']::text[],
  'notes', 'Auditorium is for large events, assemblies, and community programs. Requires advance approval.'
)
WHERE name ILIKE '%auditorium%' OR name ILIKE '%theater%';

-- Multipurpose Halls: Flexible event spaces
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['school_event', 'department_use', 'community', 'academic']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial']::text[],
  'requires_approval_purposes', ARRAY['community']::text[],
  'notes', 'Multipurpose halls support various activities. Community use requires approval.'
)
WHERE name ILIKE '%multipurpose%' OR name ILIKE '%function%hall%';

-- Conference Rooms: Meetings and small gatherings
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['department_use', 'academic', 'school_event']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial', 'community']::text[],
  'requires_approval_purposes', ARRAY[]::text[],
  'notes', 'Conference rooms for meetings, workshops, and small group sessions.'
)
WHERE name ILIKE '%conference%' OR name ILIKE '%meeting%room%';

-- Library Study Rooms: Academic study only
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['academic']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial', 'community', 'school_event']::text[],
  'requires_approval_purposes', ARRAY[]::text[],
  'notes', 'Study rooms are for academic purposes only. Maximum 2-hour sessions.'
)
WHERE name ILIKE '%study%room%' OR name ILIKE '%library%';

-- Gym/Sports Facilities: Physical activities
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['school_event', 'department_use', 'community']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial']::text[],
  'requires_approval_purposes', ARRAY['school_event', 'community']::text[],
  'notes', 'Gym facilities for sports, PE classes, and school events.'
)
WHERE name ILIKE '%gym%' OR name ILIKE '%court%' OR name ILIKE '%field%';

-- Default fallback for any unmatched types
UPDATE facility_types
SET booking_rules = jsonb_build_object(
  'allowed_purposes', ARRAY['academic', 'school_event', 'department_use']::text[],
  'disallowed_purposes', ARRAY['personal', 'commercial']::text[],
  'requires_approval_purposes', ARRAY[]::text[],
  'notes', 'General facility booking rules apply.'
)
WHERE booking_rules IS NULL;
