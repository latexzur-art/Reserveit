-- =====================================================
-- Admin data-wipe functions (TESTING / RESET TOOLING)
-- =====================================================
-- Provides controlled, dependency-ordered "wipe" routines for the
-- building admin dashboard so test data can be cleared between runs.
--
-- These are DESTRUCTIVE. They are protected by:
--   1. EXECUTE revoked from PUBLIC (only service_role / definer can run)
--   2. API-route role guards (building_admin / user_manager)
--   3. An application-level environment gate that blocks the production
--      Supabase project (see lib/env/data-wipe.ts)
--
-- Deletion order is derived from the live foreign-key graph: tables with
-- RESTRICT / NO ACTION references to a target are cleared before it; the
-- remaining CASCADE / SET NULL children are handled by the engine.
-- =====================================================

-- -----------------------------------------------------
-- Dry-run counts for the data tiers (preview before wiping)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_count_wipe_data()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT jsonb_build_object(
    'bookings',            (SELECT count(*) FROM public.bookings),
    'payments',            (SELECT count(*) FROM public.payments),
    'class_schedules',     (SELECT count(*) FROM public.class_schedules),
    'schedule_uploads',    (SELECT count(*) FROM public.schedule_uploads),
    'courses',             (SELECT count(*) FROM public.courses),
    'course_uploads',      (SELECT count(*) FROM public.course_uploads),
    'maintenance_records', (SELECT count(*) FROM public.maintenance_records),
    'notifications',       (SELECT count(*) FROM public.notifications),
    'messages',            (SELECT count(*) FROM public.messages),
    'session_credits',     (SELECT count(*) FROM public.session_credits)
  );
$$;

-- -----------------------------------------------------
-- Wipe a data tier: 'bookings' | 'schedules' | 'curriculum' | 'all'
-- Returns JSONB with per-table deleted row counts. Runs in the
-- function's implicit transaction, so any failure rolls back fully.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_wipe_data(p_tier text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_n      bigint;
BEGIN
  IF p_tier NOT IN ('bookings', 'schedules', 'curriculum', 'all') THEN
    RAISE EXCEPTION 'Invalid wipe tier: %', p_tier;
  END IF;

  -- ============ BOOKINGS (paid + unpaid) ============
  IF p_tier IN ('bookings', 'all') THEN
    -- financial_audit -> bookings/payments (NO ACTION): clear first
    DELETE FROM public.financial_audit;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('financial_audit', v_n);

    -- academic_timeline -> bookings (NO ACTION)
    DELETE FROM public.academic_timeline;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('academic_timeline', v_n);

    -- payments -> bookings (RESTRICT): must precede bookings
    DELETE FROM public.payments;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('payments', v_n);

    -- session_credits -> bookings/payments (SET NULL); clear booking-derived credits
    DELETE FROM public.session_credits;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('session_credits', v_n);

    -- bookings: cascades booking_facilities, booking_equipment, booking_status_history,
    -- booking_decisions, booking_overrides, emergency_*_requests, reschedule offers
    DELETE FROM public.bookings;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('bookings', v_n);
  END IF;

  -- ============ SCHEDULES ============
  IF p_tier IN ('schedules', 'all') THEN
    -- bookings.cancelled_by_schedule_id -> class_schedules (NO ACTION); only matters
    -- when bookings still exist (i.e. a schedules-only wipe)
    UPDATE public.bookings SET cancelled_by_schedule_id = NULL
      WHERE cancelled_by_schedule_id IS NOT NULL;

    -- schedule_publish_log -> schedule_uploads (NO ACTION)
    DELETE FROM public.schedule_publish_log;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('schedule_publish_log', v_n);

    -- schedule_change_requests -> class_schedules (RESTRICT via original_schedule_id)
    DELETE FROM public.schedule_change_requests;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('schedule_change_requests', v_n);

    -- class_schedules: cascades class_schedule_exceptions + reschedule offers
    DELETE FROM public.class_schedules;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('class_schedules', v_n);

    -- schedule_uploads: cascades schedule_entries_staging -> instructor_match_candidates
    DELETE FROM public.schedule_uploads;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('schedule_uploads', v_n);
  END IF;

  -- ============ CURRICULUM (courses, not academic terms) ============
  IF p_tier IN ('curriculum', 'all') THEN
    DELETE FROM public.term_course_activations;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('term_course_activations', v_n);

    DELETE FROM public.courses;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('courses', v_n);

    DELETE FROM public.course_uploads;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('course_uploads', v_n);
  END IF;

  -- ============ ALL: remaining transactional logs / comms ============
  IF p_tier = 'all' THEN
    DELETE FROM public.equipment_status_log;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('equipment_status_log', v_n);

    DELETE FROM public.maintenance_records;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('maintenance_records', v_n);

    DELETE FROM public.score_reset_requests;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('score_reset_requests', v_n);

    DELETE FROM public.restriction_logs;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('restriction_logs', v_n);

    -- notifications before broadcasts (broadcast_id is SET NULL)
    DELETE FROM public.notifications;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('notifications', v_n);

    DELETE FROM public.messages;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('messages', v_n);

    DELETE FROM public.conversation_participants;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('conversation_participants', v_n);

    DELETE FROM public.conversations;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('conversations', v_n);

    DELETE FROM public.broadcasts;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('broadcasts', v_n);

    DELETE FROM public.facility_blocks;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_result := v_result || jsonb_build_object('facility_blocks', v_n);
  END IF;

  RETURN jsonb_build_object('success', true, 'tier', p_tier, 'deleted', v_result);
