-- Fix booking_course_code: drop stale FK to departments(code).
-- The column was originally designed to store department/program codes (BSIT, BSCS),
-- but now stores individual course codes (CITE1004, etc.) from the courses table.
-- A FK to departments is wrong; storing it as a plain string is correct since
-- booking_department_code already carries the department context separately.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_course_code_fkey;

-- Widen to match courses.course_code (VARCHAR(20))
ALTER TABLE public.bookings
  ALTER COLUMN booking_course_code TYPE VARCHAR(20);
