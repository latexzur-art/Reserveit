-- =====================================================
-- Migration: Phase 2.1 — Hardening Function Search Path
-- Date: 2026-07-28
-- Description: Enforces search_path = public on all functions
--              in the public schema to prevent search_path manipulation.
-- =====================================================

DO $$
DECLARE
  func record;
  sql_cmd text;
BEGIN
  FOR func IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    sql_cmd := format('ALTER FUNCTION public.%I(%s) SET search_path = public;', func.proname, func.args);
    BEGIN
      EXECUTE sql_cmd;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter search_path for %: %', func.proname, SQLERRM;
    END;
  END LOOP;
END $$;
