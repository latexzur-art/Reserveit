-- -----------------------------------------------------
-- Admin Data Export Function
-- Returns a JSON object containing major database tables.
-- Used to backup data before destructive wipe.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_export_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Bookings
  v_result := jsonb_set(v_result, '{bookings}', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.bookings) t), '[]'::jsonb));
  
  -- Users
  v_result := jsonb_set(v_result, '{users}', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.users) t), '[]'::jsonb));
  
  -- Rooms (Facilities)
  v_result := jsonb_set(v_result, '{facilities}', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.facilities) t), '[]'::jsonb));

  -- Class Schedules
  v_result := jsonb_set(v_result, '{class_schedules}', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.class_schedules) t), '[]'::jsonb));

  -- Courses
  v_result := jsonb_set(v_result, '{courses}', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.courses) t), '[]'::jsonb));
  
  -- Departments
  v_result := jsonb_set(v_result, '{departments}', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM public.departments) t), '[]'::jsonb));
  
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_export_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_export_data() TO service_role;
