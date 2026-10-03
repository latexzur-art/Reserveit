-- Add elective_type column to courses
-- Free-text name/type for elective courses (e.g. "Web Development", "AI & Machine Learning Track").
-- Nullable: required only when is_elective = true, enforced in application validation (validateCourse),
-- not as a DB constraint, so existing rows are unaffected.

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS elective_type TEXT;

COMMENT ON COLUMN public.courses.elective_type IS
  'Free-text elective name/type, e.g. "Web Development". Required by application logic when is_elective = true.';