END;
$$;

-- -----------------------------------------------------
-- Count users that WOULD be deleted by admin_wipe_users (dry-run).
-- Excludes the sentinel, the acting admin, and anyone holding an
-- active role in p_preserve_roles.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_count_wipe_users(p_actor_id uuid, p_preserve_roles text[])
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT count(*)::int
  FROM public.users u
  WHERE u.id <> '00000000-0000-0000-0000-000000000000'
    AND u.id <> COALESCE(p_actor_id, '00000000-0000-0000-0000-000000000000')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND ur.is_active AND r.name = ANY(p_preserve_roles)
    );
$$;

-- -----------------------------------------------------
-- Wipe non-preserved users. Reuses admin_permanent_delete_user per row,
-- which reassigns RESTRICT/NO ACTION references to the [Deleted User]
-- sentinel and cascades the rest. Auth.users orphans are cleaned by the
-- existing auth-orphan-cleanup cron.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_wipe_users(p_actor_id uuid, p_preserve_roles text[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sentinel CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
  v_id    uuid;
  v_count int := 0;
  v_res   jsonb;
BEGIN
  FOR v_id IN
    SELECT u.id
    FROM public.users u
    WHERE u.id <> v_sentinel
      AND u.id <> COALESCE(p_actor_id, v_sentinel)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND ur.is_active AND r.name = ANY(p_preserve_roles)
      )
  LOOP
    v_res := public.admin_permanent_delete_user(v_id);
    IF COALESCE((v_res->>'success')::boolean, false) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

-- -----------------------------------------------------
-- Lock down EXECUTE: only the service role (used by createAdminClient in
-- server routes) may run these. Defense-in-depth on top of route guards.
-- -----------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_count_wipe_data()                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_wipe_data(text)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_count_wipe_users(uuid, text[])      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_wipe_users(uuid, text[])            FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_count_wipe_data()              TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_wipe_data(text)               TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_count_wipe_users(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_wipe_users(uuid, text[])       TO service_role;

COMMENT ON FUNCTION public.admin_wipe_data(text) IS
  'DESTRUCTIVE test tooling: clears a data tier (bookings|schedules|curriculum|all) in FK-dependency order. Gated by route guards + production env block.';
COMMENT ON FUNCTION public.admin_wipe_users(uuid, text[]) IS
  'DESTRUCTIVE test tooling: permanently deletes all users except the actor, the sentinel, and holders of p_preserve_roles.';
