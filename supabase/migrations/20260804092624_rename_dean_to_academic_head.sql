-- =====================================================
-- Rename leftover "dean" naming to "academic_head"
-- =====================================================
-- The `dean` role was merged into `academic_head` back in
-- 20260208010100_cleanup_roles_and_seed_admin.sql. The schedule review
-- feature (added later, 20260223060000) still named its enum, columns,
-- and index after "dean". Renaming them to match the actual role name.
-- =====================================================

ALTER TYPE dean_review_status RENAME TO academic_head_review_status;

ALTER TYPE academic_head_review_status RENAME VALUE 'dean_approved' TO 'academic_head_approved';
ALTER TYPE academic_head_review_status RENAME VALUE 'dean_flagged' TO 'academic_head_flagged';
ALTER TYPE academic_head_review_status RENAME VALUE 'dean_rejected' TO 'academic_head_rejected';

ALTER TABLE public.schedule_entries_staging
  RENAME COLUMN dean_review_status TO academic_head_review_status;
ALTER TABLE public.schedule_entries_staging
  RENAME COLUMN dean_review_notes TO academic_head_review_notes;
ALTER TABLE public.schedule_entries_staging
  RENAME COLUMN dean_reviewed_by TO academic_head_reviewed_by;
ALTER TABLE public.schedule_entries_staging
  RENAME COLUMN dean_reviewed_at TO academic_head_reviewed_at;

ALTER INDEX IF EXISTS staging_dean_review_idx RENAME TO staging_academic_head_review_idx;
