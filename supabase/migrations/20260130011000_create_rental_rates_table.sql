-- =====================================================
-- Phase 1.2: Create Rental Rates Table
-- =====================================================
-- Description: Facility pricing for rentals with fee categories
-- Fee Types: Rental (AM/PM hourly), Energy (flat), Personnel (variable)
-- Date: 2026-01-30
-- =====================================================

-- Create fee_category enum
DO $$ BEGIN
  CREATE TYPE fee_category AS ENUM ('rental', 'energy', 'personnel');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create time_period enum for AM/PM pricing
DO $$ BEGIN
  CREATE TYPE time_period AS ENUM ('am', 'pm', 'all_day');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create rate_type enum
DO $$ BEGIN
  CREATE TYPE rate_type AS ENUM ('hourly', 'flat', 'variable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create rental_rates table
CREATE TABLE IF NOT EXISTS public.rental_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,

  -- Fee classification
  fee_category fee_category NOT NULL DEFAULT 'rental',
  rate_name TEXT NOT NULL, -- e.g., "AM Rental", "PM Rental", "Basic Sound", "LED Lights"
  rate_type rate_type NOT NULL DEFAULT 'hourly',
  time_period time_period DEFAULT 'all_day', -- AM (before 12pm), PM (12pm onwards)

  -- Pricing
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'PHP',

  -- Time constraints (for hourly rates)
  applicable_start_time TIME, -- e.g., 07:00 for AM rates
  applicable_end_time TIME,   -- e.g., 12:00 for AM rates

  -- Additional details
  description TEXT,
  is_required BOOLEAN DEFAULT false, -- true for base rental, false for add-ons
  is_addon BOOLEAN DEFAULT false, -- true for energy/personnel fees
  sort_order INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_until DATE, -- NULL means no end date

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT rental_rates_positive_amount CHECK (amount >= 0),
  CONSTRAINT rental_rates_valid_dates CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CONSTRAINT rental_rates_valid_time_range CHECK (
    (applicable_start_time IS NULL AND applicable_end_time IS NULL) OR
    (applicable_start_time IS NOT NULL AND applicable_end_time IS NOT NULL AND applicable_end_time > applicable_start_time)
  ),
  -- Unique constraint for ON CONFLICT
  CONSTRAINT rental_rates_facility_rate_name_unique UNIQUE (facility_id, rate_name)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS rental_rates_facility_id_idx ON public.rental_rates(facility_id);
CREATE INDEX IF NOT EXISTS rental_rates_fee_category_idx ON public.rental_rates(fee_category);
CREATE INDEX IF NOT EXISTS rental_rates_time_period_idx ON public.rental_rates(time_period);
CREATE INDEX IF NOT EXISTS rental_rates_rate_type_idx ON public.rental_rates(rate_type);
CREATE INDEX IF NOT EXISTS rental_rates_is_active_idx ON public.rental_rates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS rental_rates_is_addon_idx ON public.rental_rates(is_addon);
CREATE INDEX IF NOT EXISTS rental_rates_effective_idx ON public.rental_rates(effective_from, effective_until);

-- Enable Row Level Security
ALTER TABLE public.rental_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active rental rates"
  ON public.rental_rates FOR SELECT
  USING (is_active = true AND effective_from <= CURRENT_DATE AND (effective_until IS NULL OR effective_until >= CURRENT_DATE));

CREATE POLICY "Authenticated users can view all rental rates"
  ON public.rental_rates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage rental rates"
  ON public.rental_rates FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_rental_rates_updated_at
  BEFORE UPDATE ON public.rental_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default rental rates for rentable facilities
DO $$
DECLARE
  v_facility_id UUID;
BEGIN
  -- Get the Gym facility (or any rentable facility)
  SELECT id INTO v_facility_id
  FROM public.facilities
  WHERE is_available_for_rental = true
  LIMIT 1;

  IF v_facility_id IS NOT NULL THEN
    -- =====================================================
    -- RENTAL FEES (Base hourly rates)
    -- =====================================================

    -- AM Rate: ₱580/hour (Valid from 7:00 AM up to 5:00 PM)
INSERT INTO public.rental_rates (
  facility_id, fee_category, rate_name, rate_type, time_period,
  amount, applicable_start_time, applicable_end_time,
  description, is_required, is_addon, sort_order
) VALUES (
  v_facility_id, 'rental', 'AM Rental Rate', 'hourly', 'am',
  580.00, '07:00', '17:00', 
  'Morning rental rate (7:00 AM - 5:00 PM)', true, false, 1
) ON CONFLICT (facility_id, rate_name) DO NOTHING;

-- PM Rate: ₱780/hour (Valid from 5:00 PM to 9:00 PM)
INSERT INTO public.rental_rates (
  facility_id, fee_category, rate_name, rate_type, time_period,
  amount, applicable_start_time, applicable_end_time,
  description, is_required, is_addon, sort_order
) VALUES (
  v_facility_id, 'rental', 'PM Rental Rate', 'hourly', 'pm',
  780.00, '17:00', '21:00', 
  'Afternoon/Evening rental rate (5:00 PM - 9:00 PM)', true, false, 2
) ON CONFLICT (facility_id, rate_name) DO NOTHING;
    -- =====================================================
    -- ENERGY FEES (Optional add-ons - flat rates)
    -- =====================================================

    -- Basic Sound: ₱1,500 flat
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'energy', 'Basic Sound System', 'flat', 'all_day',
      1500.00, 'Basic sound system equipment and power usage', false, true, 10
    ) ON CONFLICT DO NOTHING;

    -- LED Lights: ₱2,500 flat
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'energy', 'LED Lights', 'flat', 'all_day',
      2500.00, 'LED lighting equipment and power usage', false, true, 11
    ) ON CONFLICT DO NOTHING;

    -- =====================================================
    -- PERSONNEL FEES (Variable based on staff)
    -- =====================================================

    -- Personnel: Variable (per staff member)
    INSERT INTO public.rental_rates (
      facility_id, fee_category, rate_name, rate_type, time_period,
      amount, description, is_required, is_addon, sort_order
    ) VALUES (
      v_facility_id, 'personnel', 'Staff Support (per person)', 'variable', 'all_day',
      0.00, 'Additional staff support - rate varies based on number and type of personnel requested', false, true, 20
    ) ON CONFLICT DO NOTHING;

  END IF;
