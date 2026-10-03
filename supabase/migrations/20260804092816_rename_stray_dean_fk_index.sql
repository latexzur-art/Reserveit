-- Rename an out-of-band FK index left over from before the dean->academic_head
-- column rename (20260804092624). Not tracked by any prior migration file —
-- likely created via the dashboard's unindexed-FK advisor — but it now sits
-- on public.schedule_entries_staging.academic_head_reviewed_by, so its name
-- is stale.
ALTER INDEX IF EXISTS idx_schedule_entries_staging_dean_reviewed_by
  RENAME TO idx_schedule_entries_staging_academic_head_reviewed_by;
