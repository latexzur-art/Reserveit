-- Allow Academic Heads and Building Admins to view schedule_entries_staging
CREATE POLICY "Admins can view staging entries"
  ON public.schedule_entries_staging FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('academic_head', 'building_admin', 'superadmin')
    )
  );
