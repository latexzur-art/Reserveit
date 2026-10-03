-- The app (UploadStatus type, batch-constants.ts STATUS_LABELS/COLORS, and
-- deleteUploadBatch's soft-delete) already treats 'deleted' as a valid
-- upload_status, but the DB check constraint never included it — every
-- delete attempt failed with "violates check constraint
-- course_uploads_upload_status_check".

alter table public.course_uploads
  drop constraint course_uploads_upload_status_check;

alter table public.course_uploads
  add constraint course_uploads_upload_status_check
  check (upload_status = any (array[
    'draft', 'parsing', 'parsed', 'validation_failed', 'pending_submission',
    'submitted', 'approved', 'partially_rejected', 'rejected', 'deleted'
  ]::text[]));
