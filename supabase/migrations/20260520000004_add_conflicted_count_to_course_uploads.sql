-- Add conflicted_count to course_uploads to track rows that were skipped
-- because a course with the same (department_code, course_code) already exists
-- and the uploader did not opt in to overwrite.
ALTER TABLE course_uploads
  ADD COLUMN IF NOT EXISTS conflicted_count INTEGER NOT NULL DEFAULT 0;
