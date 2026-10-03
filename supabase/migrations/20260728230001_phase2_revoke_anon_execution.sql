-- =====================================================
-- Migration: Phase 2.2 — Revoke Anon Execution on Admin/Mutation Functions
-- Date: 2026-07-28
-- Description: Revokes EXECUTE privilege from anon role on sensitive
--              administrative, user management, and mutation functions.
-- =====================================================

DO $$
DECLARE
  func_name text;
  func record;
  sql_cmd text;
  target_funcs text[] := ARRAY[
    'admin_permanent_delete_user',
    'create_internal_user',
    'update_user_status',
    'complete_payment',
    'blacklist_external_client',
    'verify_external_client',
    'transfer_academic_head',
    'apply_emergency_reschedule',
    'apply_booking_proposal',
    'approve_change_request',
    'reject_change_request',
    'finalize_schedule_upload',
    'submit_schedule_upload',
    'request_schedule_revision',
    'set_active_term',
    'add_manual_schedule_entry',
    'create_schedule_change_request',
    'create_schedule_upload',
    'update_booking_status',
    'update_equipment_status',
    'submit_change_request',
    'validate_staging_entry',
    'auto_activate_courses_for_term',
    'auto_complete_past_bookings',
    'claim_employee_record',
    'generate_employee_id'
  ];
BEGIN
  FOREACH func_name IN ARRAY target_funcs LOOP
    FOR func IN
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = func_name
    LOOP
      sql_cmd := format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;', func.proname, func.args);
      BEGIN
        EXECUTE sql_cmd;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not revoke anon execute on %: %', func.proname, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;
