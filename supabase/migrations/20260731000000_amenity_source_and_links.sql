-- Phase 0 of the equipment/amenities visibility bridge: schema prep only, no
-- application code changes in this migration.
--
-- Two writers are about to compete for facility_amenity_map rows: a manual
-- amenity editor (a later phase) and an inventory-sync bridge (a later phase)
-- that derives amenities from physical equipment counts. `source` lets each
-- writer own its rows without stomping the other's, and lets a future UI
-- distinguish "admin-set" from "inventory-derived" amenities.
--
-- Separately, equipment_types.amenity_id links specific equipment categories
-- to the amenity they represent in the room brochure, so the inventory bridge
-- (Phase 4) knows which equipment rows to project into facility_amenity_map.
-- Only the types explicitly named below get a link; everything else (cables,
-- cords, pointers, chairs, tables, etc.) stays NULL and must never surface as
-- an amenity.

-- 1 & 2. facility_amenity_map.source: who owns this row.
-- All rows seeded so far (20260129011000_create_facility_amenity_map_table.sql)
-- were hand-picked per facility type, i.e. manually curated — 'manual' is the
-- correct default and backfill value for every pre-existing row, including the
-- old `computers` = capacity rows called out in the phase brief.
ALTER TABLE public.facility_amenity_map
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Explicit, idempotent backfill (redundant with the column default for rows
-- that predate this migration, but stated explicitly per the phase brief
-- rather than relying solely on the DEFAULT clause).
UPDATE public.facility_amenity_map
  SET source = 'manual'
  WHERE source IS DISTINCT FROM 'manual';

ALTER TABLE public.facility_amenity_map
  DROP CONSTRAINT IF EXISTS facility_amenity_map_source_check;

ALTER TABLE public.facility_amenity_map
  ADD CONSTRAINT facility_amenity_map_source_check
  CHECK (source IN ('manual', 'inventory'));

COMMENT ON COLUMN public.facility_amenity_map.source IS
  'Which writer owns this row: manual (set via the amenity editor) or inventory (derived from equipment_types.amenity_id by the inventory-sync bridge). Determines who may overwrite it.';

-- 3. equipment_types.amenity_id: which amenity this equipment type represents,
-- when it represents one at all. Nullable — most equipment types (cables,
-- cords, pointers, furniture, etc.) never surface as a brochure amenity.
ALTER TABLE public.equipment_types
  ADD COLUMN IF NOT EXISTS amenity_id UUID REFERENCES public.facility_amenities(id);

CREATE INDEX IF NOT EXISTS idx_equipment_types_amenity_id
  ON public.equipment_types(amenity_id)
  WHERE amenity_id IS NOT NULL;

COMMENT ON COLUMN public.equipment_types.amenity_id IS
  'Amenity this equipment type projects into facility_amenity_map via the inventory-sync bridge. NULL means this equipment type never surfaces as a room amenity (cables, cords, pointers, furniture, etc.).';

-- 4a. Ensure the target amenities exist. projector/microphone/sound_system
-- were already seeded by 20260129010600_create_facility_amenities_table.sql;
-- `laptop` is new here. ON CONFLICT DO NOTHING so this never clobbers an
-- admin edit to an existing row (e.g. a customized description/icon) on
-- re-run.
--
-- `laptop` is intentionally its OWN amenity, separate from `computers`
-- (Desktop Computers). Aliasing LAPTOP equipment to the `computers` amenity
-- would merge loan laptops into the lab desktop count (e.g. "Computers (54)"
-- for 30 fixed PCs + 24 loan laptops) — a real data-corruption bug this
-- schema guards against by construction. Do not add a DESKTOP_PC equipment
-- type either: lab computers remain a manually-set intrinsic amenity owned
-- by the editor, not by inventory.
INSERT INTO public.facility_amenities (name, description, icon, category) VALUES
  ('projector', 'LCD/LED Projector', 'videocam', 'AV'),
  ('laptop', 'Loan Laptop (portable computer)', 'laptop', 'Technology'),
  ('microphone', 'Microphone (wired/wireless)', 'mic', 'AV'),
  ('sound_system', 'Audio/Sound System', 'volume_up', 'AV')
ON CONFLICT (name) DO NOTHING;

-- 4b. Link equipment types to their amenity. Idempotent (re-running sets the
-- same amenity_id each time). Every other equipment type keeps amenity_id
-- NULL by omission.
UPDATE public.equipment_types
  SET amenity_id = (SELECT id FROM public.facility_amenities WHERE name = 'projector')
  WHERE type_code = 'PROJECTOR';

UPDATE public.equipment_types
  SET amenity_id = (SELECT id FROM public.facility_amenities WHERE name = 'laptop')
  WHERE type_code = 'LAPTOP';

UPDATE public.equipment_types
  SET amenity_id = (SELECT id FROM public.facility_amenities WHERE name = 'microphone')
  WHERE type_code LIKE 'MIC\_%';

UPDATE public.equipment_types
  SET amenity_id = (SELECT id FROM public.facility_amenities WHERE name = 'sound_system')
  WHERE type_code = 'SPEAKER';