END $$;

-- Function to get applicable rental rate based on time
CREATE OR REPLACE FUNCTION public.get_rental_rate(
  p_facility_id UUID,
  p_booking_time TIME
)
RETURNS TABLE(
  rate_id UUID,
  rate_name TEXT,
  rate_type rate_type,
  time_period time_period,
  amount DECIMAL,
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.id,
    rr.rate_name,
    rr.rate_type,
    rr.time_period,
    rr.amount,
    rr.currency
  FROM public.rental_rates rr
  WHERE rr.facility_id = p_facility_id
    AND rr.fee_category = 'rental'
    AND rr.is_active = true
    AND rr.effective_from <= CURRENT_DATE
    AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE)
    AND (
      (rr.applicable_start_time IS NULL AND rr.applicable_end_time IS NULL) OR
      (p_booking_time >= rr.applicable_start_time AND p_booking_time < rr.applicable_end_time)
    )
  ORDER BY rr.sort_order ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all addon fees for a facility
CREATE OR REPLACE FUNCTION public.get_addon_fees(
  p_facility_id UUID
)
RETURNS TABLE(
  rate_id UUID,
  fee_category fee_category,
  rate_name TEXT,
  rate_type rate_type,
  amount DECIMAL,
  currency TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rr.id,
    rr.fee_category,
    rr.rate_name,
    rr.rate_type,
    rr.amount,
    rr.currency,
    rr.description
  FROM public.rental_rates rr
  WHERE rr.facility_id = p_facility_id
    AND rr.is_addon = true
    AND rr.is_active = true
    AND rr.effective_from <= CURRENT_DATE
    AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE)
  ORDER BY rr.sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total rental cost
