-- =====================================================
-- Phase 1.2: Create Payments Table
-- =====================================================
-- Description: Payment records (PayMongo + Cashier)
-- Policy: NO REFUNDS, Full payment required before approval
-- Date: 2026-01-30
-- =====================================================

-- Create payment_method enum
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('paymongo_card', 'paymongo_gcash', 'paymongo_grab', 'paymongo_maya', 'cashier');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment_status enum (NO refunded status - institution has no refund policy)
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference TEXT UNIQUE NOT NULL, -- Auto-generated: PAY-20250129-001
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- Amount details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'PHP',
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0)) STORED,

  -- Payment type (initial booking or extension)
  payment_type TEXT DEFAULT 'booking' CHECK (payment_type IN ('booking', 'extension')),
  extension_hours DECIMAL(4, 2), -- Hours being extended (if payment_type = 'extension')

  -- Payment method and status
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',

  -- PayMongo specific fields
  paymongo_payment_id TEXT, -- PayMongo transaction ID
  paymongo_payment_intent_id TEXT,
  paymongo_checkout_url TEXT,
  paymongo_checkout_session_id TEXT,
  paymongo_source_id TEXT,
  paymongo_webhook_data JSONB, -- Store webhook payload for reference

  -- Cashier specific fields
  cashier_received_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin who received cash
  cashier_receipt_number TEXT,
  cashier_notes TEXT,

  -- Timestamps
  paid_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Payment link expiration

  -- Metadata
  description TEXT, -- Payment description
  metadata JSONB DEFAULT '{}', -- Additional data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT payments_positive_amount CHECK (amount > 0),
  CONSTRAINT payments_extension_hours CHECK (
    (payment_type = 'extension' AND extension_hours > 0) OR
    (payment_type = 'booking' AND extension_hours IS NULL)
  )
);

-- Add indexes
CREATE INDEX IF NOT EXISTS payments_payment_reference_idx ON public.payments(payment_reference);
CREATE INDEX IF NOT EXISTS payments_booking_id_idx ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_payment_status_idx ON public.payments(payment_status);
CREATE INDEX IF NOT EXISTS payments_payment_method_idx ON public.payments(payment_method);
CREATE INDEX IF NOT EXISTS payments_payment_type_idx ON public.payments(payment_type);
CREATE INDEX IF NOT EXISTS payments_paymongo_payment_id_idx ON public.payments(paymongo_payment_id) WHERE paymongo_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_pending_idx ON public.payments(payment_status) WHERE payment_status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own payments
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role can manage payments"
  ON public.payments FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate payment reference number
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  sequence_num INTEGER;
  new_reference TEXT;
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Get the count of payments created today + 1
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.payments
  WHERE DATE(created_at) = CURRENT_DATE;

  new_reference := 'PAY-' || today_date || '-' || LPAD(sequence_num::TEXT, 3, '0');

  RETURN new_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate payment reference
CREATE OR REPLACE FUNCTION public.set_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_reference IS NULL OR NEW.payment_reference = '' THEN
    NEW.payment_reference := public.generate_payment_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_payment_reference
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_reference();

-- =====================================================
-- CORE POLICY: Booking approval requires full payment
-- =====================================================

