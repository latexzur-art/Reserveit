-- DB remediation Phase 1.1 (DATABASE_REMEDIATION_PLAN.md)
-- Wrap bare auth.uid()/auth.role()/auth.jwt() calls in RLS policies with
-- (SELECT ...) so Postgres evaluates them once per query (InitPlan) instead
-- of once per row. Identical return values, identical RLS decisions.
--
-- Generated dynamically from pg_policies so it is idempotent: already-wrapped
-- calls are protected by placeholder substitution and re-running is a no-op.

CREATE FUNCTION pg_temp.wrap_auth_calls(expr text) RETURNS text
LANGUAGE plpgsql AS
$f$
BEGIN
  IF expr IS NULL THEN RETURN NULL; END IF;
  -- Protect already-wrapped forms (pg_policies normalizes them like this)
  expr := replace(expr, '( SELECT auth.uid() AS uid)',   '@@WRAPPED_UID@@');
  expr := replace(expr, '( SELECT auth.role() AS role)', '@@WRAPPED_ROLE@@');
  expr := replace(expr, '( SELECT auth.jwt() AS jwt)',   '@@WRAPPED_JWT@@');
  expr := replace(expr, '(SELECT auth.uid())',  '@@WRAPPED_UID2@@');
  expr := replace(expr, '(SELECT auth.role())', '@@WRAPPED_ROLE2@@');
  expr := replace(expr, '(SELECT auth.jwt())',  '@@WRAPPED_JWT2@@');
  -- Wrap the remaining bare calls
  expr := replace(expr, 'auth.uid()',  '( SELECT auth.uid() AS uid)');
  expr := replace(expr, 'auth.role()', '( SELECT auth.role() AS role)');
  expr := replace(expr, 'auth.jwt()',  '( SELECT auth.jwt() AS jwt)');
  -- Restore protected forms
  expr := replace(expr, '@@WRAPPED_UID@@',   '( SELECT auth.uid() AS uid)');
  expr := replace(expr, '@@WRAPPED_ROLE@@',  '( SELECT auth.role() AS role)');
  expr := replace(expr, '@@WRAPPED_JWT@@',   '( SELECT auth.jwt() AS jwt)');
  expr := replace(expr, '@@WRAPPED_UID2@@',  '(SELECT auth.uid())');
  expr := replace(expr, '@@WRAPPED_ROLE2@@', '(SELECT auth.role())');
  expr := replace(expr, '@@WRAPPED_JWT2@@',  '(SELECT auth.jwt())');
  RETURN expr;
END;
$f$;

DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  cmd text;
  changed_count int := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '')       ~ 'auth\.(uid|role|jwt)\(\)' OR
        COALESCE(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)'
      )
  LOOP
    new_qual  := pg_temp.wrap_auth_calls(p.qual);
    new_check := pg_temp.wrap_auth_calls(p.with_check);

    -- Skip policies that are already fully wrapped (no change after rewrite)
    CONTINUE WHEN (new_qual IS NOT DISTINCT FROM p.qual)
              AND (new_check IS NOT DISTINCT FROM p.with_check);

    cmd := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF new_qual IS NOT NULL THEN
      cmd := cmd || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      cmd := cmd || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE cmd;
    changed_count := changed_count + 1;
  END LOOP;

  RAISE NOTICE 'phase1_rls_initplan: rewrote % policies', changed_count;
END
$$;

DROP FUNCTION pg_temp.wrap_auth_calls(text);
