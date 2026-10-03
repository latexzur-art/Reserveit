/**
 * Flag facilities that always require manual approval
 * Used by RESTRICTED_FACILITY hard constraint (bypass_auto = true)
 */

-- Science Labs: Require safety protocols and equipment oversight
UPDATE facilities
SET
  always_requires_approval = true,
  restricted_notes = 'Requires lab safety orientation and faculty supervision. Must coordinate with lab coordinator.'
WHERE name ILIKE '%science%lab%' OR name LIKE 'Lab %';

-- Auditorium: High-capacity venue with technical equipment
UPDATE facilities
SET
  always_requires_approval = true,
  restricted_notes = 'Requires AV technician coordination and event management approval.'
WHERE name ILIKE '%auditorium%' OR capacity >= 250;

-- Specialized computer labs (if any have high-end equipment)
UPDATE facilities
SET
  always_requires_approval = true,
  restricted_notes = 'Contains specialized equipment. Requires instructor or lab coordinator approval.'
WHERE name ILIKE '%computer%lab%1%' OR name ILIKE '%computer%lab%6%';

-- Conference rooms near admin offices (if they exist)
UPDATE facilities
SET
  always_requires_approval = true,
  restricted_notes = 'Administrative conference room. Requires department head approval.'
WHERE name ILIKE '%conference%1%';

-- Set facility_tier for premium facilities
UPDATE facilities
SET facility_tier = 'premium'
WHERE always_requires_approval = true;

-- Set facility_tier for specialized facilities
UPDATE facilities
SET facility_tier = 'specialized'
WHERE name ILIKE '%science%lab%'
   OR name ILIKE '%computer%lab%'
   OR name ILIKE '%avr%';

-- Set facility_tier for standard facilities (default)
UPDATE facilities
SET facility_tier = 'standard'
WHERE facility_tier IS NULL;
