-- Fix CRITICAL RLS hole on public.cancellation_requests
--
-- The original policy (20260811051726_cancellation_request_workflow.sql) was:
--   CREATE POLICY "Service role manages cancellation requests"
--     ON public.cancellation_requests FOR ALL
--     USING (TRUE) WITH CHECK (TRUE);
--
-- With no restricting predicate, this PERMISSIVE policy applies to PUBLIC and,
-- because Postgres OR-combines permissive policies, it granted full
-- SELECT/INSERT/UPDATE/DELETE to anon + authenticated callers via PostgREST
-- (the public anon key), overriding every correctly-scoped owner/AH policy and
-- exposing PII (reason, refund_destination_name, refund_destination_contact_number).
--
-- Fix: gate the service-role policy behind auth.role() = 'service_role', matching
-- the established convention used by payment_refunds and payment_qr_submissions
-- (USING only, no WITH CHECK). The app's server code uses createAdminClient()
-- (service role), which still satisfies this predicate, so no functional regression.

DROP POLICY IF EXISTS "Service role manages cancellation requests" ON public.cancellation_requests;

CREATE POLICY "Service role manages cancellation requests"
  ON public.cancellation_requests FOR ALL
  USING (auth.role() = 'service_role');
