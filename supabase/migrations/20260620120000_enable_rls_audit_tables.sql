-- =====================================================
-- Enable RLS on exposed audit/log tables
-- =====================================================
-- Description: financial_audit and academic_timeline shipped with RLS disabled,
--   leaving them fully readable/writable through the anon key. Both are
--   append-only logs written exclusively by handle_payment_completed() — which
--   fires from complete_payment() (SECURITY DEFINER, table-owner context) or a
--   direct service_role update. Both write paths BYPASS RLS, so no write policy
--   is needed: enabling RLS closes the anon hole without breaking the trigger,
--   and the tables stay tamper-proof from the client. Reads are limited to the
--   relevant staff roles.
-- Date: 2026-06-20
-- =====================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit') THEN
    ALTER TABLE public.financial_audit ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role manages financial_audit" ON public.financial_audit;
    CREATE POLICY "Service role manages financial_audit"
      ON public.financial_audit FOR ALL
      USING (auth.role() = 'service_role');
    DROP POLICY IF EXISTS "Admins view financial_audit" ON public.financial_audit;
    CREATE POLICY "Admins view financial_audit"
      ON public.financial_audit FOR SELECT
      USING (public.user_has_any_role(ARRAY['building_admin', 'school_admin']));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_timeline') THEN
    ALTER TABLE public.academic_timeline ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role manages academic_timeline" ON public.academic_timeline;
    CREATE POLICY "Service role manages academic_timeline"
      ON public.academic_timeline FOR ALL
      USING (auth.role() = 'service_role');
    DROP POLICY IF EXISTS "Staff view academic_timeline" ON public.academic_timeline;
    CREATE POLICY "Staff view academic_timeline"
      ON public.academic_timeline FOR SELECT
      USING (public.user_has_any_role(ARRAY['building_admin', 'school_admin', 'academic_head']));
  END IF;
END $$;
