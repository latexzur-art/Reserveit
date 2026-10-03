-- Allow Academic Heads (and building admins) to SELECT schedule_uploads
-- so submitted schedules appear in their review queue.
DROP POLICY IF EXISTS "Academic heads can view schedule uploads" ON public.schedule_uploads;

CREATE POLICY "Academic heads can view schedule uploads"
  ON public.schedule_uploads FOR SELECT
  USING (
    public.user_has_any_role(ARRAY['academic_head', 'building_admin', 'superadmin'])
  );