CREATE OR REPLACE FUNCTION public.calculate_rental_cost(
  p_facility_id UUID,
  p_start_time TIME,
  p_end_time TIME,
  p_addon_ids UUID[] DEFAULT '{}'
)
RETURNS TABLE(
  item_name TEXT,
  fee_category fee_category,
  rate_type rate_type,
  hours DECIMAL,
  unit_amount DECIMAL,
  subtotal DECIMAL,
  currency TEXT
) AS $$
DECLARE
  v_duration_hours DECIMAL;
  v_am_hours DECIMAL := 0;
  v_pm_hours DECIMAL := 0;
  v_noon TIME := '17:00';
BEGIN
  -- Calculate total duration
  v_duration_hours := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 3600;

  -- Calculate AM hours (before noon)
  IF p_start_time < v_noon THEN
    IF p_end_time <= v_noon THEN
      v_am_hours := v_duration_hours;
    ELSE
      v_am_hours := EXTRACT(EPOCH FROM (v_noon - p_start_time)) / 3600;
    END IF;
  END IF;

  -- Calculate PM hours (noon onwards)
  IF p_end_time > v_noon THEN
    IF p_start_time >= v_noon THEN
      v_pm_hours := v_duration_hours;
    ELSE
      v_pm_hours := EXTRACT(EPOCH FROM (p_end_time - v_noon)) / 3600;
    END IF;
  END IF;

  -- Return AM rental if applicable
  IF v_am_hours > 0 THEN
    RETURN QUERY
    SELECT
      rr.rate_name,
      rr.fee_category,
      rr.rate_type,
      v_am_hours,
      rr.amount,
      v_am_hours * rr.amount,
      rr.currency
    FROM public.rental_rates rr
    WHERE rr.facility_id = p_facility_id
      AND rr.fee_category = 'rental'
      AND rr.time_period = 'am'
      AND rr.is_active = true
      AND rr.effective_from <= CURRENT_DATE
      AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE);
  END IF;

  -- Return PM rental if applicable
  IF v_pm_hours > 0 THEN
    RETURN QUERY
    SELECT
      rr.rate_name,
      rr.fee_category,
      rr.rate_type,
      v_pm_hours,
      rr.amount,
      v_pm_hours * rr.amount,
      rr.currency
    FROM public.rental_rates rr
    WHERE rr.facility_id = p_facility_id
      AND rr.fee_category = 'rental'
      AND rr.time_period = 'pm'
      AND rr.is_active = true
      AND rr.effective_from <= CURRENT_DATE
      AND (rr.effective_until IS NULL OR rr.effective_until >= CURRENT_DATE);
  END IF;

  -- Return selected addon fees
  IF array_length(p_addon_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT
      rr.rate_name,
      rr.fee_category,
      rr.rate_type,
      1::DECIMAL AS hours,
      rr.amount,
      rr.amount AS subtotal,
      rr.currency
    FROM public.rental_rates rr
    WHERE rr.id = ANY(p_addon_ids)
      AND rr.facility_id = p_facility_id
      AND rr.is_addon = true
      AND rr.is_active = true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.rental_rates IS 'Facility rental pricing with fee categories (rental, energy, personnel)';
COMMENT ON COLUMN public.rental_rates.fee_category IS 'Fee type: rental (base), energy (equipment/power), personnel (staff)';
COMMENT ON COLUMN public.rental_rates.time_period IS 'Time period for rate: am (morning), pm (afternoon/evening), all_day';
COMMENT ON COLUMN public.rental_rates.rate_type IS 'Pricing type: hourly, flat, or variable';
COMMENT ON COLUMN public.rental_rates.is_addon IS 'True for optional add-on fees (energy, personnel)';
COMMENT ON COLUMN public.rental_rates.applicable_start_time IS 'Start time when this rate applies (for AM/PM rates)';
COMMENT ON COLUMN public.rental_rates.applicable_end_time IS 'End time when this rate applies (for AM/PM rates)';
COMMENT ON FUNCTION public.get_rental_rate IS 'Get applicable rental rate based on booking time';
COMMENT ON FUNCTION public.get_addon_fees IS 'Get all available addon fees for a facility';
COMMENT ON FUNCTION public.calculate_rental_cost IS 'Calculate total rental cost including AM/PM split and addons';
