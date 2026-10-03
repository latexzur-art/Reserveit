-- Structured year-level/term label for a batch upload, derived from the Year Level / Semester
-- dropdowns on the Upload step. NULL means "Mixed / All" — no per-row check applies.
-- Used to catch a row whose own year_level/term disagrees with what the uploader selected.

ALTER TABLE public.course_uploads
ADD COLUMN IF NOT EXISTS label_year_level INTEGER CHECK (label_year_level BETWEEN 1 AND 4),
ADD COLUMN IF NOT EXISTS label_term INTEGER CHECK (label_term BETWEEN 1 AND 3);
