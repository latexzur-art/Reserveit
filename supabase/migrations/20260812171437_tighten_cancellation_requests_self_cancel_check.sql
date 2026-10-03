-- Tighten "Users cancel own pending requests" RLS policy on cancellation_requests
--
-- The original WITH CHECK clause (from 20260811051726_cancellation_request_workflow.sql)
-- only re-verified ownership (auth.uid() = user_id), not that the resulting status
-- stays within the intended value. That allowed a direct client UPDATE via the
-- owner's own session to set status to ANY value satisfying the CHECK constraint
-- (e.g. self-set 'approved_with_strike') rather than only the legitimate
-- "user withdraws their own pending request" outcome, which is status = 'cancelled'
-- (matching what app/api/bookings/[id]/request-cancellation/route.ts's DELETE
-- handler sets via the service-role client).
--
-- This migration drops and recreates ONLY this one policy, adding a status = 'cancelled'
-- condition to WITH CHECK. No other policy on this table is touched — in particular,
-- the "Service role manages cancellation requests" policy was already fixed in a
-- prior migration to scope to auth.role() = 'service_role' and is left alone here.

DROP POLICY IF EXISTS "Users cancel own pending requests" ON public.cancellation_requests;

CREATE POLICY "Users cancel own pending requests"
  ON public.cancellation_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');
