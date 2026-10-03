-- =====================================================
-- Fix booking_facilities RLS UPDATE/DELETE Policies
-- =====================================================
-- Description: Add explicit UPDATE and DELETE policies for service role
-- This fixes the accept-alternative endpoint 500 error caused by missing RLS policies
-- Date: 2026-02-27
-- =====================================================

-- Add explicit UPDATE policy for service role on booking_facilities
-- This allows the accept-alternative endpoint to update facility assignments
CREATE POLICY "Service role can update booking facilities"
  ON public.booking_facilities FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add explicit DELETE policy for service role on booking_facilities
-- This allows DELETE + INSERT pattern for safer facility swapping
CREATE POLICY "Service role can delete booking facilities"
  ON public.booking_facilities FOR DELETE
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON POLICY "Service role can update booking facilities" ON public.booking_facilities IS
  'Allows service role to update facility assignments when accepting alternatives';
COMMENT ON POLICY "Service role can delete booking facilities" ON public.booking_facilities IS
  'Allows service role to delete facility links for DELETE + INSERT pattern';