-- Function to check if booking has completed payment
CREATE OR REPLACE FUNCTION public.is_booking_paid(p_booking_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.payments
    WHERE booking_id = p_booking_id
      AND payment_type = 'booking'
      AND payment_status = 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a new payment for booking
CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id UUID,
  p_user_id UUID,
  p_amount DECIMAL,
  p_payment_method payment_method,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_requires_payment BOOLEAN;
BEGIN
  -- Check if booking requires payment
  SELECT requires_payment INTO v_requires_payment
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT v_requires_payment THEN
    RAISE EXCEPTION 'This booking does not require payment';
  END IF;

  -- Check if payment already exists and is completed
  IF public.is_booking_paid(p_booking_id) THEN
    RAISE EXCEPTION 'Booking already has a completed payment';
  END IF;

  INSERT INTO public.payments (
    booking_id,
    user_id,
    amount,
    payment_method,
    payment_type,
    description
  ) VALUES (
    p_booking_id,
    p_user_id,
    p_amount,
    p_payment_method,
    'booking',
    p_description
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- EXTENSION PAYMENT: Must pay before extending
-- =====================================================

-- Function to create payment for booking extension
CREATE OR REPLACE FUNCTION public.create_extension_payment(
  p_booking_id UUID,
  p_user_id UUID,
  p_amount DECIMAL,
  p_extension_hours DECIMAL,
  p_payment_method payment_method,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_booking_status TEXT;
BEGIN
  -- Check booking status (must be approved or completed to extend)
  SELECT current_status INTO v_booking_status
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_booking_status NOT IN ('approved', 'completed') THEN
    RAISE EXCEPTION 'Can only extend approved or completed bookings';
  END IF;

  -- Original booking must be paid first
  IF NOT public.is_booking_paid(p_booking_id) THEN
    RAISE EXCEPTION 'Original booking must be paid before extending';
  END IF;

  INSERT INTO public.payments (
    booking_id,
    user_id,
    amount,
    payment_method,
    payment_type,
    extension_hours,
    description
  ) VALUES (
    p_booking_id,
    p_user_id,
    p_amount,
    p_payment_method,
    'extension',
    p_extension_hours,
    COALESCE(p_description, 'Extension: ' || p_extension_hours || ' hours')
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update payment status (handles approval logic)
CREATE OR REPLACE FUNCTION public.complete_payment(
  p_payment_id UUID,
  p_paymongo_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking_id UUID;
  v_payment_type TEXT;
  v_extension_hours DECIMAL;
BEGIN
  -- Get payment details
  SELECT booking_id, payment_type, extension_hours
  INTO v_booking_id, v_payment_type, v_extension_hours
  FROM public.payments
  WHERE id = p_payment_id AND payment_status = 'pending';

  IF v_booking_id IS NULL THEN
    RETURN false;
  END IF;

  -- Mark payment as completed
  UPDATE public.payments
  SET payment_status = 'completed',
      paid_at = NOW(),
      paymongo_webhook_data = COALESCE(p_paymongo_data, paymongo_webhook_data),
      updated_at = NOW()
  WHERE id = p_payment_id;

  -- If booking payment completed, mark booking as paid (ready for approval)
  IF v_payment_type = 'booking' THEN
    UPDATE public.bookings
    SET requires_payment = false,
        updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  -- If extension payment completed, extend the booking end_time
  IF v_payment_type = 'extension' AND v_extension_hours IS NOT NULL THEN
    UPDATE public.bookings
    SET end_time = end_time + (v_extension_hours || ' hours')::INTERVAL,
        updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process cashier payment
CREATE OR REPLACE FUNCTION public.process_cashier_payment(
  p_payment_id UUID,
  p_cashier_user_id UUID,
  p_receipt_number TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking_id UUID;
  v_payment_type TEXT;
  v_extension_hours DECIMAL;
BEGIN
  -- Get payment details
  SELECT booking_id, payment_type, extension_hours
  INTO v_booking_id, v_payment_type, v_extension_hours
  FROM public.payments
  WHERE id = p_payment_id
    AND payment_method = 'cashier'
    AND payment_status = 'pending';

  IF v_booking_id IS NULL THEN
    RETURN false;
  END IF;

  -- Mark payment as completed
  UPDATE public.payments
  SET payment_status = 'completed',
      cashier_received_by = p_cashier_user_id,
      cashier_receipt_number = p_receipt_number,
      cashier_notes = p_notes,
      paid_at = NOW(),
      updated_at = NOW()
  WHERE id = p_payment_id;

  -- If booking payment, mark as paid
  IF v_payment_type = 'booking' THEN
    UPDATE public.bookings
    SET requires_payment = false,
        updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  -- If extension payment, extend the booking
  IF v_payment_type = 'extension' AND v_extension_hours IS NOT NULL THEN
    UPDATE public.bookings
    SET end_time = end_time + (v_extension_hours || ' hours')::INTERVAL,
        updated_at = NOW()
    WHERE id = v_booking_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- APPROVAL GUARD: Prevent approval without payment
-- =====================================================

-- Function to validate booking can be approved (payment check)
CREATE OR REPLACE FUNCTION public.can_approve_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_requires_payment BOOLEAN;
BEGIN
  SELECT requires_payment INTO v_requires_payment
  FROM public.bookings
  WHERE id = p_booking_id;

  -- If requires_payment is still true, booking hasn't been paid
  IF v_requires_payment = true THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get total paid amount for a booking
CREATE OR REPLACE FUNCTION public.get_booking_total_paid(p_booking_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total
  FROM public.payments
  WHERE booking_id = p_booking_id
    AND payment_status = 'completed';

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.payments IS 'Payment records for booking transactions. NO REFUND POLICY - all payments are final.';
COMMENT ON COLUMN public.payments.payment_reference IS 'Auto-generated reference (PAY-YYYYMMDD-NNN)';
COMMENT ON COLUMN public.payments.payment_type IS 'booking = initial payment, extension = additional hours payment';
COMMENT ON COLUMN public.payments.extension_hours IS 'Hours being added if this is an extension payment';
COMMENT ON COLUMN public.payments.paymongo_payment_id IS 'PayMongo transaction ID for online payments';
COMMENT ON COLUMN public.payments.cashier_received_by IS 'Admin user who received cash payment';
COMMENT ON FUNCTION public.is_booking_paid IS 'Check if a booking has completed payment';
COMMENT ON FUNCTION public.can_approve_booking IS 'Check if booking can be approved (must be paid first)';
COMMENT ON FUNCTION public.create_extension_payment IS 'Create payment for booking time extension';
