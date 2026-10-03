-- Resolve any existing duplicate (department_code, course_code) rows, then enforce uniqueness.
-- Per duplicate group: keep the approved row if any, else the most recently updated row.

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY department_code, course_code
      ORDER BY (approval_status = 'approved') DESC, updated_at DESC, id DESC
    ) AS rn
  FROM public.courses
)
DELETE FROM public.courses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DROP INDEX IF EXISTS public.idx_courses_dept_code;

ALTER TABLE public.courses
ADD CONSTRAINT courses_department_course_unique UNIQUE (department_code, course_code);
